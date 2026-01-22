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
    sendRegistrationConfirmationEmail,
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
function getInvitationEmailHtml(name, setupUrl, inviterName, companyName, role, email, tempPassword) {
  const { appName, primaryColor } = emailConfig;

  const roleLabels = {
    admin: 'Amministratore',
    manager: 'Manager',
    user: 'Utente',
    viewer: 'Visualizzatore'
  };
  const roleLabel = roleLabels[role] || role;

  // Build content sections - always use magic link approach
  const credentialsSection = `
          <div class="credentials-box">
            <div class="title">
              📧 Il tuo account è pronto!
            </div>
            <div class="credential-item">
              <span class="credential-label">Email:</span> <span class="credential-value">${email}</span>
            </div>
            <p style="margin: 16px 0 0 0; color: #78350F; font-size: 14px;">
              Clicca sul pulsante qui sotto per impostare la tua password e completare la registrazione.
            </p>
          </div>`;

  const actionSection = `
          <p class="intro-text">
            Per completare la configurazione del tuo account e impostare la password,
            clicca sul pulsante qui sotto:
          </p>
          <div style="text-align: center;">
            <a href="${setupUrl}" class="button">🔐 Imposta Password</a>
          </div>
          <p class="link-text">
            Oppure copia e incolla questo link nel tuo browser:<br>
            <a href="${setupUrl}" class="link-url">${setupUrl}</a>
          </p>`;

  const instructionsSection = `
          <div class="tip-box">
            <div class="tip-title">💡 Prossimi passi</div>
            <div class="tip-text">
              1. Clicca sul pulsante "Imposta Password" qui sopra<br>
              2. Scegli una password sicura per il tuo account<br>
              3. Accedi con la tua email e la password scelta<br>
              4. Inizia ad utilizzare la piattaforma!
            </div>
          </div>
          <p class="link-text" style="margin-top: 24px;">
            ⏰ Questo link è valido per 7 giorni.
          </p>`;

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
          color: #374151;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background: #F9FAFB;
        }
        .container {
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          padding: 48px 40px;
          margin: 20px 0;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 30px;
          border-bottom: 2px solid #E5E7EB;
        }
        .logo {
          font-size: 36px;
          font-weight: 700;
          color: ${primaryColor};
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }
        .subtitle {
          color: #6B7280;
          font-size: 15px;
          margin-top: 8px;
        }
        h1 {
          color: #111827;
          font-size: 28px;
          font-weight: 600;
          margin: 0 0 16px 0;
          line-height: 1.3;
        }
        .content {
          margin-bottom: 32px;
        }
        .intro-text {
          font-size: 16px;
          color: #4B5563;
          margin: 24px 0;
          line-height: 1.7;
        }
        .button {
          display: inline-block;
          background: ${primaryColor};
          color: #ffffff !important;
          padding: 16px 40px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 24px 0;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
          transition: all 0.2s;
        }
        .button:hover {
          background: #2563EB;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }
        .info-box {
          background: #F9FAFB;
          border-left: 4px solid ${primaryColor};
          border-radius: 6px;
          padding: 20px 24px;
          margin: 24px 0;
        }
        .credentials-box {
          background: #FFFBEB;
          border: 2px solid #FCD34D;
          border-radius: 8px;
          padding: 24px;
          margin: 28px 0;
        }
        .credentials-box .title {
          font-size: 18px;
          font-weight: 700;
          color: #92400E;
          margin: 0 0 20px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .credential-item {
          margin: 14px 0;
          font-size: 16px;
          line-height: 1.8;
          color: #1F2937;
        }
        .credential-label {
          font-weight: 600;
          color: #78350F;
          display: inline;
        }
        .credential-value {
          font-family: 'SF Mono', Monaco, 'Courier New', monospace;
          font-size: 16px;
          color: #1F2937;
          display: inline;
          font-weight: 600;
        }
        .warning-box {
          background: #FEF3C7;
          border-radius: 6px;
          padding: 12px 16px;
          margin-top: 16px;
          font-size: 14px;
          color: #92400E;
          font-weight: 500;
        }
        .tip-box {
          background: #EFF6FF;
          border-left: 4px solid #3B82F6;
          border-radius: 6px;
          padding: 20px 24px;
          margin: 28px 0;
        }
        .tip-box .tip-title {
          font-weight: 700;
          color: #1E40AF;
          margin: 0 0 8px 0;
          font-size: 15px;
        }
        .tip-box .tip-text {
          color: #1E3A8A;
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
        }
        .link-text {
          color: #6B7280;
          font-size: 14px;
          margin: 20px 0;
          line-height: 1.6;
        }
        .link-url {
          color: ${primaryColor};
          word-break: break-all;
          font-size: 14px;
        }
        .footer {
          text-align: center;
          margin-top: 48px;
          padding-top: 24px;
          border-top: 2px solid #E5E7EB;
          color: #9CA3AF;
          font-size: 13px;
          line-height: 1.6;
        }
        .footer p {
          margin: 8px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">${appName}</div>
          <div class="subtitle">Sistema di gestione aziendale</div>
        </div>

        <h1>${name === 'Nuovo Utente' ? 'Benvenuto! 👋' : `Ciao ${name}! 👋`}</h1>

        <div class="content">
          <p class="intro-text">
            <strong>${inviterName}</strong> ti ha invitato a unirti al team di <strong>${companyName}</strong> sulla piattaforma ${appName}.
          </p>

          <div class="info-box">
            <p style="margin: 0; font-size: 15px;"><strong>👤 Ruolo assegnato:</strong> <span style="color: ${primaryColor}; font-weight: 600;">${roleLabel}</span></p>
          </div>

          ${credentialsSection}
          ${actionSection}
          ${instructionsSection}
        </div>

        <div class="footer">
          <p><strong>${appName}</strong> - Gestione aziendale semplificata</p>
          <p>Se non hai richiesto questo invito, puoi ignorare questa email in sicurezza.</p>
          <p style="margin-top: 16px; font-size: 12px; color: #D1D5DB;">
            Questo messaggio è stato generato automaticamente, per favore non rispondere.
          </p>
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
 * @param {string} [tempPassword] - Optional temporary password for first login
 * @returns {Promise<boolean>}
 */
export async function sendInvitationEmail(email, name, token, inviterName, companyName, role, tempPassword) {
  // If tempPassword is provided, link directly to the app; otherwise use setup page
  const setupUrl = tempPassword ? emailConfig.frontendUrl : `${emailConfig.frontendUrl}/setup-account?token=${token}`;
  const subject = `Sei stato invitato su ${emailConfig.appName}`;
  const html = getInvitationEmailHtml(name, setupUrl, inviterName, companyName, role, email, tempPassword);
  return sendEmail(email, subject, html);
}

/**
 * Generate confirmation email HTML for new user registration
 */
function getConfirmationEmailHtml(name, companyName, confirmUrl) {
  const { appName, primaryColor } = emailConfig;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Conferma la tua registrazione</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #374151;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background: #F9FAFB;
        }
        .container {
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          padding: 48px 40px;
          margin: 20px 0;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 30px;
          border-bottom: 2px solid #E5E7EB;
        }
        .logo {
          font-size: 36px;
          font-weight: 700;
          color: ${primaryColor};
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }
        .subtitle {
          color: #6B7280;
          font-size: 15px;
          margin-top: 8px;
        }
        h1 {
          color: #111827;
          font-size: 28px;
          font-weight: 600;
          margin: 0 0 16px 0;
          line-height: 1.3;
        }
        .content {
          margin-bottom: 32px;
        }
        .intro-text {
          font-size: 16px;
          color: #4B5563;
          margin: 24px 0;
          line-height: 1.7;
        }
        .button {
          display: inline-block;
          background: ${primaryColor};
          color: #ffffff !important;
          padding: 16px 40px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 24px 0;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
          transition: all 0.2s;
        }
        .info-box {
          background: #ECFDF5;
          border-left: 4px solid #10B981;
          border-radius: 6px;
          padding: 20px 24px;
          margin: 24px 0;
        }
        .link-text {
          color: #6B7280;
          font-size: 14px;
          margin: 20px 0;
          line-height: 1.6;
        }
        .link-url {
          color: ${primaryColor};
          word-break: break-all;
          font-size: 14px;
        }
        .footer {
          text-align: center;
          margin-top: 48px;
          padding-top: 24px;
          border-top: 2px solid #E5E7EB;
          color: #9CA3AF;
          font-size: 13px;
          line-height: 1.6;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">${appName}</div>
          <div class="subtitle">Sistema di gestione aziendale</div>
        </div>

        <h1>Conferma la tua email</h1>

        <div class="content">
          <p class="intro-text">
            Ciao <strong>${name}</strong>, conferma il tuo indirizzo email per completare la registrazione.
          </p>

          <div style="text-align: center;">
            <a href="${confirmUrl}" class="button">Conferma Email</a>
          </div>

          <p class="link-text" style="margin-top: 24px;">
            Questo link è valido per 24 ore.
          </p>
        </div>

        <div class="footer">
          <p><strong>${appName}</strong> - Gestione aziendale semplificata</p>
          <p>Se non hai richiesto questa registrazione, puoi ignorare questa email in sicurezza.</p>
          <p style="margin-top: 16px; font-size: 12px; color: #D1D5DB;">
            Questo messaggio è stato generato automaticamente, per favore non rispondere.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send email confirmation for new user registration
 * @param {string} email - Recipient email
 * @param {string} name - User name
 * @param {string} companyName - Company name
 * @param {string} token - Confirmation token
 * @returns {Promise<boolean>}
 */
export async function sendRegistrationConfirmationEmail(email, name, companyName, token) {
  const confirmUrl = `${emailConfig.frontendUrl}/confirm-email?token=${token}`;
  const subject = `Conferma la tua registrazione su ${emailConfig.appName}`;
  const html = getConfirmationEmailHtml(name, companyName, confirmUrl);
  return sendEmail(email, subject, html);
}

export default {
  initEmailClient,
  sendEmail,
  sendInvitationEmail,
  sendRegistrationConfirmationEmail
};
