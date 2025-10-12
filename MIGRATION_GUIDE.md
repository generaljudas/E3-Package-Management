# Quick Start Guide: Migrating Your 500 Customers

## ✅ Setup Complete!

The migration script is ready and tested. Here's how to use it:

## Step 1: Save Your Customer Data File

Save your complete text file somewhere accessible, for example:
- `/Users/macboundgeneral/Documents/customers.txt`
- Or anywhere on your computer

## Step 2: Preview Your Data (IMPORTANT - Do This First!)

```bash
cd "/Users/macboundgeneral/E3 Package Manager"
node backend/scripts/migrate-customer-data.js /path/to/your/customers.txt
```

Replace `/path/to/your/customers.txt` with the actual path to your file.

**What this does:**
- Parses all ~500 customers
- Shows validation issues (duplicates, missing data)
- Previews first 10 records
- Shows total count
- **Does NOT modify your database**

## Step 3: Review the Preview

Check the output for:
- ✅ Names are extracted correctly
- ✅ Mailbox numbers look right (leading zeros are removed)
- ✅ Phone numbers and emails are captured
- ✅ Business names are identified
- ⚠️ Any validation issues

## Step 4: Execute the Migration

Once you're satisfied with the preview:

```bash
node backend/scripts/migrate-customer-data.js /path/to/your/customers.txt --execute
```

**What this does:**
- Gives you 5 seconds to cancel (press Ctrl+C)
- **DELETES all existing mailboxes, tenants, and packages**
- Inserts your ~500 customers
- Creates proper relationships
- Shows results

## Step 5: Verify in Your App

1. Refresh your E3 Package Manager app
2. Go to **Tools** → **Manage Mailboxes & Tenants**
3. Use the search bar to find a few customers
4. Check that the data looks correct

## What Gets Extracted

From your messy text format, the script smartly extracts:

| Field | Example | Notes |
|-------|---------|-------|
| **Mailbox Number** | 141, 15, 16 | Leading zeros removed |
| **Name** | "Siobhan Oldham" | From "Oldham, Siobhan" format |
| **Business** | "Ball & Bone" | Detected from patterns |
| **Phone** | "310-948-4297" | Various formats supported |
| **Email** | "siibhan@azestfor.com" | Standard extraction |

## What Gets Ignored

The script automatically skips:
- "Box ###" labels
- "Ok to pick up" sections
- "Authorized to pick up" lists
- FedEx account numbers
- Street addresses
- Notes and extra info

## Example Output

```
📋 DATA PREVIEW (first 10 records)
================================================================================

1. Mailbox: 141
   Name: Siobhan Oldham
   Business: Ball & Bone
   Phone: 310-948-4297
   Email: siibhan@azestfor.com

2. Mailbox: 15
   Name: Jonathan Vitagliano
   Phone: 267-259-4318
   Email: javitag@gmail.com

... (498 more records)

Total records: 500
```

## Troubleshooting

### "No name or business name found"
Some entries might not have clear name format. The script will use "Tenant ###" as fallback.

### "Duplicate mailbox number"
You have the same mailbox number twice in your file. Review and remove duplicates.

### Parser misses some data
The text format might have edge cases. You can manually edit problematic entries in your text file, or fix them in the app after migration.

## Need to Undo?

If something goes wrong, you can:
1. Restore from database backup (if you made one)
2. Re-run the sample data SQL from `backend/database_schema.sql`
3. Or contact me for help!

## Ready to Go!

You're all set. Just run the preview command first, review the output, then execute when ready! 🚀
