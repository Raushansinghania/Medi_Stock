const { query } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/audit');

const getAllExpenses = async (req, res, next) => {
  try {
    const { category, from_date, to_date, search } = req.query;
    let sql = 'SELECT * FROM expenses';
    const conditions = [];
    const params = [];

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (from_date) {
      conditions.push('expense_date >= ?');
      params.push(from_date);
    }
    if (to_date) {
      conditions.push('expense_date <= ?');
      params.push(to_date);
    }
    if (search) {
      conditions.push('(expense_title LIKE ? OR description LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY expense_date DESC, id DESC';

    const [rows] = await query(sql, params);
    return ApiResponse.success(res, rows, 'Expenses retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getExpenseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await query('SELECT * FROM expenses WHERE id = ?', [id]);
    if (rows.length === 0) {
      throw ApiError.notFound('Expense not found');
    }
    return ApiResponse.success(res, rows[0], 'Expense retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const createExpense = async (req, res, next) => {
  try {
    const { expense_title, category, amount, expense_date, description } = req.body;

    if (!expense_title || !expense_title.trim()) {
      throw ApiError.badRequest('Expense title is required');
    }
    if (!category || !category.trim()) {
      throw ApiError.badRequest('Category is required');
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw ApiError.badRequest('Valid amount greater than zero is required');
    }

    const today = new Date().toISOString().slice(0, 10);
    const dateVal = expense_date || today;

    const [result] = await query(
      `INSERT INTO expenses (expense_title, category, amount, expense_date, description)
       VALUES (?, ?, ?, ?, ?)`,
      [
        expense_title.trim(),
        category.trim(),
        numAmount,
        dateVal,
        description ? description.trim() : null,
      ]
    );

    const newExpense = {
      id: result.insertId,
      expense_title: expense_title.trim(),
      category: category.trim(),
      amount: numAmount,
      expense_date: dateVal,
      description: description ? description.trim() : null,
    };

    await logAudit(req.user?.id, 'CREATE_EXPENSE', 'expenses', result.insertId, newExpense);

    return ApiResponse.created(res, newExpense, 'Expense recorded successfully');
  } catch (error) {
    next(error);
  }
};

const updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { expense_title, category, amount, expense_date, description } = req.body;

    const [existing] = await query('SELECT * FROM expenses WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('Expense not found');
    }

    const updates = [];
    const params = [];

    if (expense_title !== undefined) {
      updates.push('expense_title = ?');
      params.push(expense_title.trim());
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category.trim());
    }
    if (amount !== undefined) {
      const a = Number(amount);
      if (isNaN(a) || a <= 0) throw ApiError.badRequest('Valid positive amount is required');
      updates.push('amount = ?');
      params.push(a);
    }
    if (expense_date !== undefined) {
      updates.push('expense_date = ?');
      params.push(expense_date);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description ? description.trim() : null);
    }

    if (updates.length === 0) {
      throw ApiError.badRequest('No update data provided');
    }

    params.push(id);
    await query(`UPDATE expenses SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated] = await query('SELECT * FROM expenses WHERE id = ?', [id]);
    await logAudit(req.user?.id, 'UPDATE_EXPENSE', 'expenses', id, updated[0]);

    return ApiResponse.success(res, updated[0], 'Expense updated successfully');
  } catch (error) {
    next(error);
  }
};

const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [existing] = await query('SELECT * FROM expenses WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('Expense not found');
    }

    await query('DELETE FROM expenses WHERE id = ?', [id]);
    await logAudit(req.user?.id, 'DELETE_EXPENSE', 'expenses', id, { title: existing[0].expense_title });

    return ApiResponse.success(res, null, 'Expense deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
};
