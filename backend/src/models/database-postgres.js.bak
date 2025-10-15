import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Database connection configuration
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'e3_package_manager',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  
  // Connection pool settings
  max: 20, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection cannot be established
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle connection errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    return;
  }
  console.log('✅ Database connected successfully');
  release();
});

/**
 * Execute a query with automatic connection handling
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (> 100ms)
    if (duration > 100) {
      console.warn(`⚠️  Slow query (${duration}ms):`, text.substring(0, 100));
    }
    
    return res;
  } catch (err) {
    console.error('Database query error:', err.message);
    console.error('Query:', text);
    console.error('Params:', params);
    throw err;
  }
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise} Database client
 */
export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

/**
 * Execute multiple queries in a transaction
 * @param {Array} queries - Array of {text, params} objects
 * @returns {Promise} Array of results
 */
export const transaction = async (queries) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const results = [];
    for (const { text, params } of queries) {
      const result = await client.query(text, params);
      results.push(result);
    }
    
    await client.query('COMMIT');
    return results;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Health check for database connection
 * @returns {Promise<boolean>} Connection status
 */
export const healthCheck = async () => {
  try {
    const result = await query('SELECT 1 as health');
    return result.rows.length > 0;
  } catch (err) {
    console.error('Database health check failed:', err.message);
    return false;
  }
};

// Graceful shutdown
export const closePool = async () => {
  console.log('Closing database connection pool...');
  await pool.end();
  console.log('Database connection pool closed');
};

export default {
  query,
  getClient,
  transaction,
  healthCheck,
  closePool,
};