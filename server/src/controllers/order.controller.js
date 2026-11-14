const { query, transaction } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/audit');

/**
 * Get all orders (Customer sees own, Staff sees all)
 * @route GET /api/v1/orders
 */
const getAllOrders = async (req, res, next) => {
  try {
    const { status, search, from_date, to_date, page = 1, limit = 50 } = req.query;

    let sql = `
      SELECT o.*, 
             c.customer_name, c.phone AS customer_phone, c.email AS customer_email,
             (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS total_items
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
    `;
    const conditions = [];
    const params = [];

    // Strict customer isolation
    if (req.user?.role === 'customer') {
      conditions.push('o.user_id = ?');
      params.push(req.user.id);
    } else if (req.query.customer_id) {
      conditions.push('o.customer_id = ?');
      params.push(req.query.customer_id);
    }

    if (status) {
      conditions.push('o.status = ?');
      params.push(status);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push('(o.order_number LIKE ? OR c.customer_name LIKE ?)');
      params.push(term, term);
    }

    if (from_date) {
      conditions.push('o.created_at >= ?');
      params.push(from_date);
    }
    if (to_date) {
      conditions.push('o.created_at <= ?');
      params.push(to_date);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Count
    const [countRows] = await query(
      `SELECT COUNT(*) AS total FROM orders o LEFT JOIN customers c ON o.customer_id = c.id ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}`,
      params
    );
    const totalDocs = countRows[0].total;

    sql += ' ORDER BY o.id DESC LIMIT ? OFFSET ?';
    const offset = (Number(page) - 1) * Number(limit);
    const [rows] = await query(sql, [...params, Number(limit), Number(offset)]);

    return ApiResponse.paginated(
      res,
      rows,
      { page: Number(page), limit: Number(limit), totalDocs },
      'Orders retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get single order by ID with items and timeline
 * @route GET /api/v1/orders/:id
 */
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [orders] = await query(
      `SELECT o.*, c.customer_name, c.phone AS customer_phone, c.email AS customer_email,
              p.doctor_name, p.status AS prescription_status
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN prescriptions p ON o.prescription_id = p.id
       WHERE o.id = ?`,
      [id]
    );

    if (orders.length === 0) {
      throw ApiError.notFound('Order not found');
    }

    const order = orders[0];

    // Customer security check
    if (req.user?.role === 'customer' && order.user_id !== req.user.id) {
      throw ApiError.forbidden('You do not have permission to view this order');
    }

    const [items] = await query(
      `SELECT oi.*, m.medicine_name, m.strength, m.dosage_form, m.category, m.is_prescription_required
       FROM order_items oi
       JOIN medicines m ON oi.medicine_id = m.id
       WHERE oi.order_id = ?`,
      [id]
    );

    return ApiResponse.success(res, { ...order, items }, 'Order details retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * Place a new customer order
 * @route POST /api/v1/orders
 */
const createOrder = async (req, res, next) => {
  try {
    const {
      items,
      order_type = 'pickup',
      delivery_address,
      payment_method = 'cash',
      prescription_id,
      notes,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw ApiError.badRequest('Order must contain at least one medicine item');
    }

    const userId = req.user.id;

    // Find or link customer profile
    let [custRows] = await query('SELECT id, customer_name, phone, address FROM customers WHERE user_id = ? OR email = ?', [userId, req.user.email]);
    let customerId = custRows[0]?.id;

    if (!customerId) {
      const [newCust] = await query(
        'INSERT INTO customers (user_id, customer_name, phone, email, address) VALUES (?, ?, ?, ?, ?)',
        [userId, req.user.name || 'Valued Patient', '+1-555-0100', req.user.email, delivery_address || 'Customer Address']
      );
      customerId = newCust.insertId;
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${todayStr}-${randPart}`;

    const orderId = await transaction(async (conn) => {
      let calculatedSubtotal = 0;
      let hasPrescriptionItem = false;
      const validatedItems = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const medId = Number(item.medicine_id);
        const reqQty = Number(item.quantity);

        if (!medId || isNaN(medId)) {
          throw ApiError.badRequest(`Item #${i + 1}: Valid medicine_id is required`);
        }
        if (isNaN(reqQty) || reqQty <= 0) {
          throw ApiError.badRequest(`Item #${i + 1}: Quantity must be greater than zero`);
        }

        const [medRows] = await conn.execute(
          'SELECT id, medicine_name, quantity, selling_price, is_prescription_required, is_active FROM medicines WHERE id = ? FOR UPDATE',
          [medId]
        );

        if (medRows.length === 0) {
          throw ApiError.notFound(`Medicine #${medId} does not exist`);
        }

        const med = medRows[0];
        if (med.is_active === 0) {
          throw ApiError.badRequest(`'${med.medicine_name}' is currently unavailable for online orders.`);
        }

        if (med.quantity < reqQty) {
          throw ApiError.badRequest(
            `Insufficient stock for '${med.medicine_name}'. Available: ${med.quantity}, Requested: ${reqQty}`
          );
        }

        if (med.is_prescription_required) {
          hasPrescriptionItem = true;
        }

        const unitPrice = Number(med.selling_price || 0);
        const itemSubtotal = Math.round(unitPrice * reqQty * 100) / 100;
        calculatedSubtotal += itemSubtotal;

        validatedItems.push({
          medicine_id: med.id,
          quantity: reqQty,
          unit_price: unitPrice,
          subtotal: itemSubtotal,
        });
      }

      calculatedSubtotal = Math.round(calculatedSubtotal * 100) / 100;
      const taxRate = 0.05; // 5% standard sales tax
      const tax = Math.round(calculatedSubtotal * taxRate * 100) / 100;
      const discount = 0.0;
      const totalAmount = Math.round((calculatedSubtotal + tax - discount) * 100) / 100;

      // Status determination
      let initialStatus = 'pending';
      if (hasPrescriptionItem) {
        initialStatus = prescription_id ? 'pending' : 'awaiting_prescription';
      }

      // Insert Order Header
      const [ordRes] = await conn.execute(
        `INSERT INTO orders 
         (order_number, customer_id, user_id, prescription_id, order_type, delivery_address, status, subtotal, discount, tax, total_amount, payment_method, payment_status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          orderNumber,
          customerId,
          userId,
          prescription_id || null,
          order_type,
          delivery_address || null,
          initialStatus,
          calculatedSubtotal,
          discount,
          tax,
          totalAmount,
          payment_method,
          notes || null,
        ]
      );

      const newOrderId = ordRes.insertId;

      // Insert Order Items
      for (const vi of validatedItems) {
        await conn.execute(
          `INSERT INTO order_items (order_id, medicine_id, quantity, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?)`,
          [newOrderId, vi.medicine_id, vi.quantity, vi.unit_price, vi.subtotal]
        );
      }

      // Create Customer Notification
      await conn.execute(
        `INSERT INTO notifications (user_id, title, message, type, link)
         VALUES (?, ?, ?, 'order', ?)`,
        [
          userId,
          'Order Placed Successfully',
          `Your order ${orderNumber} has been received and is ${initialStatus === 'awaiting_prescription' ? 'awaiting prescription upload' : 'pending pharmacist confirmation'}. Total: $${totalAmount.toFixed(2)}.`,
          `/customer/orders`,
        ]
      );

      await logAudit(userId, 'CREATE_ORDER', 'orders', newOrderId, {
        orderNumber,
        totalAmount,
        itemsCount: validatedItems.length,
      }, conn);

      return newOrderId;
    });

    const [created] = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const [itemsRes] = await query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

    return ApiResponse.created(
      res,
      { ...created[0], items: itemsRes },
      'Order placed successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Customer cancel order
 * @route PATCH /api/v1/orders/:id/cancel
 */
const cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const [orders] = await query('SELECT * FROM orders WHERE id = ?', [id]);
    if (orders.length === 0) {
      throw ApiError.notFound('Order not found');
    }

    const order = orders[0];

    // Customer security
    if (req.user.role === 'customer' && order.user_id !== req.user.id) {
      throw ApiError.forbidden('You do not have permission to cancel this order');
    }

    // Only pending or awaiting_prescription orders can be cancelled by customer
    if (req.user.role === 'customer' && !['pending', 'awaiting_prescription'].includes(order.status)) {
      throw ApiError.badRequest(`Orders in '${order.status}' status cannot be cancelled online. Please contact pharmacy.`);
    }

    await query(
      `UPDATE orders SET status = 'cancelled', cancellation_reason = ? WHERE id = ?`,
      [reason || 'Cancelled by customer', id]
    );

    // Notification
    await query(
      `INSERT INTO notifications (user_id, title, message, type, link)
       VALUES (?, ?, ?, 'order', ?)`,
      [
        order.user_id,
        'Order Cancelled',
        `Your order ${order.order_number} has been cancelled.`,
        `/customer/orders`,
      ]
    );

    await logAudit(req.user.id, 'CANCEL_ORDER', 'orders', id, { reason });

    const [updated] = await query('SELECT * FROM orders WHERE id = ?', [id]);
    return ApiResponse.success(res, updated[0], 'Order cancelled successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Staff update order status (Admin & Pharmacist)
 * When an order transitions to 'delivered' or 'ready_for_collection', it atomically executes FEFO dispensing,
 * generates a linked fiscal tax invoice in sales, updates inventory, records payments, and updates prescription status.
 * @route PATCH /api/v1/orders/:id/status
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, payment_status, notes } = req.body;

    const allowed = ['pending', 'awaiting_prescription', 'confirmed', 'processing', 'ready_for_collection', 'shipped', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) {
      throw ApiError.badRequest(`Invalid order status. Allowed: ${allowed.join(', ')}`);
    }

    const [orders] = await query('SELECT * FROM orders WHERE id = ?', [id]);
    if (orders.length === 0) {
      throw ApiError.notFound('Order not found');
    }

    const order = orders[0];
    const targetPaymentStatus = payment_status || (['delivered', 'ready_for_collection'].includes(status) ? 'successful' : order.payment_status);

    await transaction(async (conn) => {
      // 1. Update order status and details
      const updates = ['status = ?', 'payment_status = ?'];
      const params = [status, targetPaymentStatus];

      if (notes) {
        updates.push('notes = ?');
        params.push(notes);
      }
      params.push(id);

      await conn.execute(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, params);

      // 2. If status is delivered or ready_for_collection, fulfill order & execute FEFO stock dispensing if not already fulfilled
      const invoiceNumber = `INV-${order.order_number}`;
      const [existingSale] = await conn.execute('SELECT id FROM sales WHERE invoice_number = ?', [invoiceNumber]);

      if (['delivered', 'ready_for_collection'].includes(status) && existingSale.length === 0) {
        const [orderItems] = await conn.execute(
          'SELECT oi.*, m.medicine_name FROM order_items oi JOIN medicines m ON oi.medicine_id = m.id WHERE oi.order_id = ?',
          [id]
        );

        // Insert fiscal sales invoice record
        const [saleRes] = await conn.execute(
          `INSERT INTO sales (customer_id, invoice_number, sale_date, subtotal, discount, tax, total_amount, payment_method, status)
           VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, 'completed')`,
          [
            order.customer_id,
            invoiceNumber,
            order.subtotal,
            order.discount || 0,
            order.tax || 0,
            order.total_amount,
            order.payment_method || 'cash',
          ]
        );
        const saleId = saleRes.insertId;

        // Process FEFO dispensing for each order item
        for (const item of orderItems) {
          const [batches] = await conn.execute(
            `SELECT id, batch_number, quantity, expiry_date 
             FROM medicine_batches 
             WHERE medicine_id = ? AND is_blocked = 0 AND expiry_date >= CURDATE() AND quantity > 0
             ORDER BY expiry_date ASC, id ASC FOR UPDATE`,
            [item.medicine_id]
          );

          let remainingQty = item.quantity;
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

          // Insert sale item
          await conn.execute(
            `INSERT INTO sale_items (sale_id, medicine_id, batch_id, batch_number, quantity, unit_price, subtotal)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              saleId,
              item.medicine_id,
              primaryBatchId,
              primaryBatchNumber || null,
              item.quantity,
              item.unit_price,
              item.subtotal,
            ]
          );

          // Decrement medicines master stock
          await conn.execute(
            'UPDATE medicines SET quantity = GREATEST(0, quantity - ?) WHERE id = ?',
            [item.quantity, item.medicine_id]
          );

          // Log stock movement
          await conn.execute(
            `INSERT INTO stock_movements (medicine_id, movement_type, quantity, reference_type, reference_id, notes)
             VALUES (?, 'sale', ?, 'order_fulfillment', ?, ?)`,
            [
              item.medicine_id,
              item.quantity,
              saleId,
              `Dispensed for Order #${order.order_number}${primaryBatchNumber ? ` (Batch: ${primaryBatchNumber})` : ''}`,
            ]
          );
        }

        // Record completed payment
        await conn.execute(
          `INSERT INTO payments (sale_id, amount, payment_method, payment_status)
           VALUES (?, ?, ?, 'completed')`,
          [saleId, order.total_amount, order.payment_method || 'cash']
        );

        // If prescription associated, mark as dispensed
        if (order.prescription_id) {
          await conn.execute(
            `UPDATE prescriptions 
             SET status = 'dispensed', dispensed_by = ?, dispensed_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [req.user.id, order.prescription_id]
          );
        }
      }

      // Customer friendly notification
      let msg = `Your order ${order.order_number} status is now ${status.replace(/_/g, ' ')}.`;
      if (status === 'confirmed') msg = `Your order ${order.order_number} has been verified and confirmed by the pharmacist.`;
      if (status === 'processing') msg = `Your order ${order.order_number} is being prepared at our dispensary using FEFO allocation.`;
      if (status === 'ready_for_collection') msg = `Great news! Your order ${order.order_number} is ready for pickup at our pharmacy counter. Digital invoice ${invoiceNumber} is ready.`;
      if (status === 'delivered') msg = `Your order ${order.order_number} has been delivered successfully. Digital tax invoice ${invoiceNumber} is now available in your portal!`;

      await conn.execute(
        `INSERT INTO notifications (user_id, title, message, type, link)
         VALUES (?, ?, ?, 'order', ?)`,
        [order.user_id, `Order Update: ${status.replace(/_/g, ' ').toUpperCase()}`, msg, '/customer/orders']
      );

      await logAudit(req.user.id, 'UPDATE_ORDER_STATUS', 'orders', id, {
        order_number: order.order_number,
        previous: order.status,
        next: status,
        payment_status: targetPaymentStatus,
      }, conn);
    });

    const [updated] = await query('SELECT * FROM orders WHERE id = ?', [id]);
    return ApiResponse.success(res, updated[0], `Order status updated to ${status}`);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllOrders,
  getOrderById,
  createOrder,
  cancelOrder,
  updateOrderStatus,
};
