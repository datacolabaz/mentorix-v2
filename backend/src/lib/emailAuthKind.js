const EMAIL_NOT_VERIFIED_MESSAGE =
  'E-poçt təsdiqlənməyib. Zəhmət olmasa e-poçtunuzdakı təsdiq linkinə klik edin və ya təsdiq kodunu daxil edin.';

const GOOGLE_LOGIN_REQUIRED_MESSAGE =
  'Bu hesab Google ilə yaradılıb. Email kodu lazım deyil — «Google ilə davam et» düyməsini basın.';

function isGoogleAuthUser(user) {
  if (!user) return false;
  if (String(user.google_sub || '').trim()) return true;
  return String(user.auth_provider || '').toLowerCase() === 'google';
}

function isUserEmailVerified(user) {
  if (!user) return false;
  if (isGoogleAuthUser(user)) return true;
  return user.is_verified !== false;
}

function emailNotVerifiedBody() {
  return {
    success: false,
    code: 'EMAIL_NOT_VERIFIED',
    message: EMAIL_NOT_VERIFIED_MESSAGE,
  };
}

function googleLoginRequiredBody() {
  return {
    success: false,
    code: 'GOOGLE_LOGIN_REQUIRED',
    message: GOOGLE_LOGIN_REQUIRED_MESSAGE,
  };
}

module.exports = {
  EMAIL_NOT_VERIFIED_MESSAGE,
  GOOGLE_LOGIN_REQUIRED_MESSAGE,
  isGoogleAuthUser,
  isUserEmailVerified,
  emailNotVerifiedBody,
  googleLoginRequiredBody,
};
