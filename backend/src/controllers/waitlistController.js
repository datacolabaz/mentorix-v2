const { subscribeWaitlist, getAdminWaitlistStats } = require('../services/catalogWaitlistService');

async function postPublicWaitlist(req, res) {
  try {
    const email = req.body?.email;
    const categoryId = req.body?.category_id || null;
    const categorySlug =
      req.body?.category_slug || req.body?.category || req.query?.category_slug || null;

    const result = await subscribeWaitlist({ email, categoryId, categorySlug });

    res.json({
      success: true,
      message: result.category_name
        ? `«${result.category_name}» kateqoriyasında yeni imtahan əlavə olunanda email göndərəcəyik.`
        : 'Yeni imtahanlar əlavə olunanda email göndərəcəyik.',
      waitlist: result,
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Xəta' });
  }
}

async function getAdminWaitlistDemand(req, res) {
  try {
    const categories = await getAdminWaitlistStats();
    const total = categories.reduce((n, c) => n + Number(c.pending_count || 0), 0);
    res.json({ success: true, total_pending: total, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
}

module.exports = { postPublicWaitlist, getAdminWaitlistDemand };
