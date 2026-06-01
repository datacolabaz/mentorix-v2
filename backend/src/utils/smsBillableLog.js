/**
 * SMS limiti yalnız həqiqətən provayderə gedən SMS-lər üçün sayılır.
 * sms_logs-da "sent" yazılıb amma sayğac artmayan köhnə yollar üçün filtr.
 */

const BILLABLE_TYPE_BLOCKLIST = new Set([
  'payment',
  'payment_confirm',
  'payment_receipt',
  'payment_logged',
]);

function isBillableSmsLogRow(row) {
  const st = String(row?.status || '').trim().toLowerCase();
  if (st !== 'sent') return false;

  const pkg = String(row?.package_type || '').trim().toLowerCase();
  if (pkg === 'whatsapp') return false;

  const typ = String(row?.type || '').trim().toLowerCase();
  if (BILLABLE_TYPE_BLOCKLIST.has(typ)) return false;

  // Köhnə ödəniş qeydləri: SMS göndərilməyib, yalnız jurnal.
  if (typ === 'payment' && /ödəniş təsdiqləndi|odenis tesdiqlendi/i.test(String(row?.message || ''))) {
    return false;
  }

  // Provayder izi olmayan "sent" (migration / əl ilə) — limitə sayılmasın.
  const hasProviderTrace =
    row?.http_status != null ||
    row?.msisdn != null ||
    row?.provider != null ||
    row?.delivered_at != null;
  if (!hasProviderTrace) return false;

  return true;
}

/**
 * @param {import('pg').PoolClient | import('pg').Pool} dbConn
 * @param {string} instructorId
 * @param {string} periodYm YYYY-MM (Baku)
 */
async function countBillableSmsForPeriod(dbConn, instructorId, periodYm) {
  const ym = String(periodYm || '').trim();
  if (!/^\d{4}-\d{2}$/.test(ym)) return 0;

  const { rows } = await dbConn.query(
    `SELECT status, type, package_type, message, http_status, msisdn, provider, delivered_at
     FROM sms_logs
     WHERE instructor_id = $1
       AND to_char(
             COALESCE(created_at, sent_at, delivered_at) AT TIME ZONE 'Asia/Baku',
             'YYYY-MM'
           ) = $2`,
    [instructorId, ym],
  );

  let n = 0;
  for (const r of rows) {
    if (isBillableSmsLogRow(r)) n += 1;
  }
  return n;
}

/** SQL: həqiqi provayder SMS-i (sms_logs alias: sl). */
const BILLABLE_SENT_WHERE = `
  LOWER(TRIM(sl.status)) = 'sent'
  AND COALESCE(LOWER(sl.package_type), '') <> 'whatsapp'
  AND COALESCE(LOWER(sl.type), '') NOT IN ('payment', 'payment_confirm', 'payment_receipt', 'payment_logged')
  AND NOT (
    COALESCE(LOWER(sl.type), '') = 'payment'
    AND (sl.message ~* 'ödəniş təsdiqləndi|odenis tesdiqlendi')
  )
  AND (
    sl.http_status IS NOT NULL
    OR sl.msisdn IS NOT NULL
    OR sl.provider IS NOT NULL
    OR sl.delivered_at IS NOT NULL
  )
`;

function mapSmsLogDisplayStatus(row) {
  const stRaw = String(row?.status || '').trim();
  const stLow = stRaw.toLowerCase();
  if (stLow === 'whatsapp' || String(row?.package_type || '').toLowerCase() === 'whatsapp') {
    return 'whatsapp';
  }
  if (stLow === 'logged' || stLow === 'note') return 'logged';
  if (stRaw === 'failed' || stLow.startsWith('failed:')) return 'failed';
  if (stLow === 'pending') return 'pending';
  if (stLow === 'scheduled') return 'scheduled';
  if (stLow === 'sent') return isBillableSmsLogRow(row) ? 'sent' : 'logged';
  return 'logged';
}

module.exports = {
  isBillableSmsLogRow,
  countBillableSmsForPeriod,
  mapSmsLogDisplayStatus,
  BILLABLE_TYPE_BLOCKLIST,
  BILLABLE_SENT_WHERE,
};
