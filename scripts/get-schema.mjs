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

async function getSchema() {
  console.log('🔍 Fetching database schema...\n');

  // Get all tables
  const tables = [
    'invoices',
    'cashflow_records',
    'deals',
    'bank_transactions',
    'reconciliation_sessions',
    'settings'
  ];

  const schema = {};

  for (const table of tables) {
    console.log(`📋 Analyzing table: ${table}`);

    // Get sample record to understand structure
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.error(`   ❌ Error: ${error.message}`);
      continue;
    }

    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      schema[table] = {
        columns: columns,
        sample: data[0]
      };
      console.log(`   ✅ Found ${columns.length} columns`);
    } else {
      console.log(`   ⚠️  No data found`);
    }
  }

  // Save schema
  const output = {
    exportDate: new Date().toISOString(),
    tables: schema
  };

  writeFileSync('database-schema.json', JSON.stringify(output, null, 2));
  console.log('\n✅ Schema saved to: database-schema.json');

  // Print summary
  console.log('\n📊 DATABASE SCHEMA SUMMARY:\n');
  for (const [tableName, tableInfo] of Object.entries(schema)) {
    console.log(`${tableName}:`);
    console.log(`  Columns: ${tableInfo.columns.join(', ')}`);
    console.log('');
  }
}

getSchema().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
