/**
 * Ncode ERP Server
 * Backend Express per gestire invio email e altre operazioni server-side
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createPool } from './db/pool.js';
import { initEmailClient } from './email/email.service.js';
import { errorHandler } from './middleware/errorHandler.js';
import { supabaseAdmin } from './supabase/admin.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

// === SECURITY ===
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3004',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '5mb' }));

// === DATABASE ===
const pool = createPool(process.env.DATABASE_URL);

// === EMAIL SERVICE ===
let emailService = null;

// Function to initialize email service from database settings
async function initEmailFromSettings(companyId) {
  try {
    const result = await pool.query(
      'SELECT * FROM settings WHERE id = $1 AND company_id = $2',
      ['default', companyId]
    );

    if (result.rows.length === 0) {
      console.warn('⚠️  No email settings found for company:', companyId);
      return null;
    }

    const settings = result.rows[0];
    const provider = settings.email_provider || 'smtp';

    if (provider === 'google-oauth2' && settings.google_oauth2_enabled) {
      return initEmailClient({
        gmailUser: settings.google_user_email,
        gmailRefreshToken: settings.google_refresh_token,
        googleClientId: settings.google_client_id,
        googleClientSecret: settings.google_client_secret,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
        appName: 'Ncode ERP',
        primaryColor: '#3B82F6'
      });
    } else if (provider === 'smtp' && settings.smtp_enabled) {
      return initEmailClient({
        smtp: {
          host: settings.smtp_host,
          port: settings.smtp_port,
          secure: settings.smtp_secure,
          user: settings.smtp_user,
          pass: settings.smtp_password,
          from: settings.smtp_from_email,
          fromName: settings.smtp_from_name
        },
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
        appName: 'Ncode ERP',
        primaryColor: '#3B82F6'
      });
    }

    return null;
  } catch (err) {
    console.error('Error initializing email from settings:', err);
    return null;
  }
}

// === ROUTES ===

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ncode-erp-server'
  });
});

// Send invitation email
app.post('/api/email/send-invitation', async (req, res) => {
  try {
    const {
      companyId,
      toEmail,
      toName,
      inviterName,
      companyName,
      inviteToken,
      role,
      tempPassword // Optional temporary password
    } = req.body;

    // Validate required fields
    if (!companyId || !toEmail || !toName || !inviterName || !companyName || !inviteToken || !role) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['companyId', 'toEmail', 'toName', 'inviterName', 'companyName', 'inviteToken', 'role']
      });
    }

    // Initialize email service with company settings
    const emailClient = await initEmailFromSettings(companyId);

    if (!emailClient || !emailClient.isConfigured()) {
      return res.status(503).json({
        error: 'Email service not configured',
        message: 'Configure email settings in the application settings page'
      });
    }

    // Send invitation email (with optional tempPassword)
    await emailClient.sendInvitationEmail(
      toEmail,
      toName,
      inviteToken,
      inviterName,
      companyName,
      role,
      tempPassword // Pass temp password if provided
    );

    res.json({
      success: true,
      message: 'Invitation email sent successfully'
    });

  } catch (err) {
    console.error('Error sending invitation email:', err);
    res.status(500).json({
      error: 'Failed to send invitation email',
      message: err.message
    });
  }
});

// Test email configuration
app.post('/api/email/test', async (req, res) => {
  try {
    const { companyId, testEmail } = req.body;

    if (!companyId || !testEmail) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['companyId', 'testEmail']
      });
    }

    // Initialize email service with company settings
    const emailClient = await initEmailFromSettings(companyId);

    if (!emailClient || !emailClient.isConfigured()) {
      return res.status(503).json({
        error: 'Email service not configured',
        message: 'Configure email settings in the application settings page'
      });
    }

    // Send test invitation email
    await emailClient.sendInvitationEmail(
      testEmail,
      'Test User',
      'test-token-123',
      'Ncode ERP',
      'Test Company',
      'user'
    );

    res.json({
      success: true,
      message: 'Test email sent successfully'
    });

  } catch (err) {
    console.error('Error sending test email:', err);
    res.status(500).json({
      error: 'Failed to send test email',
      message: err.message
    });
  }
});

// Create user invitation with magic link
app.post('/api/users/create', async (req, res) => {
  try {
    const {
      email,
      full_name,
      company_id,
      role
    } = req.body;

    // Validate required fields (password not needed anymore)
    if (!email || !full_name || !company_id || !role) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['email', 'full_name', 'company_id', 'role']
      });
    }

    console.log('🔐 [Server] Creating invitation for:', email, 'company:', company_id);

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({
        error: 'User with this email already exists'
      });
    }

    // Generate secure random token
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    // Set expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invitation record
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('user_invitations')
      .insert({
        email,
        token,
        company_id,
        role,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (inviteError) {
      console.error('❌ [Server] Error creating invitation:', inviteError);
      return res.status(500).json({
        error: 'Failed to create invitation',
        message: inviteError.message
      });
    }

    console.log('✅ [Server] Created invitation with token');

    res.json({
      success: true,
      token,
      invitationId: invitation.id,
      expiresAt: expiresAt.toISOString(),
      message: 'Invitation created successfully'
    });

  } catch (err) {
    console.error('❌ [Server] Unexpected error creating invitation:', err);
    res.status(500).json({
      error: 'Failed to create invitation',
      message: err.message
    });
  }
});

// Complete user invitation (validate token and set password)
app.post('/api/users/complete-invitation', async (req, res) => {
  try {
    const {
      token,
      password,
      full_name
    } = req.body;

    // Validate required fields
    if (!token || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['token', 'password']
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters'
      });
    }

    console.log('🔗 [Server] Completing invitation with token:', token.substring(0, 8) + '...');

    // Get invitation by token
    const { data: invitation, error: fetchError } = await supabaseAdmin
      .from('user_invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (fetchError || !invitation) {
      return res.status(404).json({
        error: 'Invalid or expired invitation token'
      });
    }

    // Check if already used
    if (invitation.used_at) {
      return res.status(400).json({
        error: 'This invitation has already been used'
      });
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({
        error: 'This invitation has expired'
      });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || invitation.email.split('@')[0],
        company_id: invitation.company_id
      }
    });

    if (authError) {
      console.error('❌ [Server] Error creating auth user:', authError);
      return res.status(500).json({
        error: 'Failed to create user',
        message: authError.message
      });
    }

    const userId = authData.user.id;
    console.log('✅ [Server] Created auth user:', userId);

    // Create user record in users table
    const { error: userError } = await pool.query(
      'INSERT INTO users (id, email, full_name, is_active) VALUES ($1, $2, $3, $4)',
      [userId, invitation.email, full_name || invitation.email.split('@')[0], true]
    );

    if (userError) {
      console.error('❌ [Server] Error creating user record:', userError);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(500).json({
        error: 'Failed to create user profile',
        message: userError.message
      });
    }

    console.log('✅ [Server] Created user record');

    // Link user to company
    const { error: linkError } = await pool.query(
      'INSERT INTO company_users (user_id, company_id, role, is_active) VALUES ($1, $2, $3, $4)',
      [userId, invitation.company_id, invitation.role, true]
    );

    if (linkError) {
      console.error('❌ [Server] Error linking user to company:', linkError);
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(500).json({
        error: 'Failed to link user to company',
        message: linkError.message
      });
    }

    console.log('✅ [Server] Linked user to company');

    // Mark invitation as used
    await supabaseAdmin
      .from('user_invitations')
      .update({
        used_at: new Date().toISOString(),
        user_id: userId
      })
      .eq('id', invitation.id);

    console.log('✅ [Server] Marked invitation as used');

    res.json({
      success: true,
      userId,
      email: invitation.email,
      message: 'Account created successfully'
    });

  } catch (err) {
    console.error('❌ [Server] Unexpected error completing invitation:', err);
    res.status(500).json({
      error: 'Failed to complete invitation',
      message: err.message
    });
  }
});

// Validate invitation token (check if valid without completing)
app.get('/api/users/validate-invitation/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const { data: invitation, error } = await supabaseAdmin
      .from('user_invitations')
      .select('email, role, expires_at, used_at, companies!inner(name)')
      .eq('token', token)
      .single();

    if (error || !invitation) {
      return res.status(404).json({
        valid: false,
        error: 'Invalid invitation token'
      });
    }

    if (invitation.used_at) {
      return res.status(400).json({
        valid: false,
        error: 'This invitation has already been used'
      });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({
        valid: false,
        error: 'This invitation has expired'
      });
    }

    res.json({
      valid: true,
      email: invitation.email,
      role: invitation.role,
      companyName: invitation.companies?.name,
      expiresAt: invitation.expires_at
    });

  } catch (err) {
    console.error('❌ [Server] Error validating invitation:', err);
    res.status(500).json({
      valid: false,
      error: 'Failed to validate invitation'
    });
  }
});

// Delete user (server-side with admin privileges)
app.delete('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { company_id } = req.body;

    // Validate required fields
    if (!userId || !company_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['userId (in URL)', 'company_id (in body)']
      });
    }

    // === AUTHENTICATION ===
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !callerUser) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // === AUTHORIZATION: caller must be admin of the company ===
    const adminCheck = await pool.query(
      `SELECT role FROM company_users
       WHERE user_id = $1 AND company_id = $2 AND is_active = true`,
      [callerUser.id, company_id]
    );
    if (!adminCheck.rows.length || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // === PREVENT SELF-DELETION ===
    if (callerUser.id === userId) {
      return res.status(403).json({ error: 'Cannot delete your own account' });
    }

    console.log('🗑️ [Server] Deleting user:', userId, 'from company:', company_id, 'by:', callerUser.id);

    // 1. Delete company_users link
    await pool.query(
      'DELETE FROM company_users WHERE user_id = $1 AND company_id = $2',
      [userId, company_id]
    );

    console.log('✅ [Server] Deleted company_users link');

    // 2. Delete from users table (trigger deletes from auth.users automatically)
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    console.log('✅ [Server] Deleted user record');

    res.json({ success: true, message: 'User deleted successfully' });

  } catch (err) {
    console.error('❌ [Server] Unexpected error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// === AUTH ROUTES ===

/**
 * Register new user with email confirmation
 * Creates user in Supabase (unconfirmed) and sends confirmation email via Gmail API
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, adminName, companyName } = req.body;

    if (!email || !password || !adminName || !companyName) {
      return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
    }

    console.log(`📝 [Auth] Registration request for: ${email}`);

    // Initialize email service from env (for registration emails)
    const tempEmailService = initEmailClient({
      gmailUser: process.env.GMAIL_USER,
      gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN,
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3004',
      appName: 'Ncode ERP',
      primaryColor: '#3B82F6'
    });

    if (!tempEmailService.isConfigured()) {
      console.error('❌ Email service not configured');
      return res.status(500).json({ error: 'Servizio email non configurato. Contatta l\'amministratore.' });
    }

    // 1. Create company
    const generateSlug = (name) => {
      const baseSlug = name
        .toLowerCase()
        .trim()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const timestamp = Date.now().toString(36);
      return `${baseSlug}-${timestamp}`;
    };

    const companySlug = generateSlug(companyName);

    const { data: newCompanyId, error: companyError } = await supabaseAdmin
      .rpc('create_company_for_registration', {
        company_name: companyName,
        company_slug: companySlug,
      });

    if (companyError || !newCompanyId) {
      console.error('❌ Error creating company:', companyError);
      return res.status(500).json({ error: 'Errore nella creazione dell\'azienda. Riprova.' });
    }

    console.log(`✅ Company created: ${newCompanyId}`);

    // 2. Create user in Supabase Auth (email NOT confirmed)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // User must confirm email
      user_metadata: {
        name: adminName,
        company_id: newCompanyId,
      }
    });

    if (authError || !authData.user) {
      console.error('❌ Error creating auth user:', authError);
      console.error('❌ Error details:', JSON.stringify(authError, null, 2));

      // Cleanup company
      await supabaseAdmin.from('companies').delete().eq('id', newCompanyId);

      // Provide specific error messages in Italian
      let errorMessage = 'Errore nella creazione dell\'account';

      if (authError) {
        const errorMsg = authError.message?.toLowerCase() || '';
        const errorCode = authError.code || '';

        // Check for user already exists
        if (errorMsg.includes('already') ||
            errorMsg.includes('duplicate') ||
            errorCode === '23505' ||
            errorMsg.includes('user_email_key') ||
            errorMsg.includes('unique')) {
          errorMessage = 'Questa email è già registrata. Usa un\'altra email o prova ad accedere.';
        } else if (errorMsg.includes('password') && !errorMsg.includes('email')) {
          errorMessage = 'La password deve essere di almeno 8 caratteri.';
        } else if (errorMsg.includes('invalid') && errorMsg.includes('email')) {
          errorMessage = 'Formato email non valido.';
        } else {
          // For any other error, show the original message
          errorMessage = authError.message || 'Errore nella creazione dell\'account';
        }
      }

      return res.status(400).json({
        error: errorMessage
      });
    }

    const userId = authData.user.id;
    console.log(`✅ User created: ${userId} (unconfirmed)`);

    // 3. Complete user registration in DB
    const { error: registrationError } = await supabaseAdmin
      .rpc('complete_user_registration', {
        p_user_id: userId,
        p_email: email,
        p_full_name: adminName,
        p_company_id: newCompanyId,
      });

    if (registrationError) {
      console.error('❌ Error completing registration:', registrationError);
      return res.status(500).json({ error: 'Errore nel completamento della registrazione. Riprova.' });
    }

    console.log(`✅ User registration completed in DB`);

    // 4. Generate confirmation token
    const { data: tokenData, error: tokenError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: email
    });

    if (tokenError || !tokenData) {
      console.error('❌ Error generating confirmation token:', tokenError);
      return res.status(500).json({ error: 'Errore nella generazione del token di conferma. Riprova.' });
    }

    // Extract token from the generated link
    const confirmationToken = new URL(tokenData.properties.action_link).searchParams.get('token');

    // 5. Send confirmation email via Gmail API
    try {
      await tempEmailService.sendRegistrationConfirmationEmail(
        email,
        adminName,
        companyName,
        confirmationToken
      );
      console.log(`✅ Confirmation email sent to: ${email}`);
    } catch (emailError) {
      console.error('❌ Error sending confirmation email:', emailError);
      // Don't fail the registration if email fails
      return res.status(201).json({
        success: true,
        message: 'Account creato ma invio email fallito. Contatta il supporto per ricevere il link di conferma.',
        emailSent: false
      });
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to confirm your account.',
      emailSent: true
    });

  } catch (err) {
    console.error('❌ [Auth] Unexpected error during registration:', err);
    res.status(500).json({
      error: 'Registrazione fallita',
      message: err.message || 'Errore imprevisto durante la registrazione'
    });
  }
});

/**
 * Confirm email address
 * Verifies the token and confirms the user's email
 */
app.post('/api/auth/confirm-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Missing confirmation token' });
    }

    console.log(`✉️ [Auth] Email confirmation request`);

    // Verify the token and confirm the user
    const { data, error } = await supabaseAdmin.auth.verifyOtp({
      token_hash: token,
      type: 'signup'
    });

    if (error) {
      console.error('❌ Error confirming email:', error);
      return res.status(400).json({ error: 'Invalid or expired confirmation token' });
    }

    console.log(`✅ Email confirmed for user: ${data.user.email}`);

    res.json({
      success: true,
      message: 'Email confirmed successfully. You can now log in.',
      user: {
        email: data.user.email,
        confirmed: true
      }
    });

  } catch (err) {
    console.error('❌ [Auth] Unexpected error confirming email:', err);
    res.status(500).json({
      error: 'Email confirmation failed',
      message: err.message
    });
  }
});

// === AI PROXY ===
// Proxy per chiamate AI (Anthropic + OpenAI) — la API key non passa mai dal browser
app.post('/api/ai-proxy', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing authorization' });

    const { model, system, messages, max_tokens, company_id } = req.body;
    if (!model || !messages || !company_id) {
      return res.status(400).json({ error: 'Missing required fields: model, messages, company_id' });
    }

    const isOpenAI = model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3');

    // Legge la API key dal DB usando il JWT dell'utente (rispetta RLS)
    const { createClient } = await import('@supabase/supabase-js');
    const userSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: settingsData, error: settingsError } = await userSupabase
      .from('settings')
      .select('anthropic_api_key, openai_api_key')
      .eq('id', 'default')
      .eq('company_id', company_id)
      .single();

    if (isOpenAI) {
      if (settingsError || !settingsData?.openai_api_key) {
        return res.status(400).json({ error: 'API key OpenAI non configurata nelle impostazioni' });
      }

      const openaiMessages = system
        ? [{ role: 'system', content: system }, ...messages]
        : messages;

      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settingsData.openai_api_key}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: max_tokens ?? 500,
          messages: openaiMessages,
          response_format: { type: 'json_object' },
        }),
      });

      const data = await openaiRes.json();
      // Normalizza la risposta al formato Anthropic per compatibilità col client
      if (openaiRes.ok && data.choices?.[0]?.message?.content) {
        return res.json({
          content: [{ type: 'text', text: data.choices[0].message.content }],
          model: data.model,
        });
      }
      return res.status(openaiRes.status).json(data);
    } else {
      if (settingsError || !settingsData?.anthropic_api_key) {
        return res.status(400).json({ error: 'API key Anthropic non configurata nelle impostazioni' });
      }

      const body = { model, max_tokens: max_tokens ?? 500, messages };
      if (system) body.system = system;

      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settingsData.anthropic_api_key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      const data = await anthropicRes.json();
      return res.status(anthropicRes.status).json(data);
    }
  } catch (err) {
    console.error('[ai-proxy]', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// === ERROR HANDLING ===
app.use(errorHandler());

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// === START SERVER ===
async function start() {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║              Ncode ERP Backend Server                 ║
╠═══════════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}              ║
║  API Base URL: http://localhost:${PORT}/api              ║
╠═══════════════════════════════════════════════════════╣
║  Endpoints:                                           ║
║  - GET    /api/health              Health check      ║
║  - POST   /api/email/send-invitation Send invite     ║
║  - POST   /api/email/test          Test email        ║
║  - POST   /api/users/create        Create user       ║
║  - DELETE /api/users/:userId       Delete user       ║
╚═══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
