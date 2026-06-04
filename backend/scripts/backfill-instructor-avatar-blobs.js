#!/usr/bin/env node
/**
 * Diskdə qalan profil şəkillərini DB-yə köçürür (bir dəfəlik).
 * Usage: node scripts/backfill-instructor-avatar-blobs.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const {
  uploadsDir,
  isSafeAvatarFilename,
  persistAvatarBlob,
} = require('../src/services/instructorAvatarStorage');

async function main() {
  if (!fs.existsSync(uploadsDir)) {
    console.log('Uploads qovluğu yoxdur:', uploadsDir);
    process.exit(0);
  }
  const files = fs.readdirSync(uploadsDir);
  let ok = 0;
  for (const name of files) {
    if (!isSafeAvatarFilename(name)) continue;
    const abs = path.join(uploadsDir, name);
    const buf = fs.readFileSync(abs);
    const ext = path.extname(name).toLowerCase();
    const ct = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    await persistAvatarBlob(name, buf, ct);
    ok += 1;
    console.log('OK', name);
  }
  console.log(`Bitdi: ${ok} şəkil DB-yə yazıldı`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
