#!/usr/bin/env node
/**
 * Regenerate certificate PDF (white layout) and optionally resend email.
 * Usage: node scripts/regenerate-certificate.js <certificate_no|student_name_substring> [--email]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), override: true });

const db = require('../src/utils/db');
const {
  regenerateCertificatePdfForExisting,
  resendCertificateEmailToStudent,
} = require('../src/services/certificateService');

async function main() {
  const arg = process.argv[2];
  const sendEmail = process.argv.includes('--email');
  if (!arg) {
    console.error('Usage: node scripts/regenerate-certificate.js <certificate_no|name> [--email]');
    process.exit(1);
  }

  const { rows } = await db.query(
    `SELECT c.id, c.certificate_no, u.full_name, u.email
     FROM certificates c
     JOIN users u ON u.id = c.student_id
     WHERE c.status = 'issued'
       AND (c.certificate_no = $1 OR u.full_name ILIKE $2)
     ORDER BY c.issued_at DESC
     LIMIT 1`,
    [arg, `%${arg}%`],
  );
  const row = rows[0];
  if (!row) {
    console.error('Sertifikat tapılmadı:', arg);
    process.exit(1);
  }

  const result = await regenerateCertificatePdfForExisting(row.id);
  if (!result) {
    console.error('PDF yenilənmədi');
    process.exit(1);
  }
  console.log('PDF yeniləndi:', row.certificate_no, row.full_name);

  if (sendEmail) {
    const emailResult = await resendCertificateEmailToStudent(row.id, result.student_id);
    console.log('Email:', emailResult);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
