const { verify } = require('../utils/jwt');

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token)
    return res.status(401).json({ success: false, message: 'Token yoxdur' });
  try {
    req.user = verify(token);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token etibarsızdır' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
  next();
};

module.exports = { authenticate, authorize };
