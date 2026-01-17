-- ============================================
-- FIX: Admin User Confirmation Token
-- ============================================
-- The user has NULL confirmation_token which causes
-- a 500 error during login. Fix it.
-- ============================================

-- Update the user to have empty string instead of NULL
UPDATE auth.users
SET
  confirmation_token = '',
  recovery_token = '',
  email_change_token_new = '',
  email_change_token_current = '',
  reauthentication_token = ''
WHERE email = 'alessandro.casu@ncodestudio.it';

-- Verify the fix
SELECT
  id,
  email,
  email_confirmed_at IS NOT NULL as email_confirmed,
  confirmation_token,
  encrypted_password IS NOT NULL as has_password
FROM auth.users
WHERE email = 'alessandro.casu@ncodestudio.it';
