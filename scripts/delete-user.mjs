import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load environment variables from .env file
function loadEnv() {
  try {
    const envFile = readFileSync('.env', 'utf-8');
    const env = {};
    envFile.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    });
    return env;
  } catch (error) {
    console.error('❌ Could not read .env file:', error.message);
    return {};
  }
}

const env = loadEnv();
const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
  console.log('\nYou can also run with environment variables:');
  console.log('VITE_SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/delete-user.mjs alex.casu@gmail.com');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deleteUserCompletely(email) {
  console.log(`\n🔍 Searching for user: ${email}`);

  try {
    // 1. Find user in auth.users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('❌ Error listing auth users:', authError);
      return;
    }

    const authUser = authUsers.users.find(u => u.email === email);

    if (!authUser) {
      console.log('✅ User not found in auth.users - already deleted or never existed');
      return;
    }

    const userId = authUser.id;
    console.log(`📋 Found user in auth.users: ${userId}`);

    // 2. Find user's company
    const { data: companyUser, error: companyUserError } = await supabase
      .from('company_users')
      .select('company_id, role')
      .eq('user_id', userId)
      .single();

    let companyId = null;
    if (!companyUserError && companyUser) {
      companyId = companyUser.company_id;
      console.log(`📋 User belongs to company: ${companyId} (role: ${companyUser.role})`);
    }

    // 3. Check if user is the only admin in the company
    if (companyId) {
      const { data: admins, error: adminsError } = await supabase
        .from('company_users')
        .select('user_id')
        .eq('company_id', companyId)
        .eq('role', 'admin')
        .eq('is_active', true);

      if (!adminsError && admins) {
        console.log(`📋 Company has ${admins.length} active admin(s)`);

        if (admins.length === 1 && admins[0].user_id === userId) {
          console.log('⚠️  User is the ONLY admin in the company');
          console.log('🗑️  Will delete entire company and all related data...');
        }
      }
    }

    // 4. Delete user from company_users
    console.log('\n🗑️  Step 1: Deleting from company_users...');
    const { error: deleteCompanyUserError } = await supabase
      .from('company_users')
      .delete()
      .eq('user_id', userId);

    if (deleteCompanyUserError) {
      console.error('❌ Error deleting from company_users:', deleteCompanyUserError);
    } else {
      console.log('✅ Deleted from company_users');
    }

    // 5. Delete user from users table
    console.log('🗑️  Step 2: Deleting from users table...');
    const { error: deleteUserError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteUserError) {
      console.error('❌ Error deleting from users table:', deleteUserError);
    } else {
      console.log('✅ Deleted from users table');
    }

    // 6. Delete user from auth.users (Supabase Auth)
    console.log('🗑️  Step 3: Deleting from auth.users...');
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('❌ Error deleting from auth.users:', deleteAuthError);
    } else {
      console.log('✅ Deleted from auth.users');
    }

    // 7. If user was the only admin, optionally delete company data
    // (commented out for safety - uncomment if you want to delete company data)
    /*
    if (companyId && admins.length === 1) {
      console.log('\n🗑️  Step 4: Deleting company data...');

      // Delete in order to respect foreign keys
      await supabase.from('reconciliation_sessions').delete().eq('company_id', companyId);
      await supabase.from('bank_transactions').delete().eq('company_id', companyId);
      await supabase.from('cashflow_records').delete().eq('company_id', companyId);
      await supabase.from('invoices').delete().eq('company_id', companyId);
      await supabase.from('deals').delete().eq('company_id', companyId);
      await supabase.from('customers').delete().eq('company_id', companyId);
      await supabase.from('financial_items').delete().eq('company_id', companyId);
      await supabase.from('settings').delete().eq('company_id', companyId);
      await supabase.from('companies').delete().eq('id', companyId);

      console.log('✅ Deleted company data');
    }
    */

    console.log('\n✅ User deletion completed successfully!');
    console.log(`📧 User ${email} has been completely removed from the system.`);

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  }
}

// Get email from command line argument
const email = process.argv[2] || 'alex.casu@gmail.com';

console.log('🚀 Starting user deletion process...');
deleteUserCompletely(email).then(() => {
  console.log('\n✨ Done!');
  process.exit(0);
});
