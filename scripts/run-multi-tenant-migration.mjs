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

console.log('⚠️  WARNING: This will run the multi-tenant migration!');
console.log('   Make sure you have backed up your database before proceeding.');
console.log('');
console.log('📋 Migration will:');
console.log('   1. Create companies, users, and company_users tables');
console.log('   2. Add company_id to all existing tables');
console.log('   3. Create Ncode Studio company');
console.log('   4. Migrate all existing data to Ncode Studio');
console.log('   5. Enable Row Level Security (RLS)');
console.log('   6. Create RLS policies');
console.log('');
console.log('⚠️  NOTE: This migration requires SERVICE ROLE KEY, not anon key!');
console.log('   Please use the Supabase SQL Editor to run the migration manually.');
console.log('');
console.log('📄 Migration file: sql/multi-tenant-migration.sql');
console.log('');
console.log('Steps to run manually:');
console.log('1. Go to your Supabase project dashboard');
console.log('2. Navigate to SQL Editor');
console.log('3. Create a new query');
console.log('4. Copy the contents of sql/multi-tenant-migration.sql');
console.log('5. Paste and run the query');
console.log('');
console.log('After the migration is complete, run:');
console.log('  node scripts/create-admin-user.mjs');
