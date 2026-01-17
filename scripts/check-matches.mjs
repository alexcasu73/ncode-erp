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

async function checkMatches() {
  console.log('🔍 Analyzing Anthropic matches...\n');

  // Get all Anthropic bank transactions
  const { data: transactions, error: txError } = await supabase
    .from('bank_transactions')
    .select('*')
    .ilike('descrizione', '%anthropic%')
    .order('data', { ascending: true });

  if (txError) {
    console.error('Error:', txError);
    return;
  }

  // Get all Anthropic cashflow records
  const { data: cashflows, error: cfError } = await supabase
    .from('cashflow_records')
    .select('*')
    .or('note.ilike.%anthro%,descrizione.ilike.%anthro%')
    .order('data_pagamento', { ascending: true });

  if (cfError) {
    console.error('Error:', cfError);
    return;
  }

  console.log('📊 BANK TRANSACTIONS vs CASHFLOW MATCHES:\n');

  transactions.forEach(tx => {
    const matchedCf = cashflows.find(cf => cf.id === tx.matched_cashflow_id);

    console.log(`\n🏦 BANK TX: ${tx.id.substring(0, 8)}...`);
    console.log(`   Data: ${tx.data} (valuta: ${tx.data_valuta})`);
    console.log(`   Importo: €${tx.importo}`);
    console.log(`   Status: ${tx.match_status}`);
    console.log(`   Desc: "${tx.descrizione?.substring(0, 80)}"`);

    if (matchedCf) {
      console.log(`   ✅ MATCHED WITH: ${matchedCf.id}`);
      console.log(`      CF Data: ${matchedCf.data_pagamento}`);
      console.log(`      CF Importo: €${matchedCf.importo}`);
      console.log(`      CF Note: "${matchedCf.note?.substring(0, 80)}"`);
    } else if (tx.matched_cashflow_id) {
      console.log(`   ⚠️  MATCHED BUT CF NOT FOUND: ${tx.matched_cashflow_id}`);
    } else {
      console.log(`   ❌ NOT MATCHED`);
    }
  });

  console.log('\n\n💰 CASHFLOW RECORDS WITHOUT MATCHING TX:\n');

  const unmatchedCfs = cashflows.filter(cf => {
    return !transactions.some(tx => tx.matched_cashflow_id === cf.id);
  });

  unmatchedCfs.forEach(cf => {
    console.log(`\n💵 CASHFLOW: ${cf.id}`);
    console.log(`   Data: ${cf.data_pagamento}`);
    console.log(`   Importo: €${cf.importo}`);
    console.log(`   Note: "${cf.note?.substring(0, 100)}"`);
  });

  // Check the specific problematic one
  console.log('\n\n🔎 SPECIFIC CASE: Transaction "DEL 04/01/26 ORE 13:51":\n');

  const problematicTx = transactions.find(tx => tx.descrizione?.includes('DEL 04/01/26 ORE 13:51'));
  const potentialCf = cashflows.find(cf => cf.note?.includes('DEL 04/01/26 ORE 13:51'));

  if (problematicTx) {
    console.log('🏦 Bank Transaction:');
    console.log(`   ID: ${problematicTx.id}`);
    console.log(`   Data: ${problematicTx.data}, Valuta: ${problematicTx.data_valuta}`);
    console.log(`   Importo: €${problematicTx.importo}`);
    console.log(`   Status: ${problematicTx.match_status}`);
    console.log(`   Matched CF: ${problematicTx.matched_cashflow_id || 'NONE'}`);
  }

  if (potentialCf) {
    console.log('\n💵 Cashflow Record:');
    console.log(`   ID: ${potentialCf.id}`);
    console.log(`   Data: ${potentialCf.data_pagamento}`);
    console.log(`   Importo: €${potentialCf.importo}`);
    console.log(`   Invoice ID: ${potentialCf.invoice_id || 'NONE'}`);
  }
}

checkMatches();
