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

async function addStatoCashflow() {
  console.log('🔧 Adding stato_fatturazione field to cashflow_records...\n');

  try {
    // Step 1: Check if column already exists
    const { data: existing, error: checkError } = await supabase
      .from('cashflow_records')
      .select('id, stato_fatturazione')
      .limit(1);

    if (checkError && !checkError.message.includes('column')) {
      throw checkError;
    }

    if (existing && existing.length > 0 && 'statoFatturazione' in existing[0]) {
      console.log('✅ Column stato_fatturazione already exists');
      return;
    }

    console.log('📝 Column does not exist, attempting to add via RPC...\n');

    // Since we can't run DDL directly from the client, we'll need to use a migration
    // For now, let's update the existing records to have the status from their invoices

    console.log('⚠️  Note: You need to run the SQL migration manually:');
    console.log('   1. Go to your Supabase dashboard');
    console.log('   2. Navigate to SQL Editor');
    console.log('   3. Run the contents of: supabase/migrations/20260114120000_add_stato_cashflow.sql');
    console.log('\nOr connect via psql and run:');
    console.log('   psql <your-connection-string> -f supabase/migrations/20260114120000_add_stato_cashflow.sql\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addStatoCashflow();
