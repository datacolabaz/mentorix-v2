const fontkit = require('@pdf-lib/fontkit');
const { ensureCertificateFontsReady, readFontBytes } = require('./certificateFontAssets');

let regularBytes = null;
let boldBytes = null;
let ensurePromise = null;

function getRegularFontBytes() {
  if (!regularBytes) regularBytes = readFontBytes('NotoSans-Regular.ttf');
  return regularBytes;
}

function getBoldFontBytes() {
  if (!boldBytes) boldBytes = readFontBytes('NotoSans-Bold.ttf');
  return boldBytes;
}

function ensureFontsLoaded() {
  if (!ensurePromise) ensurePromise = ensureCertificateFontsReady();
  return ensurePromise;
}

/** pdf-lib: Azərbaycan/Türk hərfləri (ı, ə, ş, ğ, ü, ö, ç) üçün Unicode şrift */
async function embedCertificateFonts(pdf) {
  await ensureFontsLoaded();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(getRegularFontBytes(), { subset: true });
  const bold = await pdf.embedFont(getBoldFontBytes(), { subset: true });
  return { regular, bold };
}

module.exports = { embedCertificateFonts, ensureCertificateFontsReady: ensureFontsLoaded };
