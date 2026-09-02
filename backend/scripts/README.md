# Customer Data Migration Script

This script parses your customer data text file and migrates it into the E3 Package Manager database.

## Features

✅ **Smart Parsing**: Handles imperfect formatting, extracts mailbox numbers, names, phones, emails  
✅ **Data Validation**: Checks for duplicates, missing data, and validates format  
✅ **Safe Preview**: Shows what will be inserted before making changes  
✅ **Clean Migration**: Removes sample data and inserts real customer data  
✅ **Error Handling**: Reports issues and continues processing  

## What It Extracts

From your text file format, the script intelligently extracts:
- **Mailbox Number**: From lines with 3-4 digits (e.g., "0141", "015")
- **Primary Name**: From "Lastname, Firstname" format
- **Business Name**: Lines with LLC, Inc, Corp, or all-caps text
- **Phone**: Various formats (###-###-####, (###) ###-####, etc.)
- **Email**: Standard email addresses

**What it ignores:**
- "Box ###" labels
- "Ok to pick up" sections
- "Authorized" sections  
- Addresses and extra notes
- FedEx account numbers
- Old/updated info markers

## Usage

### Step 1: Preview Your Data (RECOMMENDED FIRST)

```bash
cd path/to/E3-Package-Management     # the repository root
node backend/scripts/migrate-customer-data.js /path/to/your/customers.txt
```

The script writes to the same database the backend uses (`DB_PATH` /
`E3_DB_PATH` in `backend/.env`, or `backend/database.sqlite` by default). For a
packaged desktop install, point `E3_DB_PATH` at the app's database file — see
"Where is my data?" in [`docs/INSTALL.md`](../../docs/INSTALL.md).

This will:
- Parse the file
- Show validation issues
- Preview the first 10 records
- Show total count
- **NOT modify the database**

### Step 2: Execute Migration

Once you're happy with the preview:

```bash
node backend/scripts/migrate-customer-data.js /path/to/your/customers.txt --execute
```

This will:
- Give you 5 seconds to cancel (Ctrl+C)
- Delete all existing mailboxes, tenants, and packages
- Insert your 500+ customers
- Set up proper relationships
- Show results

## Example Output

```
🚀 E3 Package Manager - Customer Data Migration
================================================================================

📂 Reading file: customers.txt
   File size: 45.23 KB

🔍 Parsing customer data...
   Raw records found: 523

✨ Cleaning and validating data...
   Valid records: 518

⚠️  Validation issues found: 5
   - Mailbox 145: Duplicate mailbox number
   - Mailbox 302: No name or business name found

================================================================================
📋 DATA PREVIEW (first 10 records)
================================================================================

1. Mailbox: 141
   Name: Wendy Larkspur
   Business: Larkspur Goods
   Phone: 555-0142
   Email: wendy.larkspur@example.com

2. Mailbox: 15
   Name: Jordan Trellis
   Phone: 555-0186
   Email: jtrellis@example.com

... (more records)

Total records: 518

💡 This was a preview. To execute the migration, run:
   node backend/scripts/migrate-customer-data.js customers.txt --execute
```

## Important Notes

⚠️ **BACKUP FIRST**: The script will DELETE all existing data when executed  
⚠️ **Preview First**: Always run without --execute first to verify parsing  
⚠️ **5 Second Delay**: You have 5 seconds to cancel after running --execute  

## Troubleshooting

### Issue: "Cannot find module"
Make sure you're running from the project root directory.

### Issue: "Database connection failed"
Check your `.env` file in the backend directory has correct database credentials.

### Issue: "Parsing errors"
Review the validation issues in the preview output. You may need to manually edit the text file for edge cases.

### Issue: "Duplicate mailbox numbers"
The script will skip duplicates and report them. Check your source file for repeated entries.

## After Migration

1. Refresh your E3 Package Manager app
2. Go to Tools → Manage Mailboxes & Tenants
3. Use the search bar to verify your data
4. Check a few mailboxes to ensure tenants are properly linked

## Need Help?

If the parser isn't working correctly for your data format, you can adjust the parsing logic in the script or provide a sample of problematic entries for manual review.
