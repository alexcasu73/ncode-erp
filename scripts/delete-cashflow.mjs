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

async function deleteCashflowRecord() {
  console.log('🗑️  Deleting cashflow record CF-0201...\n');

  try {
    const { error } = await supabase
      .from('cashflow_records')
      .delete()
      .eq('id', 'CF-0201');

    if (error) {
      throw error;
    }

    console.log('✅ Successfully deleted movement CF-0201');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteCF0201();
