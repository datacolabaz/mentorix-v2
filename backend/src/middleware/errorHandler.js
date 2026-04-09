const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err.code === '23505')
    return res.status(409).json({ success: false, message: 'Bu məlumat artıq mövcuddur' });

  if (err.code === '23503')
    return res.status(400).json({ success: false, message: 'Əlaqəli məlumat tapılmadı' });

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server xətası',
  });
};

module.exports = errorHandler;
