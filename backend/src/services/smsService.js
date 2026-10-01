/**
 * SMS is retired (email is the notification channel). This module keeps its old exports so any
 * forgotten import fails closed: no provider call, no network, no credentials read, no usage counter.
 * Historical sms_logs rows are kept (deprecated, see migration 228). Guarded by smsRetired.guard.test.js.
 */

const SMS_RETIRED = Object.freeze({
  success: false,
  retired: true,
  code: 'SMS_RETIRED',
  error: 'SMS bildirişləri dayandırılıb. Bildirişlər e-poçt və platforma daxilində göndərilir.',
});

function retired() {
  return { ...SMS_RETIRED };
}

async function sendSms() {
  return retired();
}

async function sendOtpSms() {
  return retired();
}

async function sendRawSms() {
  return { ok: false, httpStatus: 0, json: null, error: SMS_RETIRED.error, msisdn: null, retired: true };
}

async function fetchSmsProviderBalance() {
  return { ok: false, balance: null, retired: true, error: 'SMS provayderi istifadədən çıxarılıb' };
}

module.exports = { sendSms, sendOtpSms, sendRawSms, fetchSmsProviderBalance, SMS_RETIRED };
