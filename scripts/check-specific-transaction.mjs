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

async function checkSpecificTransaction() {
  console.log('🔍 Analyzing transaction: DEL 31/12/25 ORE 11:08\n');

  // Find the bank transaction
  const { data: tx, error: txError } = await supabase
    .from('bank_transactions')
    .select('*')
    .ilike('descrizione', '%DEL 31/12/25 ORE 11:08%')
    .single();

  if (txError || !tx) {
    console.error('❌ Transaction not found:', txError);
    return;
  }

  console.log('🏦 BANK TRANSACTION:');
  console.log(`   ID: ${tx.id}`);
  console.log(`   Data: ${tx.data} (valuta: ${tx.data_valuta})`);
  console.log(`   Importo: €${tx.importo}`);
  console.log(`   Tipo: ${tx.tipo}`);
  console.log(`   Match Status: ${tx.match_status}`);
  console.log(`   Matched CF: ${tx.matched_cashflow_id || 'NONE'}`);
  console.log(`   Descrizione: "${tx.descrizione}"`);

  // Search for cashflow records with €20 around that date
  console.log('\n\n💰 CASHFLOW RECORDS with €20 in late December/early January:');

  const { data: cashflows } = await supabase
    .from('cashflow_records')
    .select('*, invoices(*)')
    .eq('tipo', 'Uscita')
    .or('importo.eq.20,invoices.flusso.eq.20')
    .gte('data_pagamento', '2025-12-25')
    .lte('data_pagamento', '2026-01-10')
    .order('data_pagamento', { ascending: true });

  if (cashflows && cashflows.length > 0) {
    cashflows.forEach(cf => {
      const invoiceAmount = cf.invoices ? (cf.invoices.flusso || 0) + (cf.invoices.iva || 0) : 0;
      const amount = cf.importo || invoiceAmount;

      console.log(`\n   ${cf.id}:`);
      console.log(`      Data: ${cf.data_pagamento}`);
      console.log(`      Importo: €${amount} (CF: ${cf.importo}, Invoice: ${invoiceAmount})`);
      console.log(`      Invoice: ${cf.invoice_id || 'NONE'}`);
      console.log(`      Note: "${cf.note?.substring(0, 80) || 'N/A'}"`);
      if (cf.invoices) {
        console.log(`      Invoice Note: "${cf.invoices.note?.substring(0, 80) || 'N/A'}"`);
      }
    });
  } else {
    console.log('   None found');
  }

  // Search specifically for Anthropic cashflows in that period
  console.log('\n\n🔍 ANTHROPIC CASHFLOW RECORDS (Dec 25 - Jan 10):');

  const { data: anthropicCfs } = await supabase
    .from('cashflow_records')
    .select('*, invoices(*)')
    .or('note.ilike.%anthro%,descrizione.ilike.%anthro%,invoices.note.ilike.%anthro%')
    .gte('data_pagamento', '2025-12-25')
    .lte('data_pagamento', '2026-01-10')
    .order('data_pagamento', { ascending: true });

  if (anthropicCfs && anthropicCfs.length > 0) {
    anthropicCfs.forEach(cf => {
      const invoiceAmount = cf.invoices ? (cf.invoices.flusso || 0) + (cf.invoices.iva || 0) : 0;
      const amount = cf.importo || invoiceAmount;

      console.log(`\n   ${cf.id}:`);
      console.log(`      Data: ${cf.data_pagamento}`);
      console.log(`      Importo: €${amount}`);
      console.log(`      Invoice: ${cf.invoice_id || 'NONE'}`);
      console.log(`      Note: "${cf.note?.substring(0, 100) || 'N/A'}"`);
      if (cf.invoices) {
        console.log(`      Invoice Note: "${cf.invoices.note?.substring(0, 100) || 'N/A'}"`);
      }
    });
  } else {
    console.log('   None found');
  }

  // Search for ANY cashflow or invoice matching the description
  console.log('\n\n🔎 SEARCHING for "31/12/25" or "11:08" in notes:');

  const { data: matchingCfs } = await supabase
    .from('cashflow_records')
    .select('*, invoices(*)')
    .or('note.ilike.%31/12/25%,invoices.note.ilike.%31/12/25%')
    .order('data_pagamento', { ascending: false });

  if (matchingCfs && matchingCfs.length > 0) {
    console.log(`\n   Found ${matchingCfs.length} cashflow records mentioning "31/12/25":`);
    matchingCfs.forEach(cf => {
      const invoiceAmount = cf.invoices ? (cf.invoices.flusso || 0) + (cf.invoices.iva || 0) : 0;
      const amount = cf.importo || invoiceAmount;

      console.log(`\n   ${cf.id}:`);
      console.log(`      Data: ${cf.data_pagamento}`);
      console.log(`      Importo: €${amount}`);
      console.log(`      Invoice: ${cf.invoice_id || 'NONE'}`);
      console.log(`      Note: "${cf.note?.substring(0, 100) || 'N/A'}"`);
      if (cf.invoices) {
        console.log(`      Invoice Note: "${cf.invoices.note?.substring(0, 100) || 'N/A'}"`);
      }
    });
  } else {
    console.log('   None found with "31/12/25"');
  }

  // Check if there's an invoice with this description
  console.log('\n\n📄 INVOICES mentioning "31/12/25":');

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .or('note.ilike.%31/12/25%,nome_progetto.ilike.%31/12/25%')
    .order('data', { ascending: false });

  if (invoices && invoices.length > 0) {
    console.log(`\n   Found ${invoices.length} invoices:`);
    invoices.forEach(inv => {
      const total = (inv.flusso || 0) + (inv.iva || 0);
      console.log(`\n   ${inv.id}:`);
      console.log(`      Data: ${inv.data}`);
      console.log(`      Totale: €${total}`);
      console.log(`      Nome: "${inv.nome_progetto?.substring(0, 80) || 'N/A'}"`);
      console.log(`      Note: "${inv.note?.substring(0, 80) || 'N/A'}"`);
    });
  } else {
    console.log('   None found');
  }
}

checkSpecificTransaction();
