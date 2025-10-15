import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

/**
 * Get the database file path
 * In Electron mode, use userData directory
 * In dev mode, use backend directory
 */
const getDatabasePath = () => {
  if (process.env.ELECTRON_MODE === 'true' && process.env.USER_DATA_PATH) {
    return path.join(process.env.USER_DATA_PATH, 'e3_package_manager.db');
  }
  return path.join(__dirname, '../../database.sqlite');
};

/**
 * Initialize database connection
 */
export const initDatabase = async () => {
  try {
    const dbPath = getDatabasePath();
    console.log(`📂 Database path: ${dbPath}`);
    
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Enable foreign keys
    await db.exec('PRAGMA foreign_keys = ON;');
    
    // Enable WAL mode for better concurrent access
    await db.exec('PRAGMA journal_mode = WAL;');
    
    console.log('✅ SQLite database connected successfully');
    
    // Initialize schema
    await initSchema();
    
    return db;
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    throw err;
  }
};

/**
 * Initialize database schema
 */
const initSchema = async () => {
  try {
    // Create mailboxes table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS mailboxes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mailbox_number VARCHAR(10) NOT NULL UNIQUE,
        default_tenant_id INTEGER,
        notes TEXT,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create tenants table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mailbox_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(255),
        contact_info TEXT,
        notes TEXT,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
      );
    `);

    // Create packages table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mailbox_id INTEGER NOT NULL,
        tenant_id INTEGER,
        tracking_number VARCHAR(255) NOT NULL UNIQUE,
        status VARCHAR(50) NOT NULL DEFAULT 'received',
        high_value BOOLEAN DEFAULT 0,
        pickup_by VARCHAR(255),
        carrier VARCHAR(100),
        size_category VARCHAR(20),
        notes TEXT,
        received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        picked_up_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
      );
    `);

    // Create pickup_events table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS pickup_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        package_id INTEGER NOT NULL,
        picked_up_by VARCHAR(255),
        signature_id INTEGER,
        notes TEXT,
        picked_up_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
        FOREIGN KEY (signature_id) REFERENCES signatures(id) ON DELETE SET NULL
      );
    `);

    // Create signatures table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS signatures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        signature_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for performance
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_packages_mailbox ON packages(mailbox_id);
      CREATE INDEX IF NOT EXISTS idx_packages_tenant ON packages(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);
      CREATE INDEX IF NOT EXISTS idx_packages_tracking ON packages(tracking_number);
      CREATE INDEX IF NOT EXISTS idx_tenants_mailbox ON tenants(mailbox_id);
      CREATE INDEX IF NOT EXISTS idx_pickup_events_package ON pickup_events(package_id);
    `);

    console.log('✅ Database schema initialized');
    
    // Only seed if NOT in migration mode (check environment variable)
    if (process.env.SKIP_SEED !== 'true') {
      await seedDatabaseIfEmpty();
    }
  } catch (err) {
    console.error('❌ Schema initialization failed:', err.message);
    throw err;
  }
};

/**
 * Seed database with sample data if empty
 */
const seedDatabaseIfEmpty = async () => {
  try {
    // Check if mailboxes exist
    const mailboxCount = await db.get('SELECT COUNT(*) as count FROM mailboxes');
    
    if (mailboxCount.count === 0) {
      console.log('📦 Database is empty. Seeding with sample data...');
      
      // Insert sample mailboxes
      const mailboxes = [
        '101', '102', '103', '104', '105', '106', '107', '108', '109', '110',
        '111', '112', '113', '114', '115', '116', '117', '118', '119', '120',
        '201', '202', '203', '204', '205', '206', '207', '208', '209', '210',
        '211', '212', '213', '214', '215', '216', '217', '218', '219', '220',
        '301', '302', '303', '304', '305', '306', '307', '308', '309', '310'
      ];
      
      for (const number of mailboxes) {
        await db.run(
          'INSERT INTO mailboxes (mailbox_number, notes) VALUES (?, ?)',
          [number, `Mailbox ${number}`]
        );
      }
      
      // Insert some sample tenants
      const tenants = [
        { mailbox: '101', name: 'John Smith', phone: '555-0101', email: 'john.smith@email.com' },
        { mailbox: '102', name: 'Sarah Johnson', phone: '555-0102', email: 'sarah.johnson@email.com' },
        { mailbox: '105', name: 'Michael Brown', phone: '555-0105', email: 'michael.brown@email.com' },
        { mailbox: '210', name: 'Emily Davis', phone: '555-0210', email: 'emily.davis@email.com' },
        { mailbox: '215', name: 'David Wilson', phone: '555-0215', email: 'david.wilson@email.com' }
      ];
      
      for (const tenant of tenants) {
        const mailbox = await db.get('SELECT id FROM mailboxes WHERE mailbox_number = ?', [tenant.mailbox]);
        if (mailbox) {
          await db.run(
            'INSERT INTO tenants (mailbox_id, name, phone, email, contact_info) VALUES (?, ?, ?, ?, ?)',
            [mailbox.id, tenant.name, tenant.phone, tenant.email, '{}']
          );
        }
      }
      
      console.log(`✅ Seeded ${mailboxes.length} mailboxes and ${tenants.length} sample tenants`);
    }
  } catch (err) {
    console.error('⚠️  Database seeding failed:', err.message);
    // Don't throw - seeding failure shouldn't prevent app from running
  }
};

/**
 * Execute a query with automatic connection handling
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
export const query = async (text, params = []) => {
  if (!db) {
    await initDatabase();
  }

  const start = Date.now();
  try {
    // Convert PostgreSQL-style $1, $2 to SQLite ? placeholders
    let sqliteQuery = text;
    if (text.includes('$')) {
      let paramIndex = 1;
      sqliteQuery = text.replace(/\$\d+/g, () => '?');
    }

    // Handle RETURNING clause (PostgreSQL feature not in SQLite)
    const hasReturning = sqliteQuery.toUpperCase().includes('RETURNING');
    let returningFields = [];
    
    if (hasReturning) {
      const match = sqliteQuery.match(/RETURNING\s+(.+?)(?:;|$)/i);
      if (match) {
        returningFields = match[1].split(',').map(f => f.trim());
        sqliteQuery = sqliteQuery.replace(/RETURNING\s+.+?(?:;|$)/i, '');
      }
    }

    let result;
    if (sqliteQuery.trim().toUpperCase().startsWith('SELECT')) {
      result = await db.all(sqliteQuery, params);
    } else if (sqliteQuery.trim().toUpperCase().startsWith('INSERT')) {
      const info = await db.run(sqliteQuery, params);
      
      // If RETURNING was requested, fetch the inserted row
      if (hasReturning && info.lastID) {
        const tableName = sqliteQuery.match(/INTO\s+(\w+)/i)?.[1];
        if (tableName) {
          const row = await db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [info.lastID]);
          result = [row];
        }
      } else {
        result = { lastID: info.lastID, changes: info.changes };
      }
    } else if (sqliteQuery.trim().toUpperCase().startsWith('UPDATE') || 
               sqliteQuery.trim().toUpperCase().startsWith('DELETE')) {
      const info = await db.run(sqliteQuery, params);
      
      // If RETURNING was requested for UPDATE, fetch the updated row
      if (hasReturning && info.changes > 0) {
        const tableName = sqliteQuery.match(/UPDATE\s+(\w+)/i)?.[1];
        
        if (tableName) {
          // For UPDATE queries with WHERE id = ?, the id is typically the last parameter
          // This is a simple approach that works for most common cases
          const idParam = params[params.length - 1];
          const row = await db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [idParam]);
          result = row ? [row] : [];
        } else {
          result = { changes: info.changes };
        }
      } else {
        result = { changes: info.changes };
      }
    } else {
      result = await db.run(sqliteQuery, params);
    }

    const duration = Date.now() - start;
    
    // Log slow queries (> 100ms)
    if (duration > 100) {
      console.warn(`⚠️  Slow query (${duration}ms):`, sqliteQuery.substring(0, 100));
    }
    
    // Return in PostgreSQL-compatible format
    return {
      rows: Array.isArray(result) ? result : [],
      rowCount: Array.isArray(result) ? result.length : (result?.changes || 0),
      lastID: result?.lastID
    };
  } catch (err) {
    console.error('Database query error:', err.message);
    console.error('Query:', text);
    console.error('Params:', params);
    throw err;
  }
};

/**
 * Execute multiple queries in a transaction
 * @param {Array} queries - Array of {text, params} objects
 * @returns {Promise} Array of results
 */
export const transaction = async (queries) => {
  if (!db) {
    await initDatabase();
  }

  try {
    await db.exec('BEGIN TRANSACTION');
    
    const results = [];
    for (const { text, params } of queries) {
      const result = await query(text, params);
      results.push(result);
    }
    
    await db.exec('COMMIT');
    return results;
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
};

/**
 * Health check for database connection
 * @returns {Promise<boolean>} Connection status
 */
export const healthCheck = async () => {
  try {
    if (!db) {
      await initDatabase();
    }
    const result = await db.get('SELECT 1 as health');
    return result?.health === 1;
  } catch (err) {
    console.error('Database health check failed:', err.message);
    return false;
  }
};

/**
 * Close database connection
 */
export const closeDatabase = async () => {
  if (db) {
    console.log('Closing database connection...');
    await db.close();
    db = null;
    console.log('Database connection closed');
  }
};

/**
 * Get the database instance (for direct queries if needed)
 */
export const getDatabase = () => db;

export default {
  initDatabase,
  query,
  transaction,
  healthCheck,
  closeDatabase,
  getDatabase
};
