const jwt = require('jsonwebtoken');

const SECRET = String(process.env.JWT_SECRET || '').trim();

if (!SECRET) {
  const msg = 'JWT_SECRET təyin olunmalıdır';
  if (process.env.NODE_ENV === 'production') {
    throw new Error(msg);
  }
  console.warn(`[jwt] WARNING: ${msg}`);
} else if (SECRET.length < 32) {
  console.warn(
    '[jwt] WARNING: JWT_SECRET ən azı 32 simvol olmalıdır — Railway Variables-da güclü secret təyin edin',
  );
}

module.exports = {
  sign: (payload, expiresIn = '7d') =>
    jwt.sign(payload, SECRET, { expiresIn }),

  signOTP: (payload) =>
    jwt.sign(payload, SECRET, { expiresIn: '30d' }),

  verify: (token) => jwt.verify(token, SECRET),
};
