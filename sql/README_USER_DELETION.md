# User Deletion System

## Overview

This system ensures complete cleanup when users are deleted, preventing "zombie" accounts and orphaned data.

## What Was Implemented

### 1. Database Triggers (Migration: `20260117_cascade_user_deletion.sql`)

#### Trigger: `on_user_deleted`
- **When**: A user is deleted from the `users` table
- **Action**: Automatically deletes the user from `auth.users`
- **Prevents**: Zombie auth accounts that exist without corresponding user records

#### Trigger: `on_company_user_deleted`
- **When**: A user is removed from `company_users` table
- **Action**: If this was the last user in the company, deletes ALL company data:
  - reconciliation_sessions
  - bank_transactions
  - cashflow_records
  - invoices
  - deals
  - customers
  - financial_items
  - bank_balances
  - invoice_notifications
  - settings
  - companies
- **Prevents**: Orphaned company data when all users leave

### 2. Enhanced `deleteUser()` Function (DataContext.tsx)

The function now:
1. Checks if user is the last admin (prevents deletion)
2. Deletes from `company_users` (unlinks user from company)
3. Deletes from `users` table (triggers auth deletion automatically)
4. If deleting current user, auto-logout and clear all local data

### 3. Enhanced `signOut()` Function (AuthContext.tsx)

The function now:
1. Signs out from Supabase
2. Clears localStorage
3. Clears sessionStorage
4. Forces page reload to clear all React state
5. Handles errors gracefully

## How It Works

### User Deletes Their Own Account:

```
User clicks "Delete Account" in Profile
    ↓
DataContext.deleteUser() is called
    ↓
Deletes from company_users
    ↓
Deletes from users table
    ↓
✨ TRIGGER: Automatically deletes from auth.users
    ↓
✨ TRIGGER: If last user, deletes ALL company data
    ↓
Auto logout and redirect to login
```

### Admin Deletes Another User:

```
Admin clicks delete on another user
    ↓
Same process as above
    ↓
Admin remains logged in
```

## Testing

### Test 1: Delete Own Account

1. Login as a user
2. Go to Profile → Zona Pericolosa
3. Click "Elimina Account"
4. Type "ELIMINA" to confirm
5. **Expected**:
   - User is logged out
   - Redirected to login page
   - User no longer exists in auth.users
   - If last user, company data is deleted

### Test 2: Delete Another User (as Admin)

1. Login as admin
2. Go to User Management
3. Delete another user
4. **Expected**:
   - User is deleted from all tables
   - You remain logged in
   - If it was the last user, company is deleted

### Test 3: Cannot Delete Last Admin

1. Login as the only admin
2. Try to delete your account
3. **Expected**:
   - Error message: "Sei l'unico amministratore"
   - Deletion is blocked
   - Button is disabled

## Database Verification

Check if triggers are active:

```sql
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name IN ('on_user_deleted', 'on_company_user_deleted');
```

Check for zombie users (should return 0):

```sql
SELECT a.email, a.id
FROM auth.users a
LEFT JOIN users u ON a.id = u.id
WHERE u.id IS NULL;
```

## Migration Applied

The migration was successfully applied on **2026-01-17**:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f supabase/migrations/20260117_cascade_user_deletion.sql
```

**Results:**
- ✅ Function `delete_auth_user()` created
- ✅ Function `cleanup_orphaned_companies()` created
- ✅ Trigger `on_user_deleted` created on `users` table
- ✅ Trigger `on_company_user_deleted` created on `company_users` table

## Cleanup of Existing Zombie User

Found and cleaned up zombie user: `alex.casu@gmail.com`
- Existed in `auth.users` but not in `users` table
- Successfully deleted from `auth.users`

## Security Notes

- Functions use `SECURITY DEFINER` to allow deletion from auth.users
- Only authenticated users can trigger these functions
- Admin checks prevent accidental company deletion
- All deletions are logged in Postgres logs

## Future Improvements

1. Add soft delete option (mark as inactive instead of hard delete)
2. Add data export before deletion
3. Add email notification before permanent deletion
4. Add 30-day grace period for data recovery
