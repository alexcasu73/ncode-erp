import { google } from 'googleapis';
import nodemailer from 'nodemailer';

/**
 * Email client instance
 */
let gmailClient = null;
let smtpTransporter = null;
let emailConfig = {};

/**
 * Initialize email client
 * @param {object} config
 * @param {string} [config.gmailUser] - Gmail address
 * @param {string} [config.gmailRefreshToken] - Gmail OAuth refresh token
 * @param {string} [config.googleClientId] - Google OAuth client ID
 * @param {string} [config.googleClientSecret] - Google OAuth client secret
 * @param {object} [config.smtp] - SMTP configuration
 * @param {string} config.frontendUrl - Frontend URL for email links
 * @param {string} [config.appName] - Application name (default: 'Ncode ERP')
 * @param {string} [config.primaryColor] - Brand color (default: '#3B82F6')
 * @returns {{ sendEmail, sendInvitationEmail, isConfigured }}
 */
export function initEmailClient(config) {
  emailConfig = {
    frontendUrl: config.frontendUrl,
    appName: config.appName || 'Ncode ERP',
    primaryColor: config.primaryColor || '#3B82F6',
    gmailUser: config.gmailUser
  };

  // Try Gmail API first
  if (config.gmailRefreshToken && config.googleClientId && config.googleClientSecret) {
    const oauth2Client = new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret
    );
    oauth2Client.setCredentials({
      refresh_token: config.gmailRefreshToken
    });
    gmailClient = google.gmail({ version: 'v1', auth: oauth2Client });
    console.log('✅ Email configured with Gmail API (OAuth2)');
  }
  // Fall back to SMTP
  else if (config.smtp) {
    smtpTransporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port || 587,
      secure: config.smtp.secure || false,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
      }
    });
    emailConfig.smtpFrom = config.smtp.from || config.smtp.user;
    emailConfig.smtpFromName = config.smtp.fromName || config.appName;
    console.log('✅ Email configured with SMTP');
  } else {
    console.warn('⚠️  Email not configured - emails will be skipped');
  }

  return {
    sendEmail,
    sendInvitationEmail,
    isConfigured: () => !!(gmailClient || smtpTransporter)
  };
}

/**
 * Send email via Gmail API
 */
async function sendViaGmailAPI(to, subject, htmlBody) {
  const fromEmail = emailConfig.gmailUser;
  const fromName = emailConfig.appName;

  const emailLines = [
    `From: "${fromName}" <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody
  ];
  const email = emailLines.join('\r\n');

  const encodedEmail = Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmailClient.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedEmail }
  });
}

/**
 * Send email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlBody - HTML content
 * @returns {Promise<boolean>}
 */
export async function sendEmail(to, subject, htmlBody) {
  if (!gmailClient && !smtpTransporter) {
    console.warn('Email not configured - skipping');
    return false;
  }

  try {
    if (gmailClient) {
      await sendViaGmailAPI(to, subject, htmlBody);
    } else {
      await smtpTransporter.sendMail({
        from: `"${emailConfig.smtpFromName}" <${emailConfig.smtpFrom}>`,
        to,
        subject,
        html: htmlBody
      });
    }
    return true;
  } catch (err) {
    console.error('Failed to send email:', err);
    throw err;
  }
}

/**
 * Generate invitation email HTML
 */
function getInvitationEmailHtml(name, setupUrl, inviterName, companyName, role) {
  const { appName, primaryColor } = emailConfig;

  const roleLabels = {
    admin: 'Amministratore',
    manager: 'Manager',
    user: 'Utente',
    viewer: 'Visualizzatore'
  };
  const roleLabel = roleLabels[role] || role;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invito a ${appName}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          padding: 40px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 32px;
          font-weight: bold;
          color: ${primaryColor};
          margin-bottom: 10px;
        }
        h1 {
          color: #1F2937;
          font-size: 24px;
          margin-bottom: 20px;
        }
        .content {
          margin-bottom: 30px;
        }
        .button {
          display: inline-block;
          background: ${primaryColor};
          color: #ffffff;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 500;
          margin: 20px 0;
        }
        .button:hover {
          opacity: 0.9;
        }
        .info-box {
          background: #F3F4F6;
          border-left: 4px solid ${primaryColor};
          padding: 15px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #E5E7EB;
          color: #6B7280;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">${appName}</div>
        </div>

        <h1>Ciao ${name}!</h1>

        <div class="content">
          <p><strong>${inviterName}</strong> ti ha invitato a unirti a <strong>${companyName}</strong> su ${appName}.</p>

          <div class="info-box">
            <p style="margin: 0;"><strong>Ruolo assegnato:</strong> ${roleLabel}</p>
          </div>

          <p>Clicca sul pulsante qui sotto per accettare l'invito e completare la registrazione:</p>

          <div style="text-align: center;">
            <a href="${setupUrl}" class="button">Accetta Invito</a>
          </div>

          <p style="color: #6B7280; font-size: 14px;">
            Oppure copia e incolla questo link nel tuo browser:<br>
            <a href="${setupUrl}" style="color: ${primaryColor};">${setupUrl}</a>
          </p>

          <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
            Questo invito scadrà tra 7 giorni.
          </p>
        </div>

        <div class="footer">
          <p>${appName} - Sistema di gestione aziendale</p>
          <p>Se non hai richiesto questo invito, puoi ignorare questa email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send invitation email for new user to set up their account
 * @param {string} email - Recipient email
 * @param {string} name - User name
 * @param {string} token - Setup token
 * @param {string} inviterName - Name of the person who invited this user
 * @param {string} companyName - Company name
 * @param {string} role - User role
 * @returns {Promise<boolean>}
 */
export async function sendInvitationEmail(email, name, token, inviterName, companyName, role) {
  const setupUrl = `${emailConfig.frontendUrl}/setup-account?token=${token}`;
  const subject = `Sei stato invitato su ${emailConfig.appName}`;
  const html = getInvitationEmailHtml(name, setupUrl, inviterName, companyName, role);
  return sendEmail(email, subject, html);
}

export default {
  initEmailClient,
  sendEmail,
  sendInvitationEmail
};
