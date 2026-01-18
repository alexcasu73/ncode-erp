-- Add INSERT policy for users table
-- This allows users to create their own profile when signing up

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert their own profile" ON users
    FOR INSERT
    WITH CHECK (id = auth.uid());

-- Policy: Allow authenticated users to insert profiles (needed for admin creating users)
-- This is more permissive but necessary for user management
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;

CREATE POLICY "Allow user profile creation" ON users
    FOR INSERT
    WITH CHECK (true);

-- Add comment
COMMENT ON POLICY "Allow user profile creation" ON users IS 'Allows user profile creation during signup and by admins';
