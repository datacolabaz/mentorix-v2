const EMAIL_NOT_VERIFIED_MESSAGE =
  'E-poçt təsdiqlənməyib. Zəhmət olmasa e-poçtunuzdakı təsdiq linkinə klik edin və ya təsdiq kodunu daxil edin.';

const GOOGLE_LOGIN_REQUIRED_MESSAGE =
  'Bu hesab Google ilə yaradılıb. «Google ilə davam et» düyməsini basın — email şifrəsi bu hesabda yoxdur.';

const WRONG_PASSWORD_MESSAGE = 'Email və ya şifrə yanlışdır';
const WRONG_PASSWORD_RESET_HINT =
  'Email və ya şifrə yanlışdır. Şifrəni unutmusunuzsa, «Şifrəni unutdum» ilə bərpa edin.';

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

function looksLikeGooglePlaceholderHash(hash) {
  return /\$2[aby]?\$10\$/.test(String(hash || ''));
}

/** Email qeydiyyatı cost=12 hash saxlayır; Google INSERT isə cost=10 placeholder. */
function hasUserChosenPassword(user) {
  if (!user?.password_hash) return false;
  if (!isGoogleAuthUser(user)) return true;
  return !looksLikeGooglePlaceholderHash(user.password_hash);
}

function normalizePasswordInput(password) {
  return String(password || '').trim();
}

/**
 * Google ilə yaranmış hesabda (placeholder hash) ilk email+şifrə girişi
 * həmin şifrəni saxlayır — müəllim də daxil olmaqla.
 */
function canAdoptLoginPassword(user, password, passOk) {
  if (passOk || !user) return false;
  if (normalizePasswordInput(password).length < 8) return false;
  return !hasUserChosenPassword(user);
}

function passwordLoginFailureBody(user) {
  if (user && isGoogleAuthUser(user) && !hasUserChosenPassword(user)) {
    return googleLoginRequiredBody();
  }
  return {
    success: false,
    code: 'INVALID_CREDENTIALS',
    message: user ? WRONG_PASSWORD_RESET_HINT : WRONG_PASSWORD_MESSAGE,
  };
}

module.exports = {
  EMAIL_NOT_VERIFIED_MESSAGE,
  GOOGLE_LOGIN_REQUIRED_MESSAGE,
  WRONG_PASSWORD_MESSAGE,
  WRONG_PASSWORD_RESET_HINT,
  isGoogleAuthUser,
  isUserEmailVerified,
  emailNotVerifiedBody,
  googleLoginRequiredBody,
  looksLikeGooglePlaceholderHash,
  hasUserChosenPassword,
  normalizePasswordInput,
  canAdoptLoginPassword,
  passwordLoginFailureBody,
};
