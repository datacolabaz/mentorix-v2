#!/usr/bin/env node
/** Generate sample certificate PDFs for visual QA. */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { generateCertificatePdf } = require('../src/services/certificatePdfService');

async function main() {
  const outDir = path.join(__dirname, '../uploads/certificates/samples');
  fs.mkdirSync(outDir, { recursive: true });

  const base = {
    student_name: 'Aylin Məmmədova',
    course_title: 'Data Analytics Professional Certification',
    exam_title: 'Data Analytics Professional Certification',
    instructor_name: 'Mentorix Rəsmi',
    score_pct: 87,
    issued_at: new Date().toISOString(),
    certificate_no: 'MTX-2026-000001',
    verification_token: 'sample-verify-token',
    accent_color: '#00E676',
  };

  for (const template_key of ['classic', 'modern', 'minimal']) {
    for (const locale of ['az', 'ru']) {
      const buf = await generateCertificatePdf({ ...base, template_key, locale });
      const file = path.join(outDir, `sample-${template_key}-${locale}.pdf`);
      fs.writeFileSync(file, buf);
      console.log('Wrote', file);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
