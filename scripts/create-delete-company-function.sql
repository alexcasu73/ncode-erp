-- ============================================
-- CREATE FUNCTION TO DELETE COMPANY
-- ============================================
-- This function properly deletes a company and
-- all associated data including auth.users
-- ============================================

CREATE OR REPLACE FUNCTION delete_company_completely(company_id_to_delete UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Run with elevated privileges
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_company_completely(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION delete_company_completely IS
'Deletes a company and all associated data including auth users. Only admins should call this.';
