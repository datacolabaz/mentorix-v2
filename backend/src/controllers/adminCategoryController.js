const {
  listAllCategoriesFlat,
  updateCategoryAdmin,
} = require('../services/categoryService');

const listCategories = async (_req, res) => {
  try {
    const categories = await listAllCategoriesFlat();
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const patchCategory = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, message: 'ID tələb olunur' });
    const category = await updateCategoryAdmin(id, {
      name_az: req.body?.name_az,
      search_aliases: req.body?.search_aliases,
      is_popular: req.body?.is_popular,
    });
    res.json({ success: true, category });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = { listCategories, patchCategory };
