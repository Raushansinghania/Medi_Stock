const { query, transaction } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/audit');

/**
 * Get all medicines with search, category, stock filters, and sorting
 * @route GET /api/v1/medicines
 */
const getAllMedicines = async (req, res, next) => {
  try {
    const {
      search,
      category,
      lowStock,
      inStock,
      expiring,
      prescriptionRequired,
      sort,
      page = 1,
      limit = 100,
    } = req.query;

    const conditions = [];
    const params = [];

    // Only active medicines for customer/public
    const isStaff = req.user && ['admin', 'pharmacist'].includes(req.user.role);
    if (!isStaff) {
      conditions.push('(is_active = 1 OR is_active IS NULL)');
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        '(LOWER(medicine_name) LIKE ? OR LOWER(manufacturer) LIKE ? OR LOWER(COALESCE(category, "")) LIKE ? OR LOWER(COALESCE(strength, "")) LIKE ? OR LOWER(COALESCE(composition, "")) LIKE ? OR LOWER(COALESCE(batch_number, "")) LIKE ?)'
      );
      params.push(term, term, term, term, term, term);
    }

    if (category && category.trim()) {
      conditions.push('category = ?');
      params.push(category.trim());
    }

    if (inStock === 'true' || inStock === '1') {
      conditions.push('quantity > 0');
    }

    if (prescriptionRequired !== undefined && prescriptionRequired !== '') {
      conditions.push('is_prescription_required = ?');
      params.push(prescriptionRequired === 'true' || prescriptionRequired === '1' ? 1 : 0);
    }

    if (lowStock === 'true' || lowStock === '1') {
      const threshold = Number(req.query.threshold) || 10;
      conditions.push('quantity <= ?');
      params.push(threshold);
    }

    if (expiring === 'true' || expiring === '1') {
      const days = Number(req.query.days) || 60;
      conditions.push('expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)');
      params.push(days);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count
    const [countRows] = await query(`SELECT COUNT(*) AS total FROM medicines ${whereClause}`, params);
    const totalDocs = countRows[0].total;

    // Sorting
    let orderBy = 'id DESC';
    if (sort === 'price_asc') orderBy = 'selling_price ASC';
    else if (sort === 'price_desc') orderBy = 'selling_price DESC';
    else if (sort === 'name_asc') orderBy = 'medicine_name ASC';
    else if (sort === 'name_desc') orderBy = 'medicine_name DESC';

    // Data with pagination
    const offset = (Number(page) - 1) * Number(limit);
    const sql = `
      SELECT * FROM medicines
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const [rows] = await query(sql, [...params, Number(limit), Number(offset)]);

    // Transform rows to sanitize customer-sensitive data if not staff
    const sanitizedRows = rows.map((med) => {
      const stockStatus = med.quantity <= 0 ? 'out_of_stock' : med.quantity <= 10 ? 'low_stock' : 'in_stock';
      if (!isStaff) {
        const { purchase_price, ...customerSafeMed } = med;
        return {
          ...customerSafeMed,
          stock_status: stockStatus,
        };
      }
      return {
        ...med,
        stock_status: stockStatus,
      };
    });

    return ApiResponse.paginated(
      res,
      sanitizedRows,
      { page: Number(page), limit: Number(limit), totalDocs },
      'Medicines retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Fast search suggestions for debounced customer search bar
 * @route GET /api/v1/medicines/suggestions
 */
const getSearchSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return ApiResponse.success(res, []);
    }

    const term = `%${q.trim().toLowerCase()}%`;
    const sql = `
      SELECT id, medicine_name, category, manufacturer, strength, dosage_form, selling_price, mrp, is_prescription_required, quantity
      FROM medicines
      WHERE (is_active = 1 OR is_active IS NULL)
        AND (LOWER(medicine_name) LIKE ? OR LOWER(manufacturer) LIKE ? OR LOWER(COALESCE(category, "")) LIKE ? OR LOWER(COALESCE(strength, "")) LIKE ?)
      ORDER BY 
        CASE WHEN LOWER(medicine_name) LIKE ? THEN 1 ELSE 2 END,
        medicine_name ASC
      LIMIT 8
    `;

    const startsWith = `${q.trim().toLowerCase()}%`;
    const [rows] = await query(sql, [term, term, term, term, startsWith]);

    const suggestions = rows.map((med) => ({
      id: med.id,
      medicine_name: med.medicine_name,
      category: med.category,
      manufacturer: med.manufacturer,
      strength: med.strength,
      dosage_form: med.dosage_form,
      selling_price: Number(med.selling_price),
      mrp: med.mrp ? Number(med.mrp) : Number(med.selling_price),
      is_prescription_required: Boolean(med.is_prescription_required),
      stock_status: med.quantity <= 0 ? 'out_of_stock' : med.quantity <= 10 ? 'low_stock' : 'in_stock',
    }));

    return ApiResponse.success(res, suggestions, 'Suggestions retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * Get single medicine by ID
 * @route GET /api/v1/medicines/:id
 */
const getMedicineById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await query('SELECT * FROM medicines WHERE id = ?', [id]);
    if (rows.length === 0) {
      throw ApiError.notFound('Medicine not found');
    }

    const med = rows[0];
    const isStaff = req.user && ['admin', 'pharmacist'].includes(req.user.role);
    const stockStatus = med.quantity <= 0 ? 'out_of_stock' : med.quantity <= 10 ? 'low_stock' : 'in_stock';

    let result = {
      ...med,
      stock_status: stockStatus,
    };

    if (!isStaff) {
      delete result.purchase_price;
    }

    return ApiResponse.success(res, result, 'Medicine retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new medicine
 * @route POST /api/v1/medicines
 */
const createMedicine = async (req, res, next) => {
  try {
    const {
      medicine_name,
      category,
      manufacturer,
      batch_number,
      quantity = 0,
      purchase_price = 0,
      selling_price = 0,
      mrp,
      discount_percent = 0,
      dosage_form = 'Tablet',
      strength,
      composition,
      description,
      is_prescription_required = 0,
      expiry_date,
    } = req.body;

    if (!medicine_name || !medicine_name.trim()) {
      throw ApiError.badRequest('Medicine name is required');
    }

    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty < 0) {
      throw ApiError.badRequest('Quantity must be a non-negative number');
    }

    const pPrice = Number(purchase_price) || 0;
    const sPrice = Number(selling_price) || 0;
    if (pPrice < 0 || sPrice < 0) {
      throw ApiError.badRequest('Prices cannot be negative');
    }

    const result = await transaction(async (conn) => {
      const [insertRes] = await conn.execute(
        `INSERT INTO medicines 
         (medicine_name, category, dosage_form, strength, composition, description, is_prescription_required, is_active, manufacturer, batch_number, quantity, purchase_price, selling_price, mrp, discount_percent, expiry_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          medicine_name.trim(),
          category ? category.trim() : null,
          dosage_form || 'Tablet',
          strength || null,
          composition || null,
          description || null,
          is_prescription_required ? 1 : 0,
          manufacturer ? manufacturer.trim() : null,
          batch_number ? batch_number.trim() : null,
          numQty,
          pPrice,
          sPrice,
          mrp || sPrice,
          discount_percent || 0,
          expiry_date || null,
        ]
      );

      const medicineId = insertRes.insertId;

      if (numQty > 0) {
        await conn.execute(
          `INSERT INTO stock_movements (medicine_id, movement_type, quantity, reference_type, reference_id, notes)
           VALUES (?, 'adjustment', ?, 'initial_stock', ?, 'Initial stock registration')`,
          [medicineId, numQty, medicineId]
        );

        if (batch_number && expiry_date) {
          await conn.execute(
            `INSERT INTO medicine_batches (medicine_id, batch_number, quantity, initial_quantity, purchase_price, selling_price, mrp, expiry_date, is_blocked)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [medicineId, batch_number.trim(), numQty, numQty, pPrice, sPrice, mrp || sPrice, expiry_date]
          );
        }
      }

      await logAudit(
        req.user?.id,
        'CREATE_MEDICINE',
        'medicines',
        medicineId,
        { medicine_name, quantity: numQty, batch_number },
        conn
      );

      return medicineId;
    });

    const [newMed] = await query('SELECT * FROM medicines WHERE id = ?', [result]);
    return ApiResponse.created(res, newMed[0], 'Medicine created successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing medicine
 * @route PUT /api/v1/medicines/:id
 */
const updateMedicine = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      medicine_name,
      category,
      manufacturer,
      batch_number,
      quantity,
      purchase_price,
      selling_price,
      mrp,
      discount_percent,
      dosage_form,
      strength,
      composition,
      description,
      is_prescription_required,
      is_active,
      expiry_date,
    } = req.body;

    const [existing] = await query('SELECT * FROM medicines WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('Medicine not found');
    }

    const current = existing[0];
    const updates = [];
    const params = [];

    if (medicine_name !== undefined) {
      updates.push('medicine_name = ?');
      params.push(medicine_name.trim());
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category ? category.trim() : null);
    }
    if (manufacturer !== undefined) {
      updates.push('manufacturer = ?');
      params.push(manufacturer ? manufacturer.trim() : null);
    }
    if (batch_number !== undefined) {
      updates.push('batch_number = ?');
      params.push(batch_number ? batch_number.trim() : null);
    }
    if (dosage_form !== undefined) {
      updates.push('dosage_form = ?');
      params.push(dosage_form);
    }
    if (strength !== undefined) {
      updates.push('strength = ?');
      params.push(strength);
    }
    if (composition !== undefined) {
      updates.push('composition = ?');
      params.push(composition);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (is_prescription_required !== undefined) {
      updates.push('is_prescription_required = ?');
      params.push(is_prescription_required ? 1 : 0);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }
    if (purchase_price !== undefined) {
      const p = Number(purchase_price);
      if (p < 0) throw ApiError.badRequest('Purchase price cannot be negative');
      updates.push('purchase_price = ?');
      params.push(p);
    }
    if (selling_price !== undefined) {
      const s = Number(selling_price);
      if (s < 0) throw ApiError.badRequest('Selling price cannot be negative');
      updates.push('selling_price = ?');
      params.push(s);
    }
    if (mrp !== undefined) {
      updates.push('mrp = ?');
      params.push(Number(mrp));
    }
    if (discount_percent !== undefined) {
      updates.push('discount_percent = ?');
      params.push(Number(discount_percent));
    }
    if (expiry_date !== undefined) {
      updates.push('expiry_date = ?');
      params.push(expiry_date || null);
    }

    let qtyDiff = 0;
    if (quantity !== undefined) {
      const newQty = Number(quantity);
      if (isNaN(newQty) || newQty < 0) {
        throw ApiError.badRequest('Quantity must be a non-negative number');
      }
      qtyDiff = newQty - current.quantity;
      updates.push('quantity = ?');
      params.push(newQty);
    }

    if (updates.length === 0) {
      throw ApiError.badRequest('No update parameters provided');
    }

    await transaction(async (conn) => {
      params.push(id);
      await conn.execute(`UPDATE medicines SET ${updates.join(', ')} WHERE id = ?`, params);

      if (qtyDiff !== 0) {
        await conn.execute(
          `INSERT INTO stock_movements (medicine_id, movement_type, quantity, reference_type, reference_id, notes)
           VALUES (?, 'adjustment', ?, 'manual_update', ?, ?)`,
          [id, Math.abs(qtyDiff), id, `Manual stock adjustment from ${current.quantity} to ${quantity}`]
        );
      }

      await logAudit(
        req.user?.id,
        'UPDATE_MEDICINE',
        'medicines',
        id,
        { updates: req.body, previousQty: current.quantity },
        conn
      );
    });

    const [updated] = await query('SELECT * FROM medicines WHERE id = ?', [id]);
    return ApiResponse.success(res, updated[0], 'Medicine updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Adjust stock manually
 * @route POST /api/v1/medicines/:id/adjust-stock
 */
const adjustStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adjustment, reason } = req.body;

    const adj = Number(adjustment);
    if (isNaN(adj) || adj === 0) {
      throw ApiError.badRequest('Valid non-zero adjustment amount is required');
    }

    await transaction(async (conn) => {
      const [rows] = await conn.execute('SELECT id, quantity, medicine_name FROM medicines WHERE id = ? FOR UPDATE', [id]);
      if (rows.length === 0) {
        throw ApiError.notFound('Medicine not found');
      }

      const med = rows[0];
      const newQty = med.quantity + adj;
      if (newQty < 0) {
        throw ApiError.badRequest(
          `Cannot reduce stock by ${Math.abs(adj)}. Current stock is ${med.quantity}. Negative stock is not allowed.`
        );
      }

      await conn.execute('UPDATE medicines SET quantity = ? WHERE id = ?', [newQty, id]);

      await conn.execute(
        `INSERT INTO stock_movements (medicine_id, movement_type, quantity, reference_type, reference_id, notes)
         VALUES (?, 'adjustment', ?, 'stock_adjustment', ?, ?)`,
        [id, Math.abs(adj), id, reason || `Manual stock adjustment (${adj > 0 ? '+' : ''}${adj})`]
      );

      await logAudit(
        req.user?.id,
        'ADJUST_STOCK',
        'medicines',
        id,
        { oldQty: med.quantity, newQty, adjustment: adj, reason },
        conn
      );
    });

    const [updated] = await query('SELECT * FROM medicines WHERE id = ?', [id]);
    return ApiResponse.success(res, updated[0], 'Stock adjusted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Delete medicine (Admin only)
 * @route DELETE /api/v1/medicines/:id
 */
const deleteMedicine = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [existing] = await query('SELECT * FROM medicines WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('Medicine not found');
    }

    await query('DELETE FROM medicines WHERE id = ?', [id]);
    await logAudit(req.user?.id, 'DELETE_MEDICINE', 'medicines', id, { name: existing[0].medicine_name });

    return ApiResponse.success(res, null, 'Medicine deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllMedicines,
  getSearchSuggestions,
  getMedicineById,
  createMedicine,
  updateMedicine,
  adjustStock,
  deleteMedicine,
};
