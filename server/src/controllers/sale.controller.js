const { query, transaction } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/audit');

/**
 * Get all sales with customer details and payment summary
 * @route GET /api/v1/sales
 */
const getAllSales = async (req, res, next) => {
  try {
    const { customer_id, from_date, to_date, search, page = 1, limit = 100 } = req.query;

    let sql = `
      SELECT s.*, c.customer_name, c.phone AS customer_phone,
             (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS total_items,
             (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.sale_id = s.id) AS amount_paid
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
    `;
    const conditions = [];
    const params = [];

    // If customer role, only allow viewing own sales
    if (req.user?.role === 'customer') {
      // Find customer associated with user's email
      const [cust] = await query('SELECT id FROM customers WHERE email = ?', [req.user.email]);
      if (cust.length > 0) {
        conditions.push('s.customer_id = ?');
        params.push(cust[0].id);
      } else {
        return ApiResponse.success(res, [], 'No sales found');
      }
    } else if (customer_id) {
      conditions.push('s.customer_id = ?');
      params.push(customer_id);
    }

    if (search) {
      conditions.push('(s.invoice_number LIKE ? OR c.customer_name LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    if (from_date) {
      conditions.push('s.sale_date >= ?');
      params.push(from_date);
    }
    if (to_date) {
      conditions.push('s.sale_date <= ?');
      params.push(to_date);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY s.id DESC';

    const [rows] = await query(sql, params);
    return ApiResponse.success(res, rows, 'Sales retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get sale by ID with sale items and payment history
 * @route GET /api/v1/sales/:id
 */
const getSaleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [sales] = await query(
      `SELECT s.*, c.customer_name, c.phone, c.email, c.address
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.id = ?`,
      [id]
    );

    if (sales.length === 0) {
      throw ApiError.notFound('Sale record not found');
    }

    const sale = sales[0];

    // Check customer authorization
    if (req.user?.role === 'customer') {
      const [cust] = await query('SELECT id FROM customers WHERE email = ?', [req.user.email]);
      if (!cust.length || cust[0].id !== sale.customer_id) {
        throw ApiError.forbidden('You do not have permission to view this sale');
      }
    }

    const [items] = await query(
      `SELECT si.*, m.medicine_name, m.batch_number, m.category, m.expiry_date
       FROM sale_items si
       JOIN medicines m ON si.medicine_id = m.id
       WHERE si.sale_id = ?`,
      [id]
    );

    const [payments] = await query(
      'SELECT * FROM payments WHERE sale_id = ? ORDER BY id ASC',
      [id]
    );

    const [returns] = await query(
      'SELECT * FROM returns WHERE sale_id = ? ORDER BY id ASC',
      [id]
    );

    return ApiResponse.success(
      res,
      { ...sale, items, payments, returns },
      'Sale details retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new sale with POS validation and stock deduction
 * @route POST /api/v1/sales
 */
const createSale = async (req, res, next) => {
  try {
    const {
      customer_id,
      invoice_number,
      sale_date,
      items,
      discount = 0,
      tax = 0,
      payment_method = 'cash',
      paid_amount,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw ApiError.badRequest('Sale must contain at least one medicine item');
    }

    // Verify customer if specified
    if (customer_id) {
      const [cust] = await query('SELECT id FROM customers WHERE id = ?', [customer_id]);
      if (cust.length === 0) {
        throw ApiError.badRequest(`Customer with ID ${customer_id} does not exist`);
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const sDate = sale_date || today;
    const invNumber = invoice_number ? invoice_number.trim() : `INV-${Date.now()}`;

    // Validate items and verify stock in an atomic transaction
    const saleId = await transaction(async (conn) => {
      let calculatedSubtotal = 0;
      const processedItems = [];

      // Pass 1: Check stock and prepare item calculations with row locking
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const medicineId = Number(item.medicine_id);
        const requestedQty = Number(item.quantity);

        if (!medicineId || isNaN(medicineId)) {
          throw ApiError.badRequest(`Item #${i + 1}: Valid medicine_id is required`);
        }
        if (isNaN(requestedQty) || requestedQty <= 0) {
          throw ApiError.badRequest(`Item #${i + 1}: Quantity must be greater than zero`);
        }

        // Lock medicine row to prevent race conditions during checkout
        const [medRows] = await conn.execute(
          'SELECT id, medicine_name, quantity, selling_price, expiry_date FROM medicines WHERE id = ? FOR UPDATE',
          [medicineId]
        );

        if (medRows.length === 0) {
          throw ApiError.notFound(`Medicine with ID ${medicineId} not found`);
        }

        const med = medRows[0];

        // Stock availability check
        if (med.quantity < requestedQty) {
          throw ApiError.badRequest(
            `Insufficient stock for '${med.medicine_name}'. Requested: ${requestedQty}, Available: ${med.quantity}`
          );
        }

        // Expired stock blocking (Req 5 & Req 8)
        const [anyBatches] = await conn.execute(
          'SELECT COUNT(*) AS total_batches FROM medicine_batches WHERE medicine_id = ?',
          [medicineId]
        );
        if (anyBatches[0].total_batches > 0) {
          const [validBatches] = await conn.execute(
            `SELECT COALESCE(SUM(quantity), 0) AS eligible_qty 
             FROM medicine_batches 
             WHERE medicine_id = ? AND is_blocked = 0 AND expiry_date >= CURDATE()`,
            [medicineId]
          );
          if (Number(validBatches[0].eligible_qty) < requestedQty) {
            throw ApiError.badRequest(
              `Cannot dispense '${med.medicine_name}'. Insufficient unexpired stock (${validBatches[0].eligible_qty} available unexpired, ${requestedQty} requested). Expired or quarantined batches are blocked from dispensing.`
            );
          }
        } else if (med.expiry_date && new Date(med.expiry_date) < new Date(today)) {
          throw ApiError.badRequest(
            `Cannot dispense '${med.medicine_name}'. Stock expired on ${new Date(med.expiry_date).toISOString().slice(0, 10)}. Dispensing expired stock is strictly prohibited.`
          );
        }

        const unitPrice = item.unit_price !== undefined ? Number(item.unit_price) : Number(med.selling_price);
        if (isNaN(unitPrice) || unitPrice < 0) {
          throw ApiError.badRequest(`Item #${i + 1}: Unit price must be a non-negative number`);
        }

        const itemSubtotal = Math.round(requestedQty * unitPrice * 100) / 100;
        calculatedSubtotal += itemSubtotal;

        processedItems.push({
          medicine_id: medicineId,
          medicine_name: med.medicine_name,
          quantity: requestedQty,
          unit_price: unitPrice,
          subtotal: itemSubtotal,
          currentStock: med.quantity,
        });
      }

      calculatedSubtotal = Math.round(calculatedSubtotal * 100) / 100;

      // Calculate totals
      const numDiscount = Math.max(0, Number(discount) || 0);
      const numTax = Math.max(0, Number(tax) || 0);
      const totalAmount = Math.max(0, Math.round((calculatedSubtotal - numDiscount + numTax) * 100) / 100);

      // 1. Insert into sales
      const [saleRes] = await conn.execute(
        `INSERT INTO sales (customer_id, invoice_number, sale_date, subtotal, discount, tax, total_amount, payment_method)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customer_id || null,
          invNumber,
          sDate,
          calculatedSubtotal,
          numDiscount,
          numTax,
          totalAmount,
          payment_method,
        ]
      );
      const newSaleId = saleRes.insertId;

      // 2. Insert items and decrement stock using FEFO batch allocation
      for (const pItem of processedItems) {
        // Query active, non-blocked, unexpired batches ordered by FEFO (expiry_date ASC)
        const [batches] = await conn.execute(
          `SELECT id, batch_number, quantity, expiry_date 
           FROM medicine_batches 
           WHERE medicine_id = ? AND is_blocked = 0 AND expiry_date >= CURDATE() AND quantity > 0
           ORDER BY expiry_date ASC, id ASC FOR UPDATE`,
          [pItem.medicine_id]
        );

        let remainingQty = pItem.quantity;
        let primaryBatchId = null;
        let primaryBatchNumber = null;

        if (batches.length > 0) {
          for (const b of batches) {
            if (remainingQty <= 0) break;
            const deduct = Math.min(b.quantity, remainingQty);
            await conn.execute(
              'UPDATE medicine_batches SET quantity = quantity - ? WHERE id = ?',
              [deduct, b.id]
            );
            if (!primaryBatchId) {
              primaryBatchId = b.id;
              primaryBatchNumber = b.batch_number;
            }
            remainingQty -= deduct;
          }
        }

        await conn.execute(
          `INSERT INTO sale_items (sale_id, medicine_id, batch_id, batch_number, quantity, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            newSaleId,
            pItem.medicine_id,
            primaryBatchId,
            primaryBatchNumber || null,
            pItem.quantity,
            pItem.unit_price,
            pItem.subtotal,
          ]
        );

        const newStock = Math.max(0, pItem.currentStock - pItem.quantity);
        await conn.execute('UPDATE medicines SET quantity = ? WHERE id = ?', [newStock, pItem.medicine_id]);

        // Record stock movement (movement_type: 'sale')
        await conn.execute(
          `INSERT INTO stock_movements (medicine_id, movement_type, quantity, reference_type, reference_id, notes)
           VALUES (?, 'sale', ?, 'sale', ?, ?)`,
          [
            pItem.medicine_id,
            pItem.quantity,
            newSaleId,
            `FEFO stock deduction from invoice ${invNumber}${primaryBatchNumber ? ` (Batch: ${primaryBatchNumber})` : ''}`,
          ]
        );
      }

      // 3. Record payment if payment amount specified or default to paid
      const payAmount = paid_amount !== undefined ? Number(paid_amount) : totalAmount;
      if (payAmount > 0) {
        await conn.execute(
          `INSERT INTO payments (sale_id, amount, payment_method, payment_status)
           VALUES (?, ?, ?, 'completed')`,
          [newSaleId, payAmount, payment_method]
        );
      }

      // 4. Record audit log
      await logAudit(
        req.user?.id,
        'CREATE_SALE',
        'sales',
        newSaleId,
        { invoice_number: invNumber, total_amount: totalAmount, items_count: processedItems.length },
        conn
      );

      return newSaleId;
    });

    const [createdSale] = await query('SELECT * FROM sales WHERE id = ?', [saleId]);
    const [createdItems] = await query('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);
    const [payments] = await query('SELECT * FROM payments WHERE sale_id = ?', [saleId]);

    return ApiResponse.created(
      res,
      { ...createdSale[0], items: createdItems, payments },
      'Sale completed successfully and stock deducted'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSales,
  getSaleById,
  createSale,
};
