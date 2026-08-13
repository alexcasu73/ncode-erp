import { Router } from 'express';
import { initEmailClient } from '../email/email.service.js';

export function createEmailRouter({ pool }) {
  const router = Router();

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

  // Send invitation email
  router.post('/send-invitation', async (req, res) => {
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
  router.post('/test', async (req, res) => {
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

  return router;
}
