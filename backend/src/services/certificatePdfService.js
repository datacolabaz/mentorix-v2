const { PDFDocument, rgb } = require('pdf-lib');
const QRCode = require('qrcode');
const { embedCertificateFonts } = require('./certificatePdfFonts');
const { buildCertificateViewModel, COLORS } = require('../lib/certificateLayout');

const PRIMARY = rgb(0, 0.898, 0.463);
const TEXT_DARK = rgb(0.1, 0.1, 0.15);
const TEXT_BODY = rgb(0.25, 0.25, 0.3);
const TEXT_MUTED = rgb(0.4, 0.4, 0.45);
const TEXT_DIM = rgb(0.55, 0.55, 0.6);
const BORDER_LIGHT = rgb(0.85, 0.85, 0.88);
const BG_WHITE = rgb(1, 1, 1);

// IMPORTANT: QR scanners must be able to open the link.
// mentorix.az may be unresolvable, so we always use mentorix.io here.
const QR_SITE_ORIGIN = 'https://mentorix.io';

function getBaseUrl() {
  return QR_SITE_ORIGIN;
}

function verifyUrl(token) {
  return `${getBaseUrl()}/c/${encodeURIComponent(String(token))}`;
}

function parseHexColor(hex) {
  const h = String(hex || COLORS.primary).replace('#', '');
  if (h.length !== 6) return PRIMARY;
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  );
}

function drawCenteredText(page, text, y, size, font, color, width) {
  const safe = String(text || '');
  if (!safe) return;
  const tw = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, { x: width / 2 - tw / 2, y, size, font, color });
}

function drawLightBackground(page, width, height, accent, templateKey) {
  page.drawRectangle({ x: 0, y: 0, width, height, color: BG_WHITE });

  const pad = 28;
  page.drawRectangle({
    x: pad,
    y: pad,
    width: width - pad * 2,
    height: height - pad * 2,
    color: BG_WHITE,
    borderColor: templateKey === 'minimal' ? BORDER_LIGHT : accent,
    borderWidth: templateKey === 'modern' ? 4 : 2,
  });

  if (templateKey === 'modern') {
    page.drawRectangle({
      x: pad,
      y: height - pad - 50,
      width: width - pad * 2,
      height: 50,
      color: accent,
    });
  }

  page.drawRectangle({
    x: pad + 10,
    y: pad + 10,
    width: width - (pad + 10) * 2,
    height: height - (pad + 10) * 2,
    borderColor: accent,
    borderWidth: 0.75,
    opacity: 0.25,
  });
}

async function generateCertificatePdf(data) {
  const locale = data.locale === 'ru' ? 'ru' : data.locale === 'en' ? 'en' : 'az';
  const vm = buildCertificateViewModel(data, locale);
  const accent = parseHexColor(vm.accentColor);
  const templateKey = String(data.template_key || 'classic');

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const { width, height } = page.getSize();
  const { regular: font, bold: fontBold } = await embedCertificateFonts(pdf);

  drawLightBackground(page, width, height, accent, templateKey);

  const pad = 48;
  const headerY = height - pad - 24;
  const headerOnBand = templateKey === 'modern';

  if (headerOnBand) {
    page.drawText(vm.labels.brand, { x: pad, y: headerY, size: 20, font: fontBold, color: BG_WHITE });
  } else {
    const brandW = fontBold.widthOfTextAtSize(vm.labels.brand, 18);
    page.drawText(vm.labels.brand, { x: width / 2 - brandW / 2, y: headerY, size: 18, font: fontBold, color: accent });
  }

  const certLabelW = font.widthOfTextAtSize(vm.certLabel, 9);
  page.drawText(vm.certLabel, {
    x: width - pad - certLabelW,
    y: headerY + (headerOnBand ? 0 : 2),
    size: 9,
    font,
    color: headerOnBand ? rgb(1, 1, 1) : TEXT_DIM,
  });

  const titleY = headerOnBand ? height - pad - 108 : height - pad - 72;
  drawCenteredText(page, vm.issuedLabel, titleY, 11, fontBold, accent, width);
  drawCenteredText(page, vm.studentName, titleY - 40, 28, fontBold, TEXT_DARK, width);
  drawCenteredText(page, vm.courseTitle, titleY - 68, 14, font, TEXT_BODY, width);
  drawCenteredText(page, vm.completedLabel, titleY - 88, 11, font, TEXT_MUTED, width);

  if (vm.modulesLine) {
    drawCenteredText(page, vm.modulesLine, titleY - 108, 10, font, TEXT_MUTED, width);
  }

  const footerY = pad + 96;
  page.drawLine({
    start: { x: pad + 16, y: footerY + 24 },
    end: { x: width - pad - 16, y: footerY + 24 },
    thickness: 0.75,
    color: BORDER_LIGHT,
  });

  page.drawText(vm.scoreLabel, { x: pad + 24, y: footerY + 8, size: 8, font, color: TEXT_DIM });
  page.drawText(vm.scorePct, { x: pad + 24, y: footerY - 8, size: 16, font: fontBold, color: accent });

  const dateLabelW = font.widthOfTextAtSize(vm.dateLabel, 8);
  page.drawText(vm.dateLabel, {
    x: width - pad - 24 - dateLabelW,
    y: footerY + 8,
    size: 8,
    font,
    color: TEXT_DIM,
  });
  const dateW = font.widthOfTextAtSize(vm.dateFormatted, 11);
  page.drawText(vm.dateFormatted, {
    x: width - pad - 24 - dateW,
    y: footerY - 6,
    size: 11,
    font,
    color: TEXT_BODY,
  });

  const url = verifyUrl(data.verification_token);
  const qrPng = await QRCode.toBuffer(url, { type: 'png', margin: 1, width: 200, errorCorrectionLevel: 'M' });
  const qrImage = await pdf.embedPng(qrPng);
  const qrSize = 88;
  const qrX = width / 2 - qrSize / 2;
  page.drawRectangle({
    x: qrX - 6,
    y: footerY - 10,
    width: qrSize + 12,
    height: qrSize + 12,
    color: BG_WHITE,
    borderColor: BORDER_LIGHT,
    borderWidth: 1,
  });
  page.drawImage(qrImage, { x: qrX, y: footerY - 4, width: qrSize, height: qrSize });
  drawCenteredText(page, vm.verifyLabel, footerY - 22, 8, fontBold, accent, width);

  page.drawText(vm.instructorLine, { x: pad + 24, y: pad + 58, size: 9, font, color: TEXT_DIM });
  page.drawText(vm.disclaimer, { x: pad + 24, y: pad + 10, size: 7.5, font, color: TEXT_DIM });

  const certIdW = font.widthOfTextAtSize(vm.certIdLine, 7.5);
  page.drawText(vm.certIdLine, {
    x: width - pad - 24 - certIdW,
    y: pad + 22,
    size: 7.5,
    font,
    color: TEXT_DIM,
  });

  if (vm.serialLine) {
    const serialW = font.widthOfTextAtSize(vm.serialLine, 8);
    page.drawText(vm.serialLine, {
      x: width - pad - 24 - serialW,
      y: pad + 10,
      size: 8,
      font: fontBold,
      color: TEXT_BODY,
    });
  }

  return Buffer.from(await pdf.save());
}

module.exports = { generateCertificatePdf, verifyUrl };
