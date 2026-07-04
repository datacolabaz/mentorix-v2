const path = require('path');
const { pathToFileURL } = require('url');
const { PDFDocument, rgb } = require('pdf-lib');
const QRCode = require('qrcode');
const { embedCertificateFonts } = require('./certificatePdfFonts');

let layoutModulePromise;
function loadCertificateLayout() {
  if (!layoutModulePromise) {
    const layoutPath = path.join(__dirname, '../../../shared/certificateLayout.mjs');
    layoutModulePromise = import(pathToFileURL(layoutPath).href);
  }
  return layoutModulePromise;
}

const PRIMARY = rgb(0, 0.898, 0.463);
const BG_DARK = rgb(0.075, 0.067, 0.18);
const BG_DEEP = rgb(0.043, 0.043, 0.043);
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
  const { buildCertificateViewModel, COLORS } = await loadCertificateLayout();
  const locale = data.locale === 'ru' ? 'ru' : data.locale === 'en' ? 'en' : 'az';
  const vm = buildCertificateViewModel(data, locale);
  const accent = parseHexColor(vm.accentColor);
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

  const certLabelW = font.widthOfTextAtSize(vm.certLabel, 9);
  page.drawText(vm.certLabel, {
    x: width - pad - certLabelW,
    y: contentTop + 6,
    size: 9,
    font,
    color: TEXT_DIM,
  });

  drawCenteredText(page, vm.issuedLabel, contentTop - 48, 11, fontBold, accent, width);
  drawCenteredText(page, vm.studentName, contentTop - 88, 28, fontBold, TEXT_WHITE, width);
  drawCenteredText(page, vm.courseTitle, contentTop - 118, 13, font, TEXT_MUTED, width);
  drawCenteredText(page, vm.completedLabel, contentTop - 140, 11, font, TEXT_DIM, width);

  const statsY = pad + 88;
  page.drawLine({
    start: { x: pad + 20, y: statsY + 28 },
    end: { x: width - pad - 20, y: statsY + 28 },
    thickness: 0.5,
    color: rgb(1, 1, 1),
    opacity: 0.12,
  });

  page.drawText(vm.scoreLabel, { x: pad + 24, y: statsY + 12, size: 8, font, color: TEXT_DIM });
  page.drawText(vm.scorePct, { x: pad + 24, y: statsY - 4, size: 16, font: fontBold, color: accent });

  const dateLabelW = font.widthOfTextAtSize(vm.dateLabel, 8);
  page.drawText(vm.dateLabel, {
    x: width - pad - 24 - dateLabelW,
    y: statsY + 12,
    size: 8,
    font,
    color: TEXT_DIM,
  });
  const dateW = font.widthOfTextAtSize(vm.dateFormatted, 11);
  page.drawText(vm.dateFormatted, {
    x: width - pad - 24 - dateW,
    y: statsY - 2,
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
    y: statsY - 6,
    width: qrSize + 8,
    height: qrSize + 8,
    borderColor: rgb(1, 1, 1),
    borderWidth: 1,
    opacity: 0.2,
  });
  page.drawImage(qrImage, { x: qrX, y: statsY - 2, width: qrSize, height: qrSize });

  page.drawText(vm.instructorLine, { x: pad + 24, y: pad + 58, size: 9, font, color: TEXT_DIM });
  drawCenteredText(page, vm.verifyLabel, pad + 40, 9, fontBold, accent, width);

  const disclaimerY = pad + 8;
  const certIdY = pad + 22;
  page.drawText(vm.disclaimer, { x: pad + 24, y: disclaimerY, size: 7.5, font, color: TEXT_DIM });

  const certIdW = font.widthOfTextAtSize(vm.certIdLine, 7.5);
  page.drawText(vm.certIdLine, {
    x: width - pad - 24 - certIdW,
    y: certIdY,
    size: 7.5,
    font,
    color: TEXT_DIM,
  });

  return Buffer.from(await pdf.save());
}

module.exports = { generateCertificatePdf, verifyUrl };
