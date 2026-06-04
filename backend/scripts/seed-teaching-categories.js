#!/usr/bin/env node
/**
 * Idempotent seed for categories table from src/data/teachingCategories.js
 * Usage: node backend/scripts/seed-teaching-categories.js
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env'), override: true });
}

const { Client } = require('pg');
const { flattenTeachingCategories } = require('../src/data/teachingCategories');

function useSsl(connectionString) {
  if (!connectionString) return false;
  const u = connectionString.toLowerCase();
  if (u.includes('localhost') || u.includes('127.0.0.1')) return false;
  return { rejectUnauthorized: false };
}

async function main() {
  const url = String(process.env.DATABASE_URL || '').trim();
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const rows = flattenTeachingCategories();
  const client = new Client({ connectionString: url, ssl: useSsl(url) });
  await client.connect();
  try {
    for (const r of rows) {
      await client.query(
        `INSERT INTO categories (id, parent_id, slug, name_az, icon, is_popular, is_virtual_category, target_category_id, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           parent_id = EXCLUDED.parent_id,
           slug = EXCLUDED.slug,
           name_az = EXCLUDED.name_az,
           icon = EXCLUDED.icon,
           is_popular = EXCLUDED.is_popular,
           is_virtual_category = EXCLUDED.is_virtual_category,
           target_category_id = EXCLUDED.target_category_id,
           sort_order = EXCLUDED.sort_order`,
        [
          r.id,
          r.parent_id,
          r.slug,
          r.name_az,
          r.icon,
          r.is_popular,
          r.is_virtual_category,
          r.target_category_id,
          r.sort_order,
        ],
      );
    }
    console.log(`Seeded ${rows.length} categories.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
