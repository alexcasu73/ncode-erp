import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file manually
const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const NCODE_STUDIO_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_EMAIL = 'alessandro.casu@ncodestudio.it';

async function createAdminUser() {
  console.log('👤 Creating admin user for Ncode Studio...\n');

  // This script expects the user to already exist in auth.users
  // The user should sign up first through Supabase Auth UI or the application

  console.log('⚠️  IMPORTANT: Before running this script, make sure:');
  console.log('   1. The user alessandro.casu@ncodestudio.it has signed up via Supabase Auth');
  console.log('   2. The email has been confirmed');
  console.log('   3. The multi-tenant migration has been run');
  console.log('');

  // Check if Ncode Studio company exists
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('id', NCODE_STUDIO_COMPANY_ID)
    .single();

  if (companyError || !company) {
    console.error('❌ Ncode Studio company not found!');
    console.error('   Please run the multi-tenant migration first.');
    process.exit(1);
  }

  console.log('✅ Ncode Studio company found:', company.name);

  // For this script to work, we need the user's UUID from auth.users
  // Since we can't query auth.users with anon key, we'll create a SQL file instead

  console.log('\n📝 To complete the admin user setup, run this SQL in Supabase SQL Editor:\n');

  const sql = `
-- Step 1: Get the user ID (run this first to check the user exists)
SELECT id, email FROM auth.users WHERE email = '${ADMIN_EMAIL}';

-- Step 2: If user exists, copy the ID and use it below (replace USER_ID_HERE)
-- If user doesn't exist, create them first through the Supabase Auth UI

-- Step 3: Create the user record (replace USER_ID_HERE with actual UUID)
INSERT INTO users (id, email, full_name, is_active)
VALUES (
  'USER_ID_HERE',  -- Replace with actual UUID from Step 1
  '${ADMIN_EMAIL}',
  'Alessandro Casu',
  true
)
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Step 4: Link user to Ncode Studio as admin (replace USER_ID_HERE)
INSERT INTO company_users (company_id, user_id, role, is_active)
VALUES (
  '${NCODE_STUDIO_COMPANY_ID}',
  'USER_ID_HERE',  -- Replace with actual UUID from Step 1
  'admin',
  true
)
ON CONFLICT (company_id, user_id) DO UPDATE
SET role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Step 5: Verify the setup
SELECT
  u.email,
  u.full_name,
  c.name as company_name,
  cu.role
FROM users u
JOIN company_users cu ON u.id = cu.user_id
JOIN companies c ON cu.company_id = c.id
WHERE u.email = '${ADMIN_EMAIL}';
`;

  console.log(sql);
  console.log('\n✅ Copy and run the SQL above in the Supabase SQL Editor');
}

createAdminUser().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
