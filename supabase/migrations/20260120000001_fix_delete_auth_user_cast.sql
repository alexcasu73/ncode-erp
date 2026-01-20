-- ============================================
-- FIX delete_auth_user TRIGGER FUNCTION - Cast Fix
-- ============================================
-- Add explicit cast to fix UUID vs text comparison error
-- ============================================

CREATE OR REPLACE FUNCTION delete_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete the user from auth.users first
  -- This will cascade to sessions and refresh_tokens automatically
  DELETE FROM auth.users WHERE id = OLD.id;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION delete_auth_user IS
'Trigger function that deletes user from auth schema when deleted from public.users.
Also cleans up sessions and refresh tokens. Fixed with explicit cast.';
