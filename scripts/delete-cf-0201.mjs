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
  console.log('🗑️  Deleting cashflow record CF-0201 (53.900€)...\n');

  try {
    // First check if it exists
    const { data: existing, error: fetchError } = await supabase
      .from('cashflow_records')
      .select('*')
      .eq('id', 'CF-0201')
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        console.log('✅ Record CF-0201 not found - already deleted or never existed');
        return;
      }
      throw fetchError;
    }

    console.log('📋 Found record:', {
      id: existing.id,
      importo: existing.importo,
      dataPagamento: existing.data_pagamento,
      invoiceId: existing.invoice_id,
      note: existing.note
    });

    // Delete it
    const { error: deleteError } = await supabase
      .from('cashflow_records')
      .delete()
      .eq('id', 'CF-0201');

    if (deleteError) {
      throw deleteError;
    }

    console.log('✅ Successfully deleted cashflow record CF-0201');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteCashflowRecord();
