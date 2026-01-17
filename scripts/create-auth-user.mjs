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
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Mancano le credenziali Supabase in .env');
  console.error('   Serve: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create admin client (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const NCODE_STUDIO_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_EMAIL = 'alessandro.casu@ncodestudio.it';
const ADMIN_PASSWORD = 'Ncode2024!'; // Password temporanea - CAMBIALA dopo il primo login!

console.log('👤 Creazione utente admin per Supabase Auth...\n');

try {
  // 1. Create user in auth.users
  console.log('📝 Creazione utente in Supabase Auth...');
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true, // Auto-conferma email
    user_metadata: {
      full_name: 'Alessandro Casu'
    }
  });

  if (authError) {
    console.error('❌ Errore creazione utente auth:', authError.message);
    process.exit(1);
  }

  console.log('✅ Utente auth creato:', authUser.user.id);

  // 2. Update/create user in public.users table
  console.log('\n📝 Aggiornamento tabella users...');
  const { error: userError } = await supabase
    .from('users')
    .upsert({
      id: authUser.user.id,
      email: ADMIN_EMAIL,
      is_active: true
    }, {
      onConflict: 'id'
    });

  if (userError) {
    console.error('❌ Errore aggiornamento users:', userError.message);
  } else {
    console.log('✅ Tabella users aggiornata');
  }

  // 3. Link user to company
  console.log('\n📝 Collegamento utente a Ncode Studio...');
  const { error: companyUserError } = await supabase
    .from('company_users')
    .upsert({
      company_id: NCODE_STUDIO_ID,
      user_id: authUser.user.id,
      role: 'admin',
      is_active: true
    }, {
      onConflict: 'company_id,user_id'
    });

  if (companyUserError) {
    console.error('❌ Errore collegamento company_users:', companyUserError.message);
  } else {
    console.log('✅ Utente collegato a Ncode Studio come admin');
  }

  // 4. Verify
  console.log('\n🔍 Verifica configurazione...');
  const { data: verification, error: verifyError } = await supabase
    .from('users')
    .select(`
      email,
      is_active,
      company_users (
        role,
        companies (
          name
        )
      )
    `)
    .eq('id', authUser.user.id)
    .single();

  if (!verifyError && verification) {
    console.log('✅ Configurazione verificata:');
    console.log(`   Email: ${verification.email}`);
    console.log(`   Azienda: ${verification.company_users[0]?.companies?.name}`);
    console.log(`   Ruolo: ${verification.company_users[0]?.role}`);
  }

  console.log('\n═══════════════════════════════════════════════════\n');
  console.log('✅ UTENTE CREATO CON SUCCESSO!\n');
  console.log('📧 Email:    ' + ADMIN_EMAIL);
  console.log('🔑 Password: ' + ADMIN_PASSWORD);
  console.log('⚠️  IMPORTANTE: Cambia la password dopo il primo login!\n');
  console.log('═══════════════════════════════════════════════════\n');

} catch (err) {
  console.error('❌ Errore:', err);
  process.exit(1);
}
