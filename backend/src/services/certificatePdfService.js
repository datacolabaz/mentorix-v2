const { PDFDocument, rgb } = require('pdf-lib');
const QRCode = require('qrcode');
const { embedCertificateFonts } = require('./certificatePdfFonts');

const PRIMARY = rgb(0, 0.898, 0.463); // #00E676
const BG_DARK = rgb(0.075, 0.067, 0.18); // #13112e
const BG_DEEP = rgb(0.043, 0.043, 0.043); // #0b0b0b
const TEXT_WHITE = rgb(0.96, 0.96, 0.98);
const TEXT_MUTED = rgb(0.55, 0.58, 0.65);
const TEXT_DIM = rgb(0.38, 0.4, 0.48);

function getBaseUrl() {
  const base = String(process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || 'https://mentorix.az').trim();
  return base.replace(/\/+$/, '');
}

function verifyUrl(token) {
  return `${getBaseUrl()}/c/${encodeURIComponent(String(token))}`;
}

function formatDate(iso, locale = 'az') {
  const loc = locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-GB' : 'az-AZ';
  try {
    return new Date(iso).toLocaleDateString(loc, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return String(iso || '').slice(0, 10);
  }
}

function labels(locale) {
  if (locale === 'ru') {
    return {
      brand: 'Mentorix',
      certLabel: 'Mentorix Certificate',
      issued: 'Сертификат выдаётся',
      completed: 'успешно завершил(а)',
      instructor: 'Преподаватель',
      score: 'Балл',
      date: 'Дата',
      certId: 'ID сертификата',
      verify: 'Проверяется по QR-коду',
      disclaimer: 'Это не официальная государственная аккредитация.',
    };
  }
  if (locale === 'en') {
    return {
      brand: 'Mentorix',
      certLabel: 'Mentorix Certificate',
      issued: 'Certificate of Achievement',
      completed: 'has successfully completed',
      instructor: 'Instructor',
      score: 'Score',
      date: 'Date',
      certId: 'Certificate ID',
      verify: 'Verified via QR code',
      disclaimer: 'This is not an official government accreditation.',
    };
  }
  return {
    brand: 'Mentorix',
    certLabel: 'Mentorix Certificate',
    issued: 'Sertifikat verilir',
    completed: 'uğurla tamamlamışdır',
    instructor: 'Müəllim',
    score: 'Bal',
    date: 'Tarix',
    certId: 'Sertifikat ID',
    verify: 'QR kodu ilə doğrulanır',
    disclaimer: 'Bu rəsmi dövlət akkreditasiyası deyil.',
  };
}

function parseHexColor(hex) {
  const h = String(hex || '#00E676').replace('#', '');
  if (h.length !== 6) return PRIMARY;
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  );
}

function drawCenteredText(page, text, y, size, font, color, width) {
  const tw = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: width / 2 - tw / 2, y, size, font, color });
}

function drawDarkBackground(page, width, height, accent, templateKey) {
  page.drawRectangle({ x: 0, y: 0, width, height, color: BG_DEEP });

  const pad = 24;
  page.drawRectangle({
    x: pad,
    y: pad,
    width: width - pad * 2,
    height: height - pad * 2,
    color: BG_DARK,
    borderColor: templateKey === 'minimal' ? rgb(0.35, 0.35, 0.4) : accent,
    borderWidth: templateKey === 'modern' ? 3 : 2,
  });

  if (templateKey === 'modern') {
    page.drawRectangle({
      x: pad,
      y: height - pad - 44,
      width: width - pad * 2,
      height: 44,
      color: accent,
      opacity: 0.15,
    });
  }

  page.drawRectangle({
    x: pad + 8,
    y: pad + 8,
    width: width - (pad + 8) * 2,
    height: height - (pad + 8) * 2,
    borderColor: accent,
    borderWidth: templateKey === 'minimal' ? 0.5 : 1,
    opacity: 0.35,
  });
}

async function generateCertificatePdf(data) {
  const locale = data.locale === 'ru' ? 'ru' : data.locale === 'en' ? 'en' : 'az';
  const L = labels(locale);
  const accent = parseHexColor(data.accent_color || '#00E676');
  const templateKey = String(data.template_key || 'classic');

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const { width, height } = page.getSize();
  const { regular: font, bold: fontBold } = await embedCertificateFonts(pdf);

  drawDarkBackground(page, width, height, accent, templateKey);

  const pad = 48;
  const contentTop = height - pad - 20;

  page.drawRectangle({
    x: pad,
    y: contentTop - 4,
    width: 32,
    height: 32,
    color: rgb(accent.red * 0.15 + 0.05, accent.green * 0.15 + 0.05, accent.blue * 0.15 + 0.08),
    borderColor: accent,
    borderWidth: 1,
  });
  page.drawText('M', { x: pad + 10, y: contentTop + 4, size: 16, font: fontBold, color: accent });

  const certLabelW = font.widthOfTextAtSize(L.certLabel, 9);
  page.drawText(L.certLabel, {
    x: width - pad - certLabelW,
    y: contentTop + 6,
    size: 9,
    font,
    color: TEXT_DIM,
  });

  const issuedSize = 11;
  drawCenteredText(page, L.issued.toUpperCase(), contentTop - 48, issuedSize, fontBold, accent, width);

  const studentName = String(data.student_name || '—');
  drawCenteredText(page, studentName, contentTop - 88, 28, fontBold, TEXT_WHITE, width);

  const courseTitle = String(data.course_title || data.exam_title || '—');
  drawCenteredText(page, courseTitle, contentTop - 118, 13, font, TEXT_MUTED, width);

  const completedLine = L.completed;
  drawCenteredText(page, completedLine, contentTop - 140, 11, font, TEXT_DIM, width);

  const footerY = pad + 52;
  page.drawLine({
    start: { x: pad + 20, y: footerY + 28 },
    end: { x: width - pad - 20, y: footerY + 28 },
    thickness: 0.5,
    color: rgb(1, 1, 1),
    opacity: 0.12,
  });

  const scorePct = `${Number(data.score_pct || 0).toFixed(0)}%`;
  page.drawText(L.score.toUpperCase(), { x: pad + 24, y: footerY + 12, size: 8, font, color: TEXT_DIM });
  page.drawText(scorePct, { x: pad + 24, y: footerY - 4, size: 16, font: fontBold, color: accent });

  const dateStr = formatDate(data.issued_at, locale);
  const dateLabelW = font.widthOfTextAtSize(L.date.toUpperCase(), 8);
  page.drawText(L.date.toUpperCase(), {
    x: width - pad - 24 - dateLabelW,
    y: footerY + 12,
    size: 8,
    font,
    color: TEXT_DIM,
  });
  const dateW = font.widthOfTextAtSize(dateStr, 11);
  page.drawText(dateStr, {
    x: width - pad - 24 - dateW,
    y: footerY - 2,
    size: 11,
    font,
    color: TEXT_MUTED,
  });

  const url = verifyUrl(data.verification_token);
  const qrPng = await QRCode.toBuffer(url, { type: 'png', margin: 1, width: 160, errorCorrectionLevel: 'M' });
  const qrImage = await pdf.embedPng(qrPng);
  const qrSize = 64;
  const qrX = width / 2 - qrSize / 2;
  page.drawRectangle({
    x: qrX - 4,
    y: footerY - 6,
    width: qrSize + 8,
    height: qrSize + 8,
    borderColor: rgb(1, 1, 1),
    borderWidth: 1,
    opacity: 0.2,
  });
  page.drawImage(qrImage, { x: qrX, y: footerY - 2, width: qrSize, height: qrSize });

  const instructorLine = `${L.instructor}: ${String(data.instructor_name || '—')}`;
  page.drawText(instructorLine, { x: pad + 24, y: pad + 36, size: 9, font, color: TEXT_DIM });

  const verifyW = fontBold.widthOfTextAtSize(L.verify, 9);
  drawCenteredText(page, L.verify, pad + 18, 9, fontBold, accent, width);

  const disclaimerY = pad + 4;
  page.drawText(L.disclaimer, { x: pad + 24, y: disclaimerY, size: 7.5, font, color: TEXT_DIM });

  const certIdText = `${L.certId}: ${String(data.certificate_no || '—')}`;
  const certIdW = font.widthOfTextAtSize(certIdText, 7.5);
  page.drawText(certIdText, {
    x: width - pad - 24 - certIdW,
    y: disclaimerY,
    size: 7.5,
    font,
    color: TEXT_DIM,
  });

  return Buffer.from(await pdf.save());
}

module.exports = { generateCertificatePdf, verifyUrl };
