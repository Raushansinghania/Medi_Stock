const { query, transaction } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/audit');

/**
 * Get all purchases with supplier details
 * @route GET /api/v1/purchases
 */
const getAllPurchases = async (req, res, next) => {
  try {
    const { supplier_id, from_date, to_date, status } = req.query;
    let sql = `
      SELECT p.*, s.supplier_name, s.contact_person, s.phone AS supplier_phone,
             (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) AS total_items
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
    `;
    const conditions = [];
    const params = [];

    if (supplier_id) {
      conditions.push('p.supplier_id = ?');
      params.push(supplier_id);
    }
    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }
    if (from_date) {
      conditions.push('p.purchase_date >= ?');
      params.push(from_date);
    }
    if (to_date) {
      conditions.push('p.purchase_date <= ?');
      params.push(to_date);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY p.id DESC';

    const [rows] = await query(sql, params);
    return ApiResponse.success(res, rows, 'Purchases retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get purchase by ID with items
 * @route GET /api/v1/purchases/:id
 */
const getPurchaseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [purchases] = await query(
      `SELECT p.*, s.supplier_name, s.contact_person, s.phone, s.email, s.address
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id = ?`,
      [id]
    );

    if (purchases.length === 0) {
      throw ApiError.notFound('Purchase record not found');
    }

    const [items] = await query(
      `SELECT pi.*, m.medicine_name, m.batch_number AS med_batch_number, m.category, m.expiry_date AS med_expiry_date
       FROM purchase_items pi
       JOIN medicines m ON pi.medicine_id = m.id
       WHERE pi.purchase_id = ?`,
      [id]
    );

    return ApiResponse.success(
      res,
      { ...purchases[0], items },
      'Purchase details retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new purchase with items
 * If status === 'received' (default for backward compatibility), updates stock immediately.
 * If status is 'draft', 'ordered', or 'pending_approval', creates the order without incrementing stock.
 * @route POST /api/v1/purchases
 */
const createPurchase = async (req, res, next) => {
  try {
    const { supplier_id, invoice_number, purchase_date, items, status = 'received', notes, tax = 0 } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw ApiError.badRequest('Purchase must contain at least one item');
    }

    if (supplier_id) {
      const [supp] = await query('SELECT id FROM suppliers WHERE id = ?', [supplier_id]);
      if (supp.length === 0) {
        throw ApiError.badRequest(`Supplier with ID ${supplier_id} does not exist`);
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const pDate = purchase_date || today;
    const invNumber = invoice_number ? invoice_number.trim() : `PUR-${Date.now()}`;
    const pStatus = ['draft', 'pending_approval', 'approved', 'ordered', 'partially_received', 'received', 'cancelled'].includes(status)
      ? status
      : 'received';

    let calculatedTotal = 0;
    const validatedItems = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const medicineId = Number(item.medicine_id);
      const qty = Number(item.quantity);
      const unitCost = Number(item.unit_cost);

      if (!medicineId || isNaN(medicineId)) {
        throw ApiError.badRequest(`Item #${i + 1}: Valid medicine_id is required`);
      }
      if (isNaN(qty) || qty <= 0) {
        throw ApiError.badRequest(`Item #${i + 1}: Quantity must be greater than zero`);
      }
      if (isNaN(unitCost) || unitCost < 0) {
        throw ApiError.badRequest(`Item #${i + 1}: Unit cost must be a non-negative number`);
      }

      const subtotal = Math.round(qty * unitCost * 100) / 100;
      calculatedTotal += subtotal;

      validatedItems.push({
        medicine_id: medicineId,
        quantity: qty,
        unit_cost: unitCost,
        subtotal,
        batch_number: item.batch_number || null,
        expiry_date: item.expiry_date || null,
      });
    }

    const numTax = Number(tax) || 0;
    calculatedTotal = Math.round((calculatedTotal + numTax) * 100) / 100;

    const purchaseId = await transaction(async (conn) => {
      // 1. Insert purchase header
      const [pRes] = await conn.execute(
        `INSERT INTO purchases (supplier_id, invoice_number, purchase_date, total_amount, status, tax, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [supplier_id || null, invNumber, pDate, calculatedTotal, pStatus, numTax, notes || null]
      );
      const newPurchaseId = pRes.insertId;

      // 2. Insert items and conditionally update stock if status === 'received'
      for (const item of validatedItems) {
        const [medRows] = await conn.execute(
          'SELECT id, medicine_name, quantity, selling_price, mrp FROM medicines WHERE id = ? FOR UPDATE',
          [item.medicine_id]
        );
        if (medRows.length === 0) {
          throw ApiError.badRequest(`Medicine with ID ${item.medicine_id} does not exist`);
        }
        const med = medRows[0];

        await conn.execute(
          `INSERT INTO purchase_items (purchase_id, medicine_id, quantity, unit_cost, subtotal, batch_number, expiry_date)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newPurchaseId, item.medicine_id, item.quantity, item.unit_cost, item.subtotal, item.batch_number, item.expiry_date]
        );

        // ONLY increase stock if goods receipt is confirmed (status === 'received')
        if (pStatus === 'received') {
          const updatedQty = med.quantity + item.quantity;
          await conn.execute(
            'UPDATE medicines SET quantity = ?, purchase_price = ? WHERE id = ?',
            [updatedQty, item.unit_cost, item.medicine_id]
          );

          // If batch number is provided, register/update batch in medicine_batches
          if (item.batch_number) {
            const expDate = item.expiry_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            const [batchRows] = await conn.execute(
              'SELECT id, quantity FROM medicine_batches WHERE medicine_id = ? AND batch_number = ?',
              [item.medicine_id, item.batch_number]
            );

            if (batchRows.length > 0) {
              await conn.execute(
                'UPDATE medicine_batches SET quantity = quantity + ? WHERE id = ?',
                [item.quantity, batchRows[0].id]
              );
            } else {
              await conn.execute(
                `INSERT INTO medicine_batches (medicine_id, batch_number, quantity, initial_quantity, purchase_price, selling_price, mrp, expiry_date, is_blocked)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
                [
                  item.medicine_id,
                  item.batch_number,
                  item.quantity,
                  item.quantity,
                  item.unit_cost,
                  med.selling_price || item.unit_cost * 1.3,
                  med.mrp || item.unit_cost * 1.5,
                  expDate,
                ]
              );
            }
          }

          // Record stock movement
          await conn.execute(
            `INSERT INTO stock_movements (medicine_id, movement_type, quantity, reference_type, reference_id, notes)
             VALUES (?, 'purchase', ?, 'purchase', ?, ?)`,
            [
              item.medicine_id,
              item.quantity,
              newPurchaseId,
              `Stock received from purchase invoice ${invNumber}`,
            ]
          );
        }
      }

      await logAudit(
        req.user?.id,
        'CREATE_PURCHASE',
        'purchases',
        newPurchaseId,
        { invoice_number: invNumber, total_amount: calculatedTotal, status: pStatus, items_count: validatedItems.length },
        conn
      );

      return newPurchaseId;
    });

    const [created] = await query('SELECT * FROM purchases WHERE id = ?', [purchaseId]);
    const [createdItems] = await query('SELECT * FROM purchase_items WHERE purchase_id = ?', [purchaseId]);

    return ApiResponse.created(
      res,
      { ...created[0], items: createdItems },
      pStatus === 'received'
        ? 'Purchase recorded successfully and stock updated'
        : `Purchase order created with status '${pStatus}' (stock unchanged until goods receipt)`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update purchase order status
 * @route PATCH /api/v1/purchases/:id/status
 */
const updatePurchaseStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'pending_approval', 'approved', 'ordered', 'partially_received', 'received', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw ApiError.badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const [existing] = await query('SELECT * FROM purchases WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('Purchase record not found');
    }

    if (existing[0].status === 'received' && status !== 'received') {
      throw ApiError.badRequest('Cannot change status of an already received purchase order');
    }

    await query('UPDATE purchases SET status = ? WHERE id = ?', [status, id]);

    await logAudit(req.user?.id, 'PURCHASE_STATUS_UPDATED', 'purchases', id, {
      previousStatus: existing[0].status,
      newStatus: status,
    });

    return ApiResponse.success(res, { id: Number(id), status }, `Purchase order status updated to ${status}`);
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm goods receipt for a purchase order and update inventory
 * @route POST /api/v1/purchases/:id/receive
 */
const receivePurchaseGoods = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { items: receivedItemsData = [] } = req.body;

    const [purchaseRows] = await query('SELECT * FROM purchases WHERE id = ?', [id]);
    if (purchaseRows.length === 0) {
      throw ApiError.notFound('Purchase record not found');
    }

    const purchase = purchaseRows[0];
    if (purchase.status === 'received') {
      throw ApiError.badRequest('Goods for this purchase order have already been received into inventory');
    }

    const [existingItems] = await query('SELECT * FROM purchase_items WHERE purchase_id = ?', [id]);

    await transaction(async (conn) => {
      // Process each item and update stock
      for (const item of existingItems) {
        const itemOverride = receivedItemsData.find((r) => Number(r.medicine_id) === Number(item.medicine_id)) || {};
        const batchNumber = itemOverride.batch_number || item.batch_number || `BATCH-PO${id}-${Date.now().toString().slice(-4)}`;
        const expiryDate = itemOverride.expiry_date || item.expiry_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const qtyReceived = itemOverride.quantity ? Number(itemOverride.quantity) : item.quantity;

        // Lock medicine row
        const [medRows] = await conn.execute(
          'SELECT id, medicine_name, quantity, selling_price, mrp FROM medicines WHERE id = ? FOR UPDATE',
          [item.medicine_id]
        );
        if (medRows.length === 0) continue;
        const med = medRows[0];

        // 1. Update medicine total quantity
        await conn.execute(
          'UPDATE medicines SET quantity = quantity + ?, purchase_price = ? WHERE id = ?',
          [qtyReceived, item.unit_cost, item.medicine_id]
        );

        // 2. Insert or update batch in medicine_batches
        const [batchRows] = await conn.execute(
          'SELECT id, quantity FROM medicine_batches WHERE medicine_id = ? AND batch_number = ?',
          [item.medicine_id, batchNumber]
        );

        if (batchRows.length > 0) {
          await conn.execute(
            'UPDATE medicine_batches SET quantity = quantity + ? WHERE id = ?',
            [qtyReceived, batchRows[0].id]
          );
        } else {
          await conn.execute(
            `INSERT INTO medicine_batches (medicine_id, batch_number, quantity, initial_quantity, purchase_price, selling_price, mrp, expiry_date, is_blocked)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
              item.medicine_id,
              batchNumber,
              qtyReceived,
              qtyReceived,
              item.unit_cost,
              med.selling_price || item.unit_cost * 1.3,
              med.mrp || item.unit_cost * 1.5,
              expiryDate,
            ]
          );
        }

        // 3. Update purchase_item batch info
        await conn.execute(
          'UPDATE purchase_items SET batch_number = ?, expiry_date = ? WHERE id = ?',
          [batchNumber, expiryDate, item.id]
        );

        // 4. Record stock movement
        await conn.execute(
          `INSERT INTO stock_movements (medicine_id, movement_type, quantity, reference_type, reference_id, notes)
           VALUES (?, 'purchase', ?, 'purchase', ?, ?)`,
          [
            item.medicine_id,
            qtyReceived,
            id,
            `Goods received for PO ${purchase.invoice_number} (Batch ${batchNumber})`,
          ]
        );
      }

      // Update purchase status to received
      await conn.execute("UPDATE purchases SET status = 'received' WHERE id = ?", [id]);

      await logAudit(req.user?.id, 'PURCHASE_GOODS_RECEIVED', 'purchases', id, {
        invoice_number: purchase.invoice_number,
        total_items: existingItems.length,
      }, conn);
    });

    const [updated] = await query('SELECT * FROM purchases WHERE id = ?', [id]);
    const [updatedItems] = await query('SELECT * FROM purchase_items WHERE purchase_id = ?', [id]);

    return ApiResponse.success(
      res,
      { ...updated[0], items: updatedItems },
      'Goods received successfully. Inventory and batches have been updated.'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchaseStatus,
  receivePurchaseGoods,
};
