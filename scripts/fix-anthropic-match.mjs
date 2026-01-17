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

async function fixAnthropicMatch() {
  console.log('🔧 Fixing Anthropic match issue...\n');

  // The WRONG match: transaction 9f1dbf56 (DEL 02/01/26 ORE 15:52) is matched to CF-0307 (DEL 04/01/26 ORE 13:51)
  const wrongTxId = '9f1dbf56-fc89-46aa-9f01-9b92958b190d'; // DEL 02/01/26 ORE 15:52

  // The CORRECT transaction: 95577de9 (DEL 04/01/26 ORE 13:51) should be matched to CF-0307
  const correctTxId = '95577de9-b341-4908-9987-31927343db14'; // DEL 04/01/26 ORE 13:51

  const cashflowId = 'CF-0307'; // DEL 04/01/26 ORE 13:51

  // Step 1: Unmatch the wrong transaction
  console.log('Step 1: Unmatching wrong transaction...');
  const { error: unmatchError } = await supabase
    .from('bank_transactions')
    .update({
      match_status: 'pending',
      matched_cashflow_id: null,
      matched_invoice_id: null,
      match_confidence: null,
      match_reason: null
    })
    .eq('id', wrongTxId);

  if (unmatchError) {
    console.error('❌ Error unmatching:', unmatchError);
    return;
  }
  console.log('✅ Unmatched wrong transaction (DEL 02/01/26 ORE 15:52)\n');

  // Step 2: Match the correct transaction
  console.log('Step 2: Matching correct transaction...');
  const { error: matchError } = await supabase
    .from('bank_transactions')
    .update({
      match_status: 'matched',
      matched_cashflow_id: cashflowId,
      matched_invoice_id: 'Fattura_008',
      match_confidence: 95,
      match_reason: 'Match corretto: movimento CF-0307 con data e descrizione esatte (DEL 04/01/26 ORE 13:51)'
    })
    .eq('id', correctTxId);

  if (matchError) {
    console.error('❌ Error matching:', matchError);
    return;
  }
  console.log('✅ Matched correct transaction (DEL 04/01/26 ORE 13:51) to CF-0307\n');

  // Verify the fix
  console.log('Verifying fix...\n');

  const { data: txWrong } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('id', wrongTxId)
    .single();

  const { data: txCorrect } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('id', correctTxId)
    .single();

  console.log('Transaction DEL 02/01/26 ORE 15:52:');
  console.log(`  Status: ${txWrong?.match_status}, Matched CF: ${txWrong?.matched_cashflow_id || 'NONE'}`);

  console.log('\nTransaction DEL 04/01/26 ORE 13:51:');
  console.log(`  Status: ${txCorrect?.match_status}, Matched CF: ${txCorrect?.matched_cashflow_id || 'NONE'}`);

  console.log('\n✅ Fix completed!');
}

fixAnthropicMatch();
