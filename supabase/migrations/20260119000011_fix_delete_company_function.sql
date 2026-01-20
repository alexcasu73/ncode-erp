-- ============================================
-- FIX delete_company_completely FUNCTION
-- ============================================
-- Updated to properly delete users from public.users table
-- which triggers the deletion from auth schema
-- ============================================

CREATE OR REPLACE FUNCTION delete_company_completely(company_id_to_delete UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_ids_to_delete UUID[];
  result jsonb;
BEGIN
  -- 1. Get all user IDs associated with this company
  SELECT ARRAY_AGG(user_id) INTO user_ids_to_delete
  FROM company_users
  WHERE company_id = company_id_to_delete;

  -- 2. Delete the company (this will CASCADE delete everything in public schema)
  --    This includes: company_users, invoices, cashflow_records, customers,
  --    deals, bank_transactions, bank_balances, settings, etc.
  DELETE FROM companies WHERE id = company_id_to_delete;

  -- 3. Delete users from public.users table
  --    The trigger 'on_user_deleted' will automatically delete from:
  --    - auth.users
  --    - auth.sessions
  --    - auth.refresh_tokens
  IF user_ids_to_delete IS NOT NULL THEN
    DELETE FROM users WHERE id = ANY(user_ids_to_delete);
  END IF;

  -- 4. Return result
  result := jsonb_build_object(
    'success', true,
    'company_id', company_id_to_delete,
    'users_deleted', COALESCE(array_length(user_ids_to_delete, 1), 0)
  );

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Add comment
COMMENT ON FUNCTION delete_company_completely IS
'Deletes a company and all associated data including users (both public.users and auth.users).
Cascade deletions handle: company_users, invoices, cashflow_records, customers, deals,
bank_transactions, bank_balances, settings, transactions, financial_items, reconciliation_sessions.
Only admins should call this function.';
