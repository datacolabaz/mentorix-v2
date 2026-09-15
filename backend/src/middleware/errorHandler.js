const { toClientSafeError, isPostgresError } = require('../lib/clientSafeError');

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err.code === '23505')
    return res.status(409).json({ success: false, message: 'Bu məlumat artıq mövcuddur' });

  if (err.code === '23503')
    return res.status(400).json({ success: false, message: 'Əlaqəli məlumat tapılmadı' });

  if (isPostgresError(err)) {
    const safe = toClientSafeError(err);
    return res.status(safe.status).json({ success: false, message: safe.message, code: safe.code });
  }

  const status = Number(err.status || err.statusCode || 500) || 500;
  if (status >= 500) {
    const safe = toClientSafeError(err);
    return res.status(safe.status).json({ success: false, message: safe.message, code: safe.code });
  }

  res.status(status).json({
    success: false,
    message: err.message || 'Server xətası',
    ...(err.code && typeof err.code === 'string' ? { code: err.code } : {}),
  });
};

module.exports = errorHandler;
