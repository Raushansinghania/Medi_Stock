const { query } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { logAudit } = require('../utils/audit');

const getAllCategories = async (req, res, next) => {
  try {
    const [categories] = await query(`
      SELECT c.*, COUNT(m.id) AS medicine_count
      FROM categories c
      LEFT JOIN medicines m ON c.category_name = m.category
      GROUP BY c.id
      ORDER BY c.category_name ASC
    `);
    return ApiResponse.success(res, categories, 'Categories fetched successfully');
  } catch (error) {
    next(error);
  }
};

const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await query('SELECT * FROM categories WHERE id = ?', [id]);
    if (rows.length === 0) {
      throw ApiError.notFound('Category not found');
    }
    return ApiResponse.success(res, rows[0], 'Category retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const { category_name, description } = req.body;
    if (!category_name || !category_name.trim()) {
      throw ApiError.badRequest('Category name is required');
    }

    const trimmedName = category_name.trim();
    const [existing] = await query('SELECT id FROM categories WHERE category_name = ?', [trimmedName]);
    if (existing.length > 0) {
      throw ApiError.conflict(`Category '${trimmedName}' already exists`);
    }

    const [result] = await query(
      'INSERT INTO categories (category_name, description) VALUES (?, ?)',
      [trimmedName, description ? description.trim() : null]
    );

    const newCategory = {
      id: result.insertId,
      category_name: trimmedName,
      description: description ? description.trim() : null,
    };

    await logAudit(req.user?.id, 'CREATE_CATEGORY', 'categories', result.insertId, newCategory);

    return ApiResponse.created(res, newCategory, 'Category created successfully');
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category_name, description } = req.body;

    const [existing] = await query('SELECT * FROM categories WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('Category not found');
    }

    const updates = [];
    const params = [];

    if (category_name) {
      const trimmedName = category_name.trim();
      const [duplicate] = await query('SELECT id FROM categories WHERE category_name = ? AND id != ?', [trimmedName, id]);
      if (duplicate.length > 0) {
        throw ApiError.conflict(`Category '${trimmedName}' already exists`);
      }
      updates.push('category_name = ?');
      params.push(trimmedName);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description ? description.trim() : null);
    }

    if (updates.length === 0) {
      throw ApiError.badRequest('No update data provided');
    }

    params.push(id);
    await query(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated] = await query('SELECT * FROM categories WHERE id = ?', [id]);

    await logAudit(req.user?.id, 'UPDATE_CATEGORY', 'categories', id, updated[0]);

    return ApiResponse.success(res, updated[0], 'Category updated successfully');
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [existing] = await query('SELECT * FROM categories WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('Category not found');
    }

    await query('DELETE FROM categories WHERE id = ?', [id]);
    await logAudit(req.user?.id, 'DELETE_CATEGORY', 'categories', id, { name: existing[0].category_name });

    return ApiResponse.success(res, null, 'Category deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
