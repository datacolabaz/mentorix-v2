const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err.code === '23505')
    return res.status(409).json({ success: false, message: 'Bu məlumat artıq mövcuddur' });

  if (err.code === '23503')
    return res.status(400).json({ success: false, message: 'Əlaqəli məlumat tapılmadı' });

  const status = Number(err.status || err.statusCode || 500) || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Server xətası',
    ...(err.code && typeof err.code === 'string' ? { code: err.code } : {}),
  });
};

module.exports = errorHandler;
