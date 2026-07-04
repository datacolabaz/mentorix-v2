#!/usr/bin/env node
/** Visual QA: RU category names after name_ru backfill (offline demo). */
const { CATEGORY_TRANSLATIONS } = require('./catalogTranslationMap');
const { localizedField } = require('../src/lib/catalogI18n');

const PARENT_SLUGS = [
  'beynelxalq-imtahanlar',
  'it-proqramlasdirma',
  'data-analytics',
  'cloud-devops',
  'cyber-security',
  'biznes-idareetme',
  'ofis-bacariqlari',
  'dizayn',
  'reqemsal-marketinq',
  'maliyye-muhasibat',
  'diger-bacariqlar',
];

const rows = PARENT_SLUGS.map((slug) => {
  const m = CATEGORY_TRANSLATIONS[slug];
  const row = { name: m.az, name_ru: m.ru, slug };
  return {
    slug,
    az: localizedField(row, 'az', 'name'),
    ru: localizedField(row, 'ru', 'name'),
  };
});

const cards = rows
  .map(
    (r) => `
    <div class="card">
      <div class="slug">${r.slug}</div>
      <div class="name">${r.ru}</div>
    </div>`,
  )
  .join('');

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <title>RU kateqoriya adları — QA</title>
  <style>
    body { background:#0b0b0b; color:#eee; font-family: system-ui, sans-serif; padding:24px; }
    h1 { color:#00E676; font-size:20px; }
    p { color:#888; font-size:13px; }
    .grid { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:12px; max-width:720px; }
    .card { border:1px solid rgba(0,229,118,.35); background:#121212; border-radius:12px; padding:16px; }
    .slug { font-size:10px; color:#666; margin-bottom:6px; }
    .name { font-size:14px; font-weight:600; color:#fff; }
  </style>
</head>
<body>
  <h1>Sertifikatlı İmtahanlar — RU kateqoriya kartları</h1>
  <p>API ?lang=ru → name_ru sütunu (11 parent kateqoriya)</p>
  <div class="grid">${cards}</div>
</body>
</html>`;

const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, '../uploads/qa-ru-categories.html');
fs.writeFileSync(out, html);
console.log('Wrote', out);
