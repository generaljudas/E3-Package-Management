/**
 * Customer Data Migration Script
 * Parses customer data from text file and migrates to database
 * 
 * Usage: node backend/scripts/migrate-customer-data.js <path-to-file> [--preview] [--execute]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../backend/.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'e3_package_manager',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

/**
 * Parse customer data from text file
 */
function parseCustomerData(fileContent) {
  const lines = fileContent.split('\n');
  const customers = [];
  let currentCustomer = null;
  let currentMailbox = null;
  let skipMode = false;
  let linesIntoCustomer = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect mailbox number (pure digits, usually 3-4 digits) - this starts a new customer block
    if (/^\d{3,4}$/.test(line)) {
      // Save previous customer if exists
      if (currentCustomer && currentMailbox) {
        customers.push({
          mailbox_number: currentMailbox,
          ...currentCustomer
        });
      }
      
      // Start new customer
      currentMailbox = line.replace(/^0+/, '') || '0'; // Remove leading zeros
      currentCustomer = {
        name: null,
        business_name: null,
        phone: null,
        email: null,
      };
      skipMode = false;
      linesIntoCustomer = 0;
      continue;
    }
    
    // Skip empty lines but don't reset customer
    if (!line) {
      linesIntoCustomer++;
      // If we've seen many empty lines (3+), consider this the end of customer block
      if (linesIntoCustomer > 10 && currentCustomer && currentMailbox) {
        customers.push({
          mailbox_number: currentMailbox,
          ...currentCustomer
        });
        currentCustomer = null;
        currentMailbox = null;
        skipMode = false;
        linesIntoCustomer = 0;
      }
      continue;
    }
    
    linesIntoCustomer++;
    
    // Skip "Box ###" lines
    if (/^Box\s+\d+/i.test(line)) {
      continue;
    }
    
    // Skip lines we want to ignore
    if (/^(ok to pick up|allowed? to pick up|authorized|code:|fedex|updated|old info)/i.test(line)) {
      skipMode = true;
      continue;
    }
    
    if (skipMode) continue;
    if (!currentCustomer) continue;
    
    // Extract primary name first (format: "Lastname, Firstname" possibly with phone/email on same line)
    const nameMatch = line.match(/^([A-Z][a-zA-Z'-]+),\s+([A-Z][a-zA-Z]+(?:\s+(?:\([^)]+\)|\([^)]+\)|[A-Z]\.?))?)/);
    if (nameMatch && !currentCustomer.name) {
      const firstName = nameMatch[2].replace(/\s*\([^)]+\)\s*/g, '').trim(); // Remove nicknames
      const lastName = nameMatch[1].trim();
      currentCustomer.name = `${firstName} ${lastName}`;
      // Continue processing this line for phone/email
    }
    
    // Extract email (if present in line)
    const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch && !currentCustomer.email) {
      currentCustomer.email = emailMatch[0];
    }
    
    // Extract phone number (various formats)
    const phoneMatch = line.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch && !currentCustomer.phone) {
      currentCustomer.phone = phoneMatch[0];
    }
    
    // Skip to next iteration if we found a name
    if (nameMatch) {
      continue;
    }
    
    // If line looks like a business name (all caps or has LLC, Inc, etc.)
    if (!currentCustomer.business_name) {
      // Clean out phone and email first to check business name patterns
      let cleanLine = line
        .replace(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '')
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
        .replace(/\b(home|cell|work|w:)\b/gi, '')
        .trim();
      
      if (
        /\b(LLC|Inc|Corp|Company|Group|Center|Magazine|Store|Solutions|Entertainment|Media|Staffing|One)\b/i.test(cleanLine) ||
        (/^[A-Z\s&]+$/.test(cleanLine) && cleanLine.length > 3)
      ) {
        if (cleanLine.length > 2 && cleanLine.length < 100) {
          currentCustomer.business_name = cleanLine;
        }
      }
    }
  }
  
  // Add last customer
  if (currentCustomer && currentMailbox) {
    customers.push({
      mailbox_number: currentMailbox,
      ...currentCustomer
    });
  }
  
  return customers;
}

/**
 * Clean and validate customer data
 */
function cleanAndValidate(customers) {
  const cleaned = [];
  const mailboxNumbers = new Set();
  const issues = [];
  
  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    
    // Validate mailbox number
    if (!customer.mailbox_number) {
      issues.push(`Row ${i + 1}: Missing mailbox number`);
      continue;
    }
    
    // Check for duplicates
    if (mailboxNumbers.has(customer.mailbox_number)) {
      issues.push(`Row ${i + 1}: Duplicate mailbox number ${customer.mailbox_number}`);
      continue;
    }
    mailboxNumbers.add(customer.mailbox_number);
    
    // Ensure we have at least a name
    if (!customer.name && !customer.business_name) {
      issues.push(`Mailbox ${customer.mailbox_number}: No name or business name found`);
    }
    
    // Use business name as fallback for name
    const tenantName = customer.name || customer.business_name || `Tenant ${customer.mailbox_number}`;
    
    cleaned.push({
      mailbox_number: customer.mailbox_number,
      tenant_name: tenantName,
      business_name: customer.business_name,
      phone: customer.phone || null,
      email: customer.email || null,
    });
  }
  
  return { cleaned, issues };
}

/**
 * Preview parsed data
 */
function previewData(customers, limit = 10) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 DATA PREVIEW (first ' + limit + ' records)');
  console.log('='.repeat(80) + '\n');
  
  customers.slice(0, limit).forEach((customer, idx) => {
    console.log(`${idx + 1}. Mailbox: ${customer.mailbox_number}`);
    console.log(`   Name: ${customer.tenant_name}`);
    if (customer.business_name) console.log(`   Business: ${customer.business_name}`);
    if (customer.phone) console.log(`   Phone: ${customer.phone}`);
    if (customer.email) console.log(`   Email: ${customer.email}`);
    console.log('');
  });
  
  console.log(`Total records: ${customers.length}\n`);
}

/**
 * Clear existing sample data
 */
async function clearSampleData() {
  console.log('\n🗑️  Clearing existing sample data...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Delete all existing packages (to avoid foreign key issues)
    const packagesResult = await client.query('DELETE FROM packages');
    console.log(`   Deleted ${packagesResult.rowCount} packages`);
    
    // Delete all existing tenants
    const tenantsResult = await client.query('DELETE FROM tenants');
    console.log(`   Deleted ${tenantsResult.rowCount} tenants`);
    
    // Delete all existing mailboxes
    const mailboxesResult = await client.query('DELETE FROM mailboxes');
    console.log(`   Deleted ${mailboxesResult.rowCount} mailboxes`);
    
    await client.query('COMMIT');
    console.log('✅ Sample data cleared successfully\n');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Insert customer data into database
 */
async function insertCustomerData(customers) {
  console.log('\n📥 Inserting customer data...');
  
  const client = await pool.connect();
  let mailboxesCreated = 0;
  let tenantsCreated = 0;
  const errors = [];
  
  try {
    await client.query('BEGIN');
    
    for (const customer of customers) {
      try {
        // Insert mailbox
        const mailboxResult = await client.query(
          `INSERT INTO mailboxes (mailbox_number, active, created_at)
           VALUES ($1, TRUE, NOW())
           RETURNING id`,
          [customer.mailbox_number]
        );
        mailboxesCreated++;
        const mailboxId = mailboxResult.rows[0].id;
        
        // Insert tenant
        const tenantResult = await client.query(
          `INSERT INTO tenants (mailbox_id, name, phone, email, notes, active, created_at)
           VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
           RETURNING id`,
          [
            mailboxId,
            customer.tenant_name,
            customer.phone,
            customer.email,
            customer.business_name ? `Business: ${customer.business_name}` : null
          ]
        );
        tenantsCreated++;
        const tenantId = tenantResult.rows[0].id;
        
        // Set default tenant for mailbox
        await client.query(
          `UPDATE mailboxes SET default_tenant_id = $1 WHERE id = $2`,
          [tenantId, mailboxId]
        );
        
      } catch (error) {
        errors.push(`Mailbox ${customer.mailbox_number}: ${error.message}`);
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`\n✅ Migration completed!`);
    console.log(`   📬 Mailboxes created: ${mailboxesCreated}`);
    console.log(`   👤 Tenants created: ${tenantsCreated}`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${errors.length}`);
      errors.slice(0, 5).forEach(err => console.log(`   - ${err}`));
      if (errors.length > 5) {
        console.log(`   ... and ${errors.length - 5} more`);
      }
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: node backend/scripts/migrate-customer-data.js <file-path> [options]

Options:
  --preview     Preview parsed data without inserting (default)
  --execute     Clear existing data and insert new customer data
  --help        Show this help message

Examples:
  # Preview data
  node backend/scripts/migrate-customer-data.js customers.txt
  node backend/scripts/migrate-customer-data.js customers.txt --preview
  
  # Execute migration
  node backend/scripts/migrate-customer-data.js customers.txt --execute
`);
    process.exit(0);
  }
  
  const filePath = args[0];
  const isExecute = args.includes('--execute');
  
  console.log('\n🚀 E3 Package Manager - Customer Data Migration');
  console.log('='.repeat(80));
  
  try {
    // Read file
    console.log(`\n📂 Reading file: ${filePath}`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    console.log(`   File size: ${(fileContent.length / 1024).toFixed(2)} KB`);
    
    // Parse data
    console.log('\n🔍 Parsing customer data...');
    const rawCustomers = parseCustomerData(fileContent);
    console.log(`   Raw records found: ${rawCustomers.length}`);
    
    // Clean and validate
    console.log('\n✨ Cleaning and validating data...');
    const { cleaned, issues } = cleanAndValidate(rawCustomers);
    console.log(`   Valid records: ${cleaned.length}`);
    
    if (issues.length > 0) {
      console.log(`\n⚠️  Validation issues found: ${issues.length}`);
      issues.slice(0, 10).forEach(issue => console.log(`   - ${issue}`));
      if (issues.length > 10) {
        console.log(`   ... and ${issues.length - 10} more issues`);
      }
    }
    
    // Preview data
    previewData(cleaned);
    
    if (isExecute) {
      console.log('\n⚠️  EXECUTING MIGRATION - This will delete all existing data!');
      console.log('Press Ctrl+C within 5 seconds to cancel...\n');
      
      // Wait 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Clear and insert
      await clearSampleData();
      await insertCustomerData(cleaned);
      
      console.log('\n🎉 Migration completed successfully!');
      console.log('\nYou can now refresh your app to see the new data.\n');
      
    } else {
      console.log('\n💡 This was a preview. To execute the migration, run:');
      console.log(`   node backend/scripts/migrate-customer-data.js ${filePath} --execute\n`);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run main function
main();
