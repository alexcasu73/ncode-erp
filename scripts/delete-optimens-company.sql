-- ============================================
-- DELETE OPTIMENS COMPANY AND USER team@ncodestudio.it
-- ============================================
-- This script will:
-- 1. Find the Optimens company ID
-- 2. Show what will be deleted
-- 3. Delete the company and all associated data
-- 4. Delete the user team@ncodestudio.it from auth
-- ============================================

-- Step 1: Find the company ID and show info
DO $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_company_name TEXT;
  v_num_users INT;
BEGIN
  -- Find Optimens company
  SELECT id, name INTO v_company_id, v_company_name
  FROM companies
  WHERE LOWER(name) LIKE '%optimens%'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE NOTICE '❌ Company Optimens not found';
    RETURN;
  END IF;

  RAISE NOTICE '🏢 Found company: % (ID: %)', v_company_name, v_company_id;

  -- Count users in this company
  SELECT COUNT(*) INTO v_num_users
  FROM company_users
  WHERE company_id = v_company_id;

  RAISE NOTICE '👥 Users in company: %', v_num_users;

  -- Show users in this company
  RAISE NOTICE '📋 Users that will be deleted:';
  FOR v_user_id IN
    SELECT u.id
    FROM users u
    JOIN company_users cu ON u.id = cu.user_id
    WHERE cu.company_id = v_company_id
  LOOP
    RAISE NOTICE '   - User ID: %', v_user_id;
  END LOOP;

  -- Show invoices count
  RAISE NOTICE '📄 Invoices: %', (SELECT COUNT(*) FROM invoices WHERE company_id = v_company_id);
  RAISE NOTICE '💰 Cashflows: %', (SELECT COUNT(*) FROM cashflow_records WHERE company_id = v_company_id);
  RAISE NOTICE '🏦 Bank transactions: %', (SELECT COUNT(*) FROM bank_transactions WHERE company_id = v_company_id);
  RAISE NOTICE '👥 Customers: %', (SELECT COUNT(*) FROM customers WHERE company_id = v_company_id);
  RAISE NOTICE '🤝 Deals: %', (SELECT COUNT(*) FROM deals WHERE company_id = v_company_id);

END $$;

-- ============================================
-- UNCOMMENT THE LINES BELOW TO ACTUALLY DELETE
-- ============================================

/*

-- Step 2: Create the delete function if it doesn't exist
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
  DELETE FROM companies WHERE id = company_id_to_delete;

  -- 3. Delete auth users (these don't cascade automatically)
  IF user_ids_to_delete IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = ANY(user_ids_to_delete);
    DELETE FROM auth.sessions WHERE user_id = ANY(user_ids_to_delete);
    DELETE FROM auth.refresh_tokens WHERE user_id = ANY(user_ids_to_delete);
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

-- Step 3: Delete Optimens company
DO $$
DECLARE
  v_company_id UUID;
  v_result jsonb;
BEGIN
  -- Find Optimens company
  SELECT id INTO v_company_id
  FROM companies
  WHERE LOWER(name) LIKE '%optimens%'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE NOTICE '❌ Company Optimens not found';
    RETURN;
  END IF;

  -- Delete the company
  RAISE NOTICE '🗑️ Deleting company: %', v_company_id;
  SELECT delete_company_completely(v_company_id) INTO v_result;

  -- Show result
  RAISE NOTICE '✅ Result: %', v_result;
END $$;

-- Step 4: Also delete team@ncodestudio.it if exists and not in any other company
DELETE FROM auth.users
WHERE email = 'team@ncodestudio.it'
AND id NOT IN (
  SELECT user_id FROM company_users
);

-- Step 5: Verify deletion
SELECT
  'Remaining companies' as info,
  COUNT(*) as count
FROM companies;

SELECT
  name as company_name,
  slug,
  created_at
FROM companies
ORDER BY created_at DESC;

*/
