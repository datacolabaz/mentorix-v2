const { Pool } = require('pg');

function resolveSsl(connectionString) {
  if (process.env.DATABASE_SSL === 'false' || process.env.DATABASE_SSL === '0') return false;
  if (process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === '1') return { rejectUnauthorized: false };
  if (!connectionString) return false;
  const u = String(connectionString).toLowerCase();
  if (u.includes('localhost') || u.includes('127.0.0.1')) return false;
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl(process.env.DATABASE_URL),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
});

pool.on('error', (err) => {
  console.error('[db:pool] Unexpected error on idle client:', err.message);
});

const db = {
  pool,
  query: (text, params) => pool.query(text, params),

  transaction: async (callback) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  close: () => pool.end(),
};

module.exports = db;
