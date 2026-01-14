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

async function delete2025Invoices() {
  console.log('🗑️  Deleting all invoices from 2025...\n');

  try {
    // Get all invoices from 2025
    const { data: invoices, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('anno', 2025);

    if (fetchError) {
      throw fetchError;
    }

    if (!invoices || invoices.length === 0) {
      console.log('✅ No invoices from 2025 found');
      return;
    }

    console.log(`📋 Found ${invoices.length} invoices from 2025`);

    // Delete all invoices from 2025
    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('anno', 2025);

    if (deleteError) {
      throw deleteError;
    }

    console.log(`✅ Successfully deleted ${invoices.length} invoices from 2025`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

delete2025Invoices();
