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

async function fixOrphanedCashflows() {
  console.log('🔍 Finding orphaned cashflow records...\n');

  // Get cashflow records with null invoice_id but that were auto-created
  const { data: orphanedCfs, error: cfError } = await supabase
    .from('cashflow_records')
    .select('*')
    .is('invoice_id', null)
    .like('note', '%Movimento automatico da riconciliazione%');

  if (cfError) {
    console.error('❌ Error:', cfError);
    return;
  }

  if (!orphanedCfs || orphanedCfs.length === 0) {
    console.log('✅ No orphaned cashflow records found!');
    return;
  }

  console.log(`Found ${orphanedCfs.length} orphaned cashflow records\n`);

  // For each orphaned cashflow, find the corresponding bank transaction
  for (const cf of orphanedCfs) {
    console.log(`\n📝 Processing ${cf.id}...`);
    console.log(`   Note: "${cf.note?.substring(0, 80)}..."`);

    // Find bank transaction that matches this cashflow
    const { data: tx, error: txError } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('matched_cashflow_id', cf.id)
      .maybeSingle();

    if (txError) {
      console.error(`   ❌ Error finding transaction:`, txError);
      continue;
    }

    if (!tx) {
      console.log(`   ⚠️  No bank transaction found for this cashflow`);
      continue;
    }

    console.log(`   🏦 Found bank transaction: ${tx.id.substring(0, 8)}...`);
    console.log(`      Matched invoice: ${tx.matched_invoice_id || 'NONE'}`);

    if (tx.matched_invoice_id) {
      // Update the cashflow with the correct invoice_id
      const { error: updateError } = await supabase
        .from('cashflow_records')
        .update({ invoice_id: tx.matched_invoice_id })
        .eq('id', cf.id);

      if (updateError) {
        console.error(`   ❌ Error updating:`, updateError);
      } else {
        console.log(`   ✅ Updated ${cf.id}.invoice_id → ${tx.matched_invoice_id}`);
      }
    } else {
      console.log(`   ⚠️  Bank transaction has no matched_invoice_id`);

      // Try to find the invoice by matching the description
      const desc = cf.note?.replace('Movimento automatico da riconciliazione - ', '');

      // Search for invoice with same description in nome_progetto or note
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, nome_progetto, note, flusso, iva')
        .or(`nome_progetto.eq.${desc},note.eq.${desc}`)
        .limit(1);

      if (invoices && invoices.length > 0) {
        const invoice = invoices[0];
        console.log(`   🔍 Found matching invoice by description: ${invoice.id}`);

        // Update both cashflow and transaction
        await supabase
          .from('cashflow_records')
          .update({ invoice_id: invoice.id })
          .eq('id', cf.id);

        await supabase
          .from('bank_transactions')
          .update({ matched_invoice_id: invoice.id })
          .eq('id', tx.id);

        console.log(`   ✅ Updated ${cf.id} and transaction with invoice ${invoice.id}`);
      }
    }
  }

  // Final verification
  console.log('\n\n🔍 Final verification...');
  const { data: stillOrphaned } = await supabase
    .from('cashflow_records')
    .select('id')
    .is('invoice_id', null)
    .like('note', '%Movimento automatico da riconciliazione%');

  if (stillOrphaned && stillOrphaned.length > 0) {
    console.log(`⚠️  Still ${stillOrphaned.length} orphaned cashflow records:`);
    stillOrphaned.forEach(cf => console.log(`   - ${cf.id}`));
  } else {
    console.log('✅ All auto-created cashflow records now have invoice references!');
  }
}

fixOrphanedCashflows();
