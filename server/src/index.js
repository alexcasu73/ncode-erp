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

// Create user (server-side with admin privileges)
app.post('/api/users/create', async (req, res) => {
  try {
    const {
      email,
      password,
      full_name,
      company_id,
      role
    } = req.body;

    // Validate required fields
    if (!email || !password || !full_name || !company_id || !role) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['email', 'password', 'full_name', 'company_id', 'role']
      });
    }

    console.log('🔐 [Server] Creating user:', email, 'for company:', company_id);

    // 1. Create user in Supabase Auth using admin client
    // This doesn't affect the current session since it's server-side
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name,
        company_id
      }
    });

    if (authError) {
      console.error('❌ [Server] Error creating auth user:', authError);
      return res.status(500).json({
        error: 'Failed to create auth user',
        message: authError.message
      });
    }

    if (!authData.user) {
      return res.status(500).json({
        error: 'Auth user not created'
      });
    }

    const userId = authData.user.id;
    console.log('✅ [Server] Created auth user:', userId);

    // 2. Create user record in users table
    const { error: userError } = await pool.query(
      'INSERT INTO users (id, email, full_name, is_active) VALUES ($1, $2, $3, $4)',
      [userId, email, full_name, true]
    );

    if (userError) {
      console.error('❌ [Server] Error creating user record:', userError);
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(500).json({
        error: 'Failed to create user record',
        message: userError.message
      });
    }

    console.log('✅ [Server] Created user record');

    // 3. Link user to company
    const { error: linkError } = await pool.query(
      'INSERT INTO company_users (user_id, company_id, role, is_active) VALUES ($1, $2, $3, $4)',
      [userId, company_id, role, true]
    );

    if (linkError) {
      console.error('❌ [Server] Error linking user to company:', linkError);
      // Rollback: delete user and auth user
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(500).json({
        error: 'Failed to link user to company',
        message: linkError.message
      });
    }

    console.log('✅ [Server] Linked user to company');

    res.json({
      success: true,
      userId,
      message: 'User created successfully'
    });

  } catch (err) {
    console.error('❌ [Server] Unexpected error creating user:', err);
    res.status(500).json({
      error: 'Failed to create user',
      message: err.message
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
