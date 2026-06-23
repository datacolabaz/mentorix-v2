const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;

if (!SECRET || String(SECRET).length < 32) {
  const msg = 'JWT_SECRET təyin olunmalıdır və ən azı 32 simvol olmalıdır';
  if (process.env.NODE_ENV === 'production') {
    throw new Error(msg);
  }
  console.warn(`[jwt] WARNING: ${msg}`);
}

module.exports = {
  sign: (payload, expiresIn = '7d') =>
    jwt.sign(payload, SECRET, { expiresIn }),

  signOTP: (payload) =>
    jwt.sign(payload, SECRET, { expiresIn: '30d' }),

  verify: (token) => jwt.verify(token, SECRET),
};
