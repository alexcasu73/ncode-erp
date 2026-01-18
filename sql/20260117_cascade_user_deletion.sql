-- Migration: Cascade User Deletion
-- This migration adds automatic cleanup when a user is deleted
-- It ensures no "zombie" data is left behind

-- ============================================================================
-- FUNCTION: Delete user from auth.users when deleted from users table
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the user from auth.users
  -- This requires the function to be run with elevated privileges
  DELETE FROM auth.users WHERE id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_auth_user() TO authenticated;

-- Create trigger to automatically delete auth user
DROP TRIGGER IF EXISTS on_user_deleted ON users;
CREATE TRIGGER on_user_deleted
  AFTER DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION delete_auth_user();

-- ============================================================================
-- FUNCTION: Cleanup company data when last admin is deleted
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_orphaned_companies()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
  v_remaining_admins INTEGER;
  v_remaining_users INTEGER;
BEGIN
  -- Get the company_id from the deleted record
  v_company_id := OLD.company_id;

  -- Check if there are any remaining active users in the company
  SELECT COUNT(*) INTO v_remaining_users
  FROM company_users
  WHERE company_id = v_company_id
    AND is_active = true;

  -- If no users left, delete all company data
  IF v_remaining_users = 0 THEN
    RAISE NOTICE 'No users left in company %, deleting all company data', v_company_id;

    -- Delete in order to respect foreign key constraints
    DELETE FROM reconciliation_sessions WHERE company_id = v_company_id;
    DELETE FROM bank_transactions WHERE company_id = v_company_id;
    DELETE FROM cashflow_records WHERE company_id = v_company_id;
    DELETE FROM invoices WHERE company_id = v_company_id;
    DELETE FROM deals WHERE company_id = v_company_id;
    DELETE FROM customers WHERE company_id = v_company_id;
    DELETE FROM financial_items WHERE company_id = v_company_id;
    DELETE FROM bank_balances WHERE company_id = v_company_id;
    DELETE FROM invoice_notifications WHERE company_id = v_company_id;
    DELETE FROM settings WHERE company_id = v_company_id;
    DELETE FROM companies WHERE id = v_company_id;

    RAISE NOTICE 'Company % and all related data deleted', v_company_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_orphaned_companies() TO authenticated;

-- Create trigger to cleanup orphaned companies
DROP TRIGGER IF EXISTS on_company_user_deleted ON company_users;
CREATE TRIGGER on_company_user_deleted
  AFTER DELETE ON company_users
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_orphaned_companies();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION delete_auth_user() IS
  'Automatically deletes user from auth.users when deleted from users table. Prevents zombie auth accounts.';

COMMENT ON FUNCTION cleanup_orphaned_companies() IS
  'Automatically deletes all company data when the last user is removed from a company. Prevents orphaned company data.';

COMMENT ON TRIGGER on_user_deleted ON users IS
  'Triggers deletion of auth.users record when user is deleted from users table';

COMMENT ON TRIGGER on_company_user_deleted ON company_users IS
  'Triggers cleanup of company data when last user is removed from company';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify triggers are created
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name IN ('on_user_deleted', 'on_company_user_deleted');
