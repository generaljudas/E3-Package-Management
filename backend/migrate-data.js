/**
 * Data Migration Script: PostgreSQL to SQLite
 * This script exports data from the PostgreSQL database and imports it into SQLite
 */

import pkg from 'pg';
const { Pool } = pkg;
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// PostgreSQL connection
const pgPool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'e3_package_manager',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

// SQLite connection
const sqlitePath = path.join(__dirname, '../database.sqlite');

async function migrate() {
  let sqliteDb;
  
  try {
    console.log('🔄 Starting data migration from PostgreSQL to SQLite...\n');
    
    // Connect to SQLite
    console.log('📂 Opening SQLite database:', sqlitePath);
    sqliteDb = await open({
      filename: sqlitePath,
      driver: sqlite3.Database
    });
    
    // Enable foreign keys and WAL mode
    await sqliteDb.exec('PRAGMA foreign_keys = ON;');
    await sqliteDb.exec('PRAGMA journal_mode = WAL;');
    
    // Create tables (schema already exists, but ensure it's there)
    console.log('📋 Ensuring SQLite schema exists...');
    
    // Create schema if it doesn't exist
    await sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS mailboxes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mailbox_number VARCHAR(10) NOT NULL UNIQUE,
        default_tenant_id INTEGER,
        notes TEXT,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

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

      CREATE TABLE IF NOT EXISTS signatures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        signature_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Migrate mailboxes
    console.log('\n📦 Migrating mailboxes...');
    const mailboxes = await pgPool.query('SELECT * FROM mailboxes ORDER BY id');
    console.log(`   Found ${mailboxes.rows.length} mailboxes`);
    
    for (const mailbox of mailboxes.rows) {
      await sqliteDb.run(
        `INSERT OR REPLACE INTO mailboxes (id, mailbox_number, default_tenant_id, notes, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          mailbox.id,
          mailbox.mailbox_number,
          mailbox.default_tenant_id,
          mailbox.notes,
          mailbox.active ? 1 : 0,
          mailbox.created_at?.toISOString() || new Date().toISOString(),
          mailbox.updated_at?.toISOString() || new Date().toISOString()
        ]
      );
    }
    console.log(`   ✅ Migrated ${mailboxes.rows.length} mailboxes`);
    
    // Migrate tenants
    console.log('\n👥 Migrating tenants...');
    const tenants = await pgPool.query('SELECT * FROM tenants ORDER BY id');
    console.log(`   Found ${tenants.rows.length} tenants`);
    
    for (const tenant of tenants.rows) {
      await sqliteDb.run(
        `INSERT OR REPLACE INTO tenants (id, mailbox_id, name, phone, email, contact_info, notes, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenant.id,
          tenant.mailbox_id,
          tenant.name,
          tenant.phone,
          tenant.email,
          typeof tenant.contact_info === 'object' ? JSON.stringify(tenant.contact_info) : tenant.contact_info || '{}',
          tenant.notes,
          tenant.active ? 1 : 0,
          tenant.created_at?.toISOString() || new Date().toISOString(),
          tenant.updated_at?.toISOString() || new Date().toISOString()
        ]
      );
    }
    console.log(`   ✅ Migrated ${tenants.rows.length} tenants`);
    
    // Migrate packages
    console.log('\n📮 Migrating packages...');
    const packages = await pgPool.query('SELECT * FROM packages ORDER BY id');
    console.log(`   Found ${packages.rows.length} packages`);
    
    for (const pkg of packages.rows) {
      await sqliteDb.run(
        `INSERT OR REPLACE INTO packages (id, mailbox_id, tenant_id, tracking_number, status, high_value, pickup_by, carrier, size_category, notes, received_at, picked_up_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pkg.id,
          pkg.mailbox_id,
          pkg.tenant_id,
          pkg.tracking_number,
          pkg.status,
          pkg.high_value ? 1 : 0,
          pkg.pickup_by,
          pkg.carrier,
          pkg.size_category,
          pkg.notes,
          pkg.received_at?.toISOString() || new Date().toISOString(),
          pkg.picked_up_at?.toISOString() || null,
          pkg.created_at?.toISOString() || new Date().toISOString(),
          pkg.updated_at?.toISOString() || new Date().toISOString()
        ]
      );
    }
    console.log(`   ✅ Migrated ${packages.rows.length} packages`);
    
    // Migrate signatures
    console.log('\n✍️  Migrating signatures...');
    const signatures = await pgPool.query('SELECT * FROM signatures ORDER BY id');
    console.log(`   Found ${signatures.rows.length} signatures`);
    
    for (const sig of signatures.rows) {
      await sqliteDb.run(
        `INSERT OR REPLACE INTO signatures (id, signature_data, created_at)
         VALUES (?, ?, ?)`,
        [
          sig.id,
          sig.signature_data,
          sig.created_at?.toISOString() || new Date().toISOString()
        ]
      );
    }
    console.log(`   ✅ Migrated ${signatures.rows.length} signatures`);
    
    // Migrate pickup_events if table exists
    try {
      console.log('\n🚚 Migrating pickup events...');
      const pickupEvents = await pgPool.query('SELECT * FROM pickup_events ORDER BY id');
      console.log(`   Found ${pickupEvents.rows.length} pickup events`);
      
      for (const event of pickupEvents.rows) {
        await sqliteDb.run(
          `INSERT OR REPLACE INTO pickup_events (id, package_id, picked_up_by, signature_id, notes, picked_up_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            event.id,
            event.package_id,
            event.picked_up_by,
            event.signature_id,
            event.notes,
            event.picked_up_at?.toISOString() || new Date().toISOString()
          ]
        );
      }
      console.log(`   ✅ Migrated ${pickupEvents.rows.length} pickup events`);
    } catch (err) {
      console.log('   ⚠️  Pickup events table not found or empty, skipping...');
    }
    
    // Verify migration
    console.log('\n📊 Verifying migration...');
    const sqliteMailboxCount = await sqliteDb.get('SELECT COUNT(*) as count FROM mailboxes');
    const sqliteTenantsCount = await sqliteDb.get('SELECT COUNT(*) as count FROM tenants');
    const sqlitePackagesCount = await sqliteDb.get('SELECT COUNT(*) as count FROM packages');
    const sqliteSignaturesCount = await sqliteDb.get('SELECT COUNT(*) as count FROM signatures');
    
    console.log(`\n📈 Migration Summary:`);
    console.log(`   Mailboxes:  ${sqliteMailboxCount.count} (expected ${mailboxes.rows.length})`);
    console.log(`   Tenants:    ${sqliteTenantsCount.count} (expected ${tenants.rows.length})`);
    console.log(`   Packages:   ${sqlitePackagesCount.count} (expected ${packages.rows.length})`);
    console.log(`   Signatures: ${sqliteSignaturesCount.count} (expected ${signatures.rows.length})`);
    
    console.log('\n✅ Migration completed successfully!');
    console.log(`📂 SQLite database: ${sqlitePath}`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    // Close connections
    if (sqliteDb) {
      await sqliteDb.close();
    }
    await pgPool.end();
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration error:', error);
    process.exit(1);
  });
