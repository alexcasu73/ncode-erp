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

async function checkAnthropicData() {
  console.log('🔍 Searching for Anthropic-related transactions...\n');

  // Check cashflow records
  console.log('📊 CASHFLOW RECORDS:');
  const { data: cashflows, error: cfError } = await supabase
    .from('cashflow_records')
    .select('*')
    .or('note.ilike.%anthro%,descrizione.ilike.%anthro%')
    .order('data_pagamento', { ascending: false })
    .limit(10);

  if (cfError) {
    console.error('Error querying cashflow:', cfError);
  } else {
    console.log(`Found ${cashflows?.length || 0} cashflow records:`);
    cashflows?.forEach(cf => {
      console.log(`  - ID: ${cf.id}, Data: ${cf.data_pagamento}, Importo: €${cf.importo}, Note: "${cf.note || cf.descrizione}"`);
    });
  }

  // Check bank transactions
  console.log('\n🏦 BANK TRANSACTIONS:');
  const { data: transactions, error: txError } = await supabase
    .from('bank_transactions')
    .select('*')
    .ilike('descrizione', '%anthro%')
    .order('data', { ascending: false })
    .limit(10);

  if (txError) {
    console.error('Error querying bank_transactions:', txError);
  } else {
    console.log(`Found ${transactions?.length || 0} bank transactions:`);
    transactions?.forEach(tx => {
      console.log(`  - ID: ${tx.id}, Data: ${tx.data}, Importo: €${tx.importo}, Tipo: ${tx.tipo}`);
      console.log(`    Descrizione: "${tx.descrizione}"`);
      console.log(`    Match Status: ${tx.match_status}, Matched CF: ${tx.matched_cashflow_id || 'N/A'}`);
    });
  }

  // Check for data valuta 04/01/2026
  console.log('\n📅 BANK TRANSACTIONS ON 2026-01-04:');
  const { data: jan4Txs, error: jan4Error } = await supabase
    .from('bank_transactions')
    .select('*')
    .or('data.eq.2026-01-04,data_valuta.eq.2026-01-04')
    .order('data', { ascending: false });

  if (jan4Error) {
    console.error('Error querying transactions:', jan4Error);
  } else {
    console.log(`Found ${jan4Txs?.length || 0} transactions:`);
    jan4Txs?.forEach(tx => {
      console.log(`  - ID: ${tx.id}, Importo: €${tx.importo}, Tipo: ${tx.tipo}, Match: ${tx.match_status}`);
      console.log(`    Descrizione: "${tx.descrizione?.substring(0, 100)}..."`);
    });
  }
}

checkAnthropicData();
