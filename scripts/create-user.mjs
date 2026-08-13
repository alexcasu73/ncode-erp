/**
 * Crea un utente Supabase Auth e lo collega a un'azienda come admin.
 * Consolida create-test-user.mjs e create-auth-user.mjs in un unico script parametrico.
 *
 * Uso:
 *   node scripts/create-user.mjs --email admin@test.com --password admin123 \
 *     --full-name "Admin Test" --company-id 00000000-0000-0000-0000-000000000001 [--role admin]
 *
 * Le credenziali Supabase sono lette da .env (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    if (key) args[key] = argv[i + 1];
  }
  return args;
}

function loadEnv() {
  const envContent = readFileSync('.env', 'utf-8');
  const envVars = {};
  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  });
  return envVars;
}

const args = parseArgs(process.argv.slice(2));
const email = args.email;
const password = args.password;
const fullName = args['full-name'] || email?.split('@')[0];
const companyId = args['company-id'];
const role = args.role || 'admin';

if (!email || !password || !companyId) {
  console.error('❌ Uso: node scripts/create-user.mjs --email <email> --password <password> --company-id <uuid> [--full-name "Nome"] [--role admin]');
  process.exit(1);
}

const envVars = loadEnv();
const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Mancano le credenziali Supabase in .env (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createUser() {
  console.log(`👤 Creazione utente ${email}...\n`);

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, company_id: companyId },
  });

  if (authError) {
    console.error('❌ Errore creazione utente auth:', authError.message);
    process.exit(1);
  }

  console.log('✅ Utente auth creato:', authUser.user.id);

  const { error: userError } = await supabase
    .from('users')
    .upsert({ id: authUser.user.id, email, full_name: fullName, is_active: true }, { onConflict: 'id' });

  if (userError) {
    console.error('❌ Errore aggiornamento users:', userError.message);
  } else {
    console.log('✅ Tabella users aggiornata');
  }

  const { error: companyUserError } = await supabase
    .from('company_users')
    .upsert({ company_id: companyId, user_id: authUser.user.id, role, is_active: true }, { onConflict: 'company_id,user_id' });

  if (companyUserError) {
    console.error('❌ Errore collegamento company_users:', companyUserError.message);
  } else {
    console.log(`✅ Utente collegato all'azienda come ${role}`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅ UTENTE CREATO CON SUCCESSO');
  console.log(`📧 Email:    ${email}`);
  console.log(`🔑 Password: ${password}`);
  console.log('═══════════════════════════════════════════════════\n');
}

createUser().catch((err) => {
  console.error('❌ Errore:', err);
  process.exit(1);
});
