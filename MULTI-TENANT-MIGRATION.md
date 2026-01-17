# Multi-Tenant Migration Guide

## Overview

This guide will walk you through migrating the Ncode ERP system to a multi-tenant architecture. After this migration, multiple companies will be able to use the system, each with their own isolated data and users.

## What Changes

### New Tables
- **companies**: Stores company information
- **users**: Extends auth.users with additional profile information
- **company_users**: Links users to companies with roles (admin, manager, user, viewer)

### Modified Tables
All existing tables will get a `company_id` column:
- invoices
- cashflow_records
- bank_transactions
- reconciliation_sessions
- deals
- settings

### Security
- Row Level Security (RLS) will be enabled on all tables
- Users can only see data from companies they belong to
- Admins have additional permissions for settings

## Pre-Migration Checklist

- [ ] **CRITICAL**: Backup your database
- [ ] Export current data (already done: `export-2026-01-17.json` and `.sql`)
- [ ] Review the migration file: `sql/multi-tenant-migration.sql`
- [ ] Test the migration on a staging/development database first
- [ ] Ensure you have admin access to Supabase dashboard

## Migration Steps

### Step 1: Run the Database Migration

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the entire contents of `sql/multi-tenant-migration.sql`
5. Paste into the SQL Editor
6. **Review the SQL carefully**
7. Click **Run**
8. Wait for completion (should take a few seconds)

### Step 2: Verify Migration

Run this query to verify the migration:

```sql
-- Check that all tables have company_id
SELECT column_name, table_name
FROM information_schema.columns
WHERE column_name = 'company_id'
  AND table_schema = 'public'
ORDER BY table_name;

-- Verify Ncode Studio exists
SELECT * FROM companies WHERE slug = 'ncode-studio';

-- Check that existing data has been migrated
SELECT
  (SELECT COUNT(*) FROM invoices WHERE company_id = '00000000-0000-0000-0000-000000000001') as invoices_count,
  (SELECT COUNT(*) FROM cashflow_records WHERE company_id = '00000000-0000-0000-0000-000000000001') as cashflow_count,
  (SELECT COUNT(*) FROM bank_transactions WHERE company_id = '00000000-0000-0000-0000-000000000001') as transactions_count;
```

Expected results:
- All 6 tables should have `company_id`
- Ncode Studio company should exist
- All counts should match your current record counts

### Step 3: Create Admin User

#### 3a. Sign Up the Admin User

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Users**
3. Click **Add user** (or use the signup page if you have one)
4. Create user with email: `alessandro.casu@ncodestudio.it`
5. Set a strong password
6. Confirm the email (or disable email confirmation in Auth settings for this first user)

#### 3b. Link User to Company

1. Once the user is created, copy their UUID from the Users list
2. Run the script to generate the SQL:
   ```bash
   node scripts/create-admin-user.mjs
   ```
3. Copy the generated SQL
4. Replace `USER_ID_HERE` with the actual UUID from step 1
5. Run the SQL in Supabase SQL Editor

#### 3c. Verify Admin Setup

Run this query:

```sql
SELECT
  u.email,
  u.full_name,
  c.name as company_name,
  cu.role,
  cu.is_active
FROM users u
JOIN company_users cu ON u.id = cu.user_id
JOIN companies c ON cu.company_id = c.id
WHERE u.email = 'alessandro.casu@ncodestudio.it';
```

Expected result:
- Email: alessandro.casu@ncodestudio.it
- Company: Ncode Studio
- Role: admin
- Active: true

### Step 4: Update Application Code

After the migration is complete, you'll need to update the application to:

1. **Add Authentication**
   - Implement login/logout
   - Store current user and company in context
   - Redirect to login if not authenticated

2. **Update DataContext**
   - Add company_id to all insert operations
   - Filter queries by company_id (RLS will enforce this too)
   - Add user context

3. **Add Company Selection** (if user belongs to multiple companies)
   - Show company selector in navigation
   - Allow switching between companies

4. **Update UI**
   - Show current company name
   - Add user profile menu
   - Add logout button

## Testing

### Test RLS Policies

Try these queries as the authenticated user:

```sql
-- Should only see Ncode Studio data
SELECT * FROM invoices LIMIT 5;

-- Should not be able to insert without company_id
INSERT INTO invoices (id, data, tipo) VALUES ('test', '2026-01-01', 'Entrata');
-- This should fail

-- Should be able to insert with correct company_id
INSERT INTO invoices (id, data, tipo, company_id)
VALUES ('test', '2026-01-01', 'Entrata', '00000000-0000-0000-0000-000000000001');
-- This should succeed
```

### Test User Permissions

1. Create a test user with 'viewer' role
2. Verify they can SELECT but not INSERT/UPDATE/DELETE
3. Create a test user with 'admin' role
4. Verify they can access settings

## Rollback Plan

If something goes wrong:

1. **Restore from backup**
   ```bash
   # Use the export files created earlier
   # Contact Supabase support if needed
   ```

2. **Remove RLS policies**
   ```sql
   -- Disable RLS on all tables
   ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
   ALTER TABLE users DISABLE ROW LEVEL SECURITY;
   -- ... etc for all tables
   ```

3. **Drop new tables** (CAUTION: This will lose multi-tenant data)
   ```sql
   DROP TABLE IF EXISTS company_users CASCADE;
   DROP TABLE IF EXISTS users CASCADE;
   DROP TABLE IF EXISTS companies CASCADE;
   ```

## Next Steps

After successful migration:

1. [ ] Test all existing functionality
2. [ ] Implement authentication UI
3. [ ] Update DataContext for multi-tenancy
4. [ ] Create company management UI
5. [ ] Create user management UI
6. [ ] Document user roles and permissions
7. [ ] Plan for adding new companies and users

## Role Definitions

- **Admin**: Full access to company data, can manage users, can modify settings
- **Manager**: Can view and edit data, cannot manage users or settings
- **User**: Can view and edit data assigned to them
- **Viewer**: Read-only access to data

## Support

If you encounter issues during migration:

1. Check Supabase logs in the dashboard
2. Review the migration SQL for errors
3. Verify RLS policies are correctly applied
4. Test with a simple query to isolate the issue

## Files Reference

- `sql/multi-tenant-migration.sql` - Main migration file
- `scripts/run-multi-tenant-migration.mjs` - Helper script (use SQL Editor instead)
- `scripts/create-admin-user.mjs` - Generates SQL for admin user setup
- `export-2026-01-17.json` - Database backup (JSON)
- `export-2026-01-17.sql` - Database backup (SQL)
- `database-schema.json` - Current schema documentation

## Migration Status

- [x] Database schema designed
- [x] Migration SQL created
- [x] Backup created
- [ ] Migration executed
- [ ] Admin user created
- [ ] Application code updated
- [ ] Testing completed
