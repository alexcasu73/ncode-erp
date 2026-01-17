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
const supabaseServiceKey = envVars.VITE_SUPABASE_SERVICE_KEY || envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase credentials not found in .env file');
  console.log('   Make sure you have VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_KEY set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🔧 Applying stato_fatturazione migration to cashflow_records...\n');

  try {
    // Step 1: Try to add the column
    console.log('📝 Step 1: Adding stato_fatturazione column...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE cashflow_records
        ADD COLUMN IF NOT EXISTS stato_fatturazione TEXT CHECK (stato_fatturazione IN ('Stimato', 'Effettivo', 'Nessuno'));
      `
    });

    if (alterError && !alterError.message.includes('already exists')) {
      // Try via direct query if RPC doesn't exist
      console.log('   Note: Cannot add column via API (requires database admin access)');
      console.log('   Please run the migration SQL manually:\n');
      const migrationSQL = readFileSync('supabase/migrations/20260114120000_add_stato_cashflow.sql', 'utf-8');
      console.log(migrationSQL);
      console.log('\n');
    } else {
      console.log('✅ Column added successfully');
    }

    // Step 2: Update existing records
    console.log('📝 Step 2: Updating existing records...');

    // Get all cashflow records
    const { data: records, error: fetchError } = await supabase
      .from('cashflow_records')
      .select('id, invoice_id, invoices(stato_fatturazione)');

    if (fetchError) {
      throw fetchError;
    }

    console.log(`   Found ${records.length} cashflow records to update`);

    // Update each record with the status from its invoice (or 'Nessuno' if no invoice)
    let updated = 0;
    for (const record of records) {
      const statoFatturazione = record.invoices?.stato_fatturazione || 'Nessuno';

      const { error: updateError } = await supabase
        .from('cashflow_records')
        .update({ stato_fatturazione: statoFatturazione })
        .eq('id', record.id);

      if (!updateError) {
        updated++;
      } else {
        console.error(`   ⚠️  Error updating ${record.id}:`, updateError.message);
      }
    }

    console.log(`✅ Updated ${updated} records\n`);

    console.log('🎉 Migration completed successfully!');
    console.log('\nNow each cashflow record can have its own independent status.');
    console.log('When you edit a cashflow record, its status won\'t affect other records linked to the same invoice.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📋 If the automatic migration failed, please run this SQL manually in your Supabase dashboard:\n');
    try {
      const migrationSQL = readFileSync('supabase/migrations/20260114120000_add_stato_cashflow.sql', 'utf-8');
      console.log(migrationSQL);
    } catch (e) {
      console.log('   (Could not read migration file)');
    }
    process.exit(1);
  }
}

applyMigration();
