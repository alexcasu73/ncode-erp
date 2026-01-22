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
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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

    console.log('🗑️ [Server] Deleting user:', userId, 'from company:', company_id);

    // 1. Delete company_users link
    const { error: linkError } = await pool.query(
      'DELETE FROM company_users WHERE user_id = $1 AND company_id = $2',
      [userId, company_id]
    );

    if (linkError) {
      console.error('❌ [Server] Error deleting company_users link:', linkError);
      return res.status(500).json({
        error: 'Failed to delete company link',
        message: linkError.message
      });
    }

    console.log('✅ [Server] Deleted company_users link');

    // 2. Delete from users table
    // This will trigger the database trigger to delete from auth.users automatically
    const { error: userError } = await pool.query(
      'DELETE FROM users WHERE id = $1',
      [userId]
    );

    if (userError) {
      console.error('❌ [Server] Error deleting user record:', userError);
      return res.status(500).json({
        error: 'Failed to delete user record',
        message: userError.message
      });
    }

    console.log('✅ [Server] Deleted user record (trigger will delete from auth.users)');

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (err) {
    console.error('❌ [Server] Unexpected error deleting user:', err);
    res.status(500).json({
      error: 'Failed to delete user',
      message: err.message
    });
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
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`📝 [Auth] Registration request for: ${email}`);

    // Initialize email service from env (for registration emails)
    const tempEmailService = initEmailClient({
      gmailUser: process.env.GMAIL_USER,
      gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN,
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      appName: 'Ncode ERP',
      primaryColor: '#3B82F6'
    });

    if (!tempEmailService.isConfigured()) {
      console.error('❌ Email service not configured');
      return res.status(500).json({ error: 'Email service not configured' });
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
      return res.status(500).json({ error: 'Failed to create company' });
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
      // Cleanup company
      await supabaseAdmin.from('companies').delete().eq('id', newCompanyId);
      return res.status(500).json({ error: 'Failed to create user' });
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
      return res.status(500).json({ error: 'Failed to complete registration' });
    }

    console.log(`✅ User registration completed in DB`);

    // 4. Generate confirmation token
    const { data: tokenData, error: tokenError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: email
    });

    if (tokenError || !tokenData) {
      console.error('❌ Error generating confirmation token:', tokenError);
      return res.status(500).json({ error: 'Failed to generate confirmation token' });
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
        message: 'Account created but email sending failed. Please contact support.',
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
      error: 'Registration failed',
      message: err.message
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
