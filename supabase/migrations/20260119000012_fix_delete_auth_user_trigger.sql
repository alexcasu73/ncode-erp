-- ============================================
-- FIX delete_auth_user TRIGGER FUNCTION
-- ============================================
-- Updated to also delete sessions and refresh tokens
-- before deleting the user from auth.users
-- ============================================

CREATE OR REPLACE FUNCTION delete_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete sessions and refresh tokens first
  -- This ensures clean logout when user is deleted
  DELETE FROM auth.sessions WHERE user_id = OLD.id;
  DELETE FROM auth.refresh_tokens WHERE user_id = OLD.id;

  -- Delete the user from auth.users
  DELETE FROM auth.users WHERE id = OLD.id;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION delete_auth_user IS
'Trigger function that deletes user from auth schema when deleted from public.users.
Also cleans up sessions and refresh tokens.';
