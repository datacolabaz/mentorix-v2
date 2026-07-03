const fs = require('fs');
const https = require('https');
const path = require('path');

const FONT_DIR = path.join(__dirname, '../../assets/fonts');

const FONTS = [
  {
    name: 'NotoSans-Regular.ttf',
    url: 'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
  },
  {
    name: 'NotoSans-Bold.ttf',
    url: 'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf',
  },
];

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return download(res.headers.location).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

function fontPath(name) {
  return path.join(FONT_DIR, name);
}

function fontReady(name) {
  const filePath = fontPath(name);
  return fs.existsSync(filePath) && fs.statSync(filePath).size > 10_000;
}

async function ensureCertificateFontsReady() {
  fs.mkdirSync(FONT_DIR, { recursive: true });
  for (const font of FONTS) {
    if (fontReady(font.name)) continue;
    const buf = await download(font.url);
    fs.writeFileSync(fontPath(font.name), buf);
  }
}

function readFontBytes(filename) {
  const filePath = fontPath(filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Sertifikat şrifti tapılmadı: ${filename}`);
  }
  return fs.readFileSync(filePath);
}

module.exports = {
  FONT_DIR,
  FONTS,
  ensureCertificateFontsReady,
  readFontBytes,
};
