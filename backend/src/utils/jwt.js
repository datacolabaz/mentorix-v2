const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;

module.exports = {
  sign: (payload, expiresIn = '7d') =>
    jwt.sign(payload, SECRET, { expiresIn }),

  signOTP: (payload) =>
    jwt.sign(payload, SECRET, { expiresIn: '30d' }),

  verify: (token) => jwt.verify(token, SECRET),
};
