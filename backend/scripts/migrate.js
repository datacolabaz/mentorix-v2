#!/usr/bin/env node
/**
 * Tətbiq olunmamış SQL migrasiyalarını ardıcıllıqla işlədir (schema_migrations cədvəli).
 * Railway / prod: start əmri əvvəl bunu çağırır — exam_files və s. avtomatik əlavə olunur.
 */
const fs = require('fs');
const path = require('path');

const envBackend = path.join(__dirname, '../.env');
const envRoot = path.join(__dirname, '../../.env');
/** Lokalda köhnə `export DATABASE_URL` .env-i kölgələyirdi — migrate həmişə fayldakı dəyəri istifadə etsin */
require('dotenv').config({ path: envBackend, override: true });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: envRoot, override: true });
}

const { Client } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '../src/models/migrations');

/** .env bəzən dırnaq və ya boşluq saxlayır — pg üçün URI təmizlənməlidir */
function normalizeDatabaseUrl(raw) {
  if (raw == null) return '';
  let s = String(raw).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function useSsl(connectionString) {
  if (!connectionString) return false;
  const u = connectionString.toLowerCase();
  if (u.includes('localhost') || u.includes('127.0.0.1')) return false;
  return { rejectUnauthorized: false };
}

/** Parol/host göstərilmir — yalnız format ipucları */
function logDatabaseUrlHints(url) {
  const u = String(url);
  const schemeEnd = u.indexOf('://');
  const atIdx = schemeEnd >= 0 ? u.indexOf('@', schemeEnd + 3) : u.indexOf('@');
  const afterAt = atIdx >= 0 ? u.slice(atIdx + 1) : '';
  const hostPortPath = afterAt.split(/[?#]/)[0] || '';
  const firstSlash = hostPortPath.indexOf('/');
  const hostPort = firstSlash >= 0 ? hostPortPath.slice(0, firstSlash) : hostPortPath;
  const hostOnly = hostPort.includes(']')
    ? hostPort.slice(0, hostPort.indexOf(']') + 1)
    : hostPort.split(':')[0] || '';

  console.error('');
  console.error('— Diaqnostika (dəyərin özü göstərilmir) —');
  console.error('Uzunluq:', u.length);
  console.error('Yeni sətir:', /[\r\n]/.test(u) ? 'VAR — .env-də URL tək sətirdə olmalıdır' : 'yoxdur');
  console.error('Boşluq/tab:', /\s/.test(u) ? 'VAR — URL-də boşluq olmamalıdır' : 'yoxdur');
  const at = (u.match(/@/g) || []).length;
  console.error('@ sayı:', at, at === 1 ? '(normal)' : '(adətən user:pass@host üçün 1 olmalıdır)');
  if (at === 1 && atIdx >= 0) {
    console.error('userinfo uzunluğu (:// ilə @ arası):', Math.max(0, atIdx - (schemeEnd + 3)));
    console.error('@ sonrası (host:port/db…) uzunluğu:', afterAt.length);
    console.error('Host boşdur?', hostOnly.length === 0 ? 'BƏLİ — jdbc: və ya @host əvvəlində səhv' : 'xeyr');
    if (hostOnly.startsWith('[') && !hostOnly.endsWith(']')) {
      console.error('IPv6: [...] mötərizəsi tam deyil.');
    }
  }
  try {
    void new URL(u);
    console.error('Node URL: parse olundu');
  } catch (err) {
    console.error('Node URL:', err.code || err.message);
  }
  console.error('');
  console.error('.env məsləhəti: URL tam sətirdə olsun. Parolda # varsa, bütün dəyəri dırnaq içində yazın:');
  console.error('  DATABASE_URL="postgresql://..."');
  console.error('Dırnaqsız .env-də # işarəsindən sonrası ŞƏRH sayılır və URL kəsilir.');
  console.error('Oxunan fayllar:', fs.existsSync(envBackend) ? envBackend : '(yox)', '|', fs.existsSync(envRoot) ? envRoot : '(yox)');
}

async function main() {
  const url = normalizeDatabaseUrl(process.env.DATABASE_URL);
  if (!url) {
    console.error('DATABASE_URL boşdur.');
    console.error('backend/.env və ya mentorix-v2/.env faylına əlavə edin, nümunə:');
    console.error('  DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME');
    console.error('Fayl yoxlaması:', fs.existsSync(envBackend) ? 'backend/.env var' : 'backend/.env YOX');
    console.error('            ', fs.existsSync(envRoot) ? 'kök .env var' : 'kök .env YOX');
    process.exit(1);
  }
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    console.error('DATABASE_URL postgresql:// və ya postgres:// ilə başlamalıdır.');
    process.exit(1);
  }

  let client;
  try {
    client = new Client({
      connectionString: url,
      ssl: useSsl(url),
    });
    await client.connect();
  } catch (e) {
    if (e && (e.code === 'ERR_INVALID_URL' || /invalid url/i.test(String(e.message || '')))) {
      console.error('DATABASE_URL etibarlı URI deyil (Invalid URL).');
      console.error('Yoxlayın: boşluq/sətır sonu, jdbc: prefiksi olmasın.');
      console.error('Parolda @ : # ? / & simvolları varsa URL-encode edin (məs. @ → %40, # → %23).');
      console.error('Nümunə: postgresql://myuser:MyP%40ss@db.example.com:5432/mydb');
      logDatabaseUrlHints(url);
      process.exit(1);
    }
    throw e;
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const { rows: applied } = await client.query('SELECT filename FROM schema_migrations');
  const done = new Set(applied.map((r) => r.filename));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const filename of files) {
    if (done.has(filename)) continue;
    const fullPath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(fullPath, 'utf8').trim();
    if (!sql) continue;

    console.log('Applying migration:', filename);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Migration failed:', filename, e.message);
      throw e;
    }
  }

  await client.end();
  console.log('Migrations OK');
}

main().catch((e) => {
  if (e && (e.code === 'ERR_INVALID_URL' || /invalid url/i.test(String(e.message || '')))) {
    console.error('DATABASE_URL etibarlı URI deyil.');
    console.error('Parolda xüsusi simvollar varsa encode edin; .env dəyərini dırnaqsız və tək sətirdə saxlayın.');
  } else {
    console.error(e);
  }
  process.exit(1);
});
