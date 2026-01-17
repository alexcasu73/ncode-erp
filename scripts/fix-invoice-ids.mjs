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

async function fixInvoiceIds() {
  console.log('🔍 Checking all invoices with wrong ID format...\n');

  // Get all invoices with "Fattura_" prefix
  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('*')
    .like('id', 'Fattura_%')
    .order('anno', { ascending: true });

  if (invError) {
    console.error('❌ Error fetching invoices:', invError);
    return;
  }

  if (!invoices || invoices.length === 0) {
    console.log('✅ No invoices with wrong format found!');
    return;
  }

  console.log(`Found ${invoices.length} invoices with wrong ID format:\n`);

  // Prepare updates
  const updates = [];

  for (const invoice of invoices) {
    const oldId = invoice.id;
    // Extract number from "Fattura_XXX"
    const numero = oldId.replace('Fattura_', '');
    const newId = `${numero}/${invoice.anno}`;

    console.log(`  ${oldId} → ${newId} (anno: ${invoice.anno})`);

    updates.push({
      oldId,
      newId,
      anno: invoice.anno
    });
  }

  console.log('\n🔧 Starting migration...\n');

  // Step 1: Update cashflow_records that reference these invoices
  console.log('Step 1: Updating cashflow_records references...');
  let cfUpdated = 0;

  for (const update of updates) {
    const { data: cashflows } = await supabase
      .from('cashflow_records')
      .select('id')
      .eq('invoice_id', update.oldId);

    if (cashflows && cashflows.length > 0) {
      console.log(`  Updating ${cashflows.length} cashflow records for ${update.oldId} → ${update.newId}`);

      const { error: cfError } = await supabase
        .from('cashflow_records')
        .update({ invoice_id: update.newId })
        .eq('invoice_id', update.oldId);

      if (cfError) {
        console.error(`  ❌ Error updating cashflow for ${update.oldId}:`, cfError.message);
      } else {
        cfUpdated += cashflows.length;
      }
    }
  }
  console.log(`✅ Updated ${cfUpdated} cashflow records\n`);

  // Step 2: Update bank_transactions that reference these invoices
  console.log('Step 2: Updating bank_transactions references...');
  let txUpdated = 0;

  for (const update of updates) {
    const { data: transactions } = await supabase
      .from('bank_transactions')
      .select('id')
      .eq('matched_invoice_id', update.oldId);

    if (transactions && transactions.length > 0) {
      console.log(`  Updating ${transactions.length} bank transactions for ${update.oldId} → ${update.newId}`);

      const { error: txError } = await supabase
        .from('bank_transactions')
        .update({ matched_invoice_id: update.newId })
        .eq('matched_invoice_id', update.oldId);

      if (txError) {
        console.error(`  ❌ Error updating transactions for ${update.oldId}:`, txError.message);
      } else {
        txUpdated += transactions.length;
      }
    }
  }
  console.log(`✅ Updated ${txUpdated} bank transactions\n`);

  // Step 3: Now we can safely delete old invoices and insert with new IDs
  console.log('Step 3: Migrating invoice IDs...');
  let invMigrated = 0;

  for (const update of updates) {
    // Get the full invoice data
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', update.oldId)
      .single();

    if (fetchError || !invoice) {
      console.error(`  ❌ Error fetching invoice ${update.oldId}:`, fetchError?.message);
      continue;
    }

    // Insert with new ID
    const newInvoice = {
      ...invoice,
      id: update.newId
    };
    delete newInvoice.created_at; // Let DB set this
    delete newInvoice.updated_at; // Let DB set this

    const { error: insertError } = await supabase
      .from('invoices')
      .insert(newInvoice);

    if (insertError) {
      console.error(`  ❌ Error inserting invoice ${update.newId}:`, insertError.message);
      continue;
    }

    // Delete old invoice
    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', update.oldId);

    if (deleteError) {
      console.error(`  ❌ Error deleting old invoice ${update.oldId}:`, deleteError.message);
      // Note: new invoice is already created, so we have duplicates now
      // You may need to manually delete the new one
      continue;
    }

    console.log(`  ✅ Migrated ${update.oldId} → ${update.newId}`);
    invMigrated++;
  }

  console.log(`\n✅ Migration completed!`);
  console.log(`  - Invoices migrated: ${invMigrated}/${updates.length}`);
  console.log(`  - Cashflow records updated: ${cfUpdated}`);
  console.log(`  - Bank transactions updated: ${txUpdated}`);

  // Verify
  console.log('\n🔍 Verifying...');
  const { data: remainingWrong } = await supabase
    .from('invoices')
    .select('id')
    .like('id', 'Fattura_%');

  if (remainingWrong && remainingWrong.length > 0) {
    console.warn(`⚠️  Still ${remainingWrong.length} invoices with wrong format:`);
    remainingWrong.forEach(inv => console.log(`    - ${inv.id}`));
  } else {
    console.log('✅ All invoices now have correct format!');
  }
}

fixInvoiceIds();
