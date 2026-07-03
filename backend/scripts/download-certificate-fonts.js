#!/usr/bin/env node
/**
 * Sertifikat PDF üçün Noto Sans şriftlərini endirir (Azərbaycan hərfləri).
 * İstifadə: node scripts/download-certificate-fonts.js
 */
const { ensureCertificateFontsReady, FONT_DIR } = require('../src/services/certificateFontAssets');

ensureCertificateFontsReady()
  .then(() => {
    console.log('Hazırdır:', FONT_DIR);
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
