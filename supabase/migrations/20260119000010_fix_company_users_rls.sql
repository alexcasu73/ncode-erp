-- ============================================
-- FIX RLS on company_users table
-- ============================================
-- The company_users table is a join table between users and companies.
-- We disable RLS on it because security is enforced on the users table.
-- Users can only see users in their company via the users table RLS policy.

-- Drop restrictive policies that were causing only self-visibility
DROP POLICY IF EXISTS "Users can view company memberships" ON company_users;
DROP POLICY IF EXISTS "Users can create company memberships" ON company_users;

-- Disable RLS on company_users
-- Security is enforced by:
-- 1. The users table RLS policy (users can only see users in their company)
-- 2. Application-level checks (only admins can create/modify users)
ALTER TABLE company_users DISABLE ROW LEVEL SECURITY;

-- Note: We keep RLS enabled on the users table with the policy:
-- "Users can view profiles in their company" which ensures users can only
-- see other users who are in the same company
