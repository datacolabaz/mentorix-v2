const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');

function getBaseUrl() {
  const base = String(process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || 'https://mentorix.az').trim();
  return base.replace(/\/+$/, '');
}

function verifyUrl(token) {
  return `${getBaseUrl()}/c/${encodeURIComponent(String(token))}`;
}

function formatDate(iso, locale = 'az') {
  try {
    return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'az-AZ', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return String(iso || '').slice(0, 10);
  }
}

function labels(locale) {
  if (locale === 'en') {
    return {
      brand: 'Mentorix',
      title: 'Certificate of Completion',
      certifies: 'This certifies that',
      completed: 'has successfully completed',
      instructor: 'Instructor',
      score: 'Score',
      date: 'Completion Date',
      certId: 'Certificate ID',
      disclaimer: 'This is not an official government accreditation.',
    };
  }
  return {
    brand: 'Mentorix',
    title: 'Tamamlama Sertifikatı',
    certifies: 'Bu sənəd təsdiq edir ki',
    completed: 'uğurla tamamlamışdır',
    instructor: 'Müəllim',
    score: 'Bal',
    date: 'Tamamlama tarixi',
    certId: 'Sertifikat ID',
    disclaimer: 'Bu rəsmi dövlət akkreditasiyası deyil.',
  };
}

function parseHexColor(hex) {
  const h = String(hex || '#4f46e5').replace('#', '');
  if (h.length !== 6) return rgb(0.31, 0.27, 0.9);
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  );
}

async function generateCertificatePdf(data) {
  const locale = data.locale === 'en' ? 'en' : 'az';
  const L = labels(locale);
  const accent = parseHexColor(data.accent_color);
  const templateKey = String(data.template_key || 'classic');

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({
    x: 28,
    y: 28,
    width: width - 56,
    height: height - 56,
    borderColor: templateKey === 'minimal' ? rgb(0.85, 0.85, 0.88) : accent,
    borderWidth: templateKey === 'modern' ? 4 : 2,
    color: rgb(1, 1, 1),
  });

  if (templateKey === 'modern') {
    page.drawRectangle({ x: 28, y: height - 78, width: width - 56, height: 50, color: accent });
    page.drawText(L.brand, { x: 48, y: height - 62, size: 22, font: fontBold, color: rgb(1, 1, 1) });
  } else {
    const brandW = fontBold.widthOfTextAtSize(L.brand, 18);
    page.drawText(L.brand, { x: width / 2 - brandW / 2, y: height - 72, size: 18, font: fontBold, color: accent });
  }

  const titleY = templateKey === 'modern' ? height - 130 : height - 110;
  const titleW = fontBold.widthOfTextAtSize(L.title, 26);
  page.drawText(L.title, { x: width / 2 - titleW / 2, y: titleY, size: 26, font: fontBold, color: rgb(0.12, 0.12, 0.18) });

  const certW = font.widthOfTextAtSize(L.certifies, 12);
  page.drawText(L.certifies, { x: width / 2 - certW / 2, y: titleY - 44, size: 12, font, color: rgb(0.4, 0.4, 0.45) });

  const studentName = String(data.student_name || '—');
  const nameW = fontBold.widthOfTextAtSize(studentName, 28);
  page.drawText(studentName, { x: width / 2 - nameW / 2, y: titleY - 82, size: 28, font: fontBold, color: rgb(0.1, 0.1, 0.15) });

  const courseTitle = String(data.course_title || data.exam_title || '—');
  const line1 = L.completed;
  const line2 = courseTitle;
  let cy = titleY - 118;
  for (const line of [line1, line2]) {
    const lw = font.widthOfTextAtSize(line, 14);
    page.drawText(line, { x: width / 2 - lw / 2, y: cy, size: 14, font, color: rgb(0.25, 0.25, 0.3) });
    cy -= 20;
  }

  const meta = [
    `${L.instructor}: ${String(data.instructor_name || '—')}`,
    `${L.score}: ${Number(data.score_pct || 0).toFixed(0)}%`,
    `${L.date}: ${formatDate(data.issued_at, locale)}`,
    `${L.certId}: ${String(data.certificate_no || '—')}`,
  ];
  meta.forEach((line, i) => {
    page.drawText(line, { x: 72, y: 120 - i * 22, size: 11, font, color: rgb(0.35, 0.35, 0.4) });
  });
  page.drawText(L.disclaimer, { x: 72, y: 52, size: 8, font, color: rgb(0.55, 0.55, 0.6) });

  const url = verifyUrl(data.verification_token);
  const qrPng = await QRCode.toBuffer(url, { type: 'png', margin: 1, width: 140, errorCorrectionLevel: 'M' });
  const qrImage = await pdf.embedPng(qrPng);
  const qrSize = 96;
  page.drawImage(qrImage, { x: width - 72 - qrSize, y: 72, width: qrSize, height: qrSize });

  return Buffer.from(await pdf.save());
}

module.exports = { generateCertificatePdf, verifyUrl };
