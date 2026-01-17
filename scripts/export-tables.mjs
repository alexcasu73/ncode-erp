import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';

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

async function exportTables() {
  console.log('📊 Exporting invoices and cashflow_records tables...\n');

  // Export invoices
  console.log('📄 Fetching invoices...');
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: true });

  if (invoicesError) {
    console.error('❌ Error fetching invoices:', invoicesError);
    process.exit(1);
  }

  console.log(`✅ Fetched ${invoices.length} invoices`);

  // Export cashflow_records
  console.log('💰 Fetching cashflow_records...');
  const { data: cashflows, error: cashflowsError } = await supabase
    .from('cashflow_records')
    .select('*')
    .order('created_at', { ascending: true });

  if (cashflowsError) {
    console.error('❌ Error fetching cashflow_records:', cashflowsError);
    process.exit(1);
  }

  console.log(`✅ Fetched ${cashflows.length} cashflow records`);

  // Create timestamp for filenames
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];

  // Export as JSON
  const jsonExport = {
    exportDate: new Date().toISOString(),
    tables: {
      invoices: invoices,
      cashflow_records: cashflows
    },
    counts: {
      invoices: invoices.length,
      cashflow_records: cashflows.length
    }
  };

  const jsonFilename = `export-${timestamp}.json`;
  writeFileSync(jsonFilename, JSON.stringify(jsonExport, null, 2));
  console.log(`\n✅ JSON export saved to: ${jsonFilename}`);

  // Export as SQL INSERT statements
  let sqlContent = `-- Database export generated on ${new Date().toISOString()}\n`;
  sqlContent += `-- Invoices: ${invoices.length}, Cashflow Records: ${cashflows.length}\n\n`;

  // Generate SQL for invoices
  sqlContent += `-- INVOICES TABLE\n`;
  sqlContent += `-- Total records: ${invoices.length}\n\n`;

  invoices.forEach(inv => {
    const values = Object.keys(inv).map(key => {
      const value = inv[key];
      if (value === null || value === undefined) return 'NULL';
      if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      return value;
    });

    const columns = Object.keys(inv).join(', ');
    sqlContent += `INSERT INTO invoices (${columns}) VALUES (${values.join(', ')});\n`;
  });

  sqlContent += `\n-- CASHFLOW RECORDS TABLE\n`;
  sqlContent += `-- Total records: ${cashflows.length}\n\n`;

  cashflows.forEach(cf => {
    const values = Object.keys(cf).map(key => {
      const value = cf[key];
      if (value === null || value === undefined) return 'NULL';
      if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      return value;
    });

    const columns = Object.keys(cf).join(', ');
    sqlContent += `INSERT INTO cashflow_records (${columns}) VALUES (${values.join(', ')});\n`;
  });

  const sqlFilename = `export-${timestamp}.sql`;
  writeFileSync(sqlFilename, sqlContent);
  console.log(`✅ SQL export saved to: ${sqlFilename}`);

  // Print summary
  console.log('\n📊 EXPORT SUMMARY:');
  console.log(`   Invoices: ${invoices.length} records`);
  console.log(`   Cashflow Records: ${cashflows.length} records`);
  console.log(`   \n   Files created:`);
  console.log(`   - ${jsonFilename} (JSON format)`);
  console.log(`   - ${sqlFilename} (SQL format)`);
}

exportTables().catch(err => {
  console.error('❌ Export failed:', err);
  process.exit(1);
});
