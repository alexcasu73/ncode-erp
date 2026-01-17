-- ============================================
-- CREATE ADMIN USER IN SUPABASE AUTH
-- ============================================
-- Creates the admin user directly in auth.users
-- Password: Admin2024! (CHANGE THIS AFTER FIRST LOGIN!)
-- ============================================

-- Delete existing user if exists (to allow re-running script)
DELETE FROM auth.users WHERE email = 'alessandro.casu@ncodestudio.it';

-- Create admin user in auth.users
-- Password hash for "Admin2024!" using bcrypt
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  aud,
  role
) VALUES (
  'ccc6eeb7-88da-4d0c-8232-5070d5e645ae', -- Same ID as in public.users
  '00000000-0000-0000-0000-000000000000',
  'alessandro.casu@ncodestudio.it',
  crypt('Admin2024!', gen_salt('bf')), -- Password: Admin2024!
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Alessandro Casu"}',
  NOW(),
  NOW(),
  'authenticated',
  'authenticated'
);

-- Create identity record
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'ccc6eeb7-88da-4d0c-8232-5070d5e645ae',
  jsonb_build_object(
    'sub', 'ccc6eeb7-88da-4d0c-8232-5070d5e645ae',
    'email', 'alessandro.casu@ncodestudio.it'
  ),
  'email',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (provider, id) DO NOTHING;

-- Verify user creation
SELECT
  id,
  email,
  email_confirmed_at IS NOT NULL as email_confirmed,
  created_at
FROM auth.users
WHERE email = 'alessandro.casu@ncodestudio.it';

-- Verify public.users and company_users are linked
SELECT
  u.email,
  u.is_active,
  cu.role,
  c.name as company
FROM users u
LEFT JOIN company_users cu ON u.id = cu.user_id
LEFT JOIN companies c ON cu.company_id = c.id
WHERE u.id = 'ccc6eeb7-88da-4d0c-8232-5070d5e645ae';

-- ============================================
-- CREDENTIALS:
-- Email: alessandro.casu@ncodestudio.it
-- Password: Admin2024!
--
-- ⚠️  CHANGE PASSWORD AFTER FIRST LOGIN!
-- ============================================
