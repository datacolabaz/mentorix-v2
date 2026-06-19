const { runUniversityProgramAiSearch } = require('../services/universityProgramAiSearchService');

const postProgramAiSearch = async (req, res) => {
  try {
    const query = String(req.body?.query || '').trim();
    if (!query) {
      return res.status(400).json({ success: false, message: 'Sorğu mətni tələb olunur' });
    }
    const limit = Math.min(50, Math.max(1, parseInt(req.body?.limit, 10) || 24));
    const result = await runUniversityProgramAiSearch({ query, limit });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'AI axtarış uğursuz oldu',
    });
  }
};

module.exports = { postProgramAiSearch };
