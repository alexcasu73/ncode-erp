import pg from 'pg';

const { Pool } = pg;

/**
 * Create a PostgreSQL connection pool
 * @param {string} connectionString - PostgreSQL connection string
 * @returns {Pool}
 */
export function createPool(connectionString) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Test connection
  pool.on('connect', () => {
    console.log('✅ Database connected');
  });

  pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
  });

  return pool;
}

export default createPool;
