import { supabase } from './supabase';
import type { AppSettings } from '../types';

interface EmailInvitation {
  toEmail: string;
  toName: string;
  inviterName: string;
  companyName: string;
  inviteLink: string;
  role: string;
}

// Helper function to convert snake_case to camelCase
const snakeToCamel = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(snakeToCamel);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      acc[camelKey] = snakeToCamel(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
};

/**
 * Get email settings for the current company
 */
export async function getSmtpSettings(companyId: string): Promise<AppSettings | null> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error) {
      console.error('Error fetching email settings:', error);
      return null;
    }

    // Convert snake_case to camelCase
    return snakeToCamel(data);
  } catch (err) {
    console.error('Unexpected error fetching email settings:', err);
    return null;
  }
}

/**
 * Validate email settings (SMTP or OAuth2)
 */
export function validateEmailSettings(settings: AppSettings): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const provider = settings.emailProvider || 'smtp';

  if (provider === 'google-oauth2') {
    if (!settings.googleOauth2Enabled) {
      errors.push('Google OAuth2 non abilitato');
      return { valid: false, errors };
    }

    if (!settings.googleClientId) {
      errors.push('Google Client ID mancante');
    }

    if (!settings.googleClientSecret) {
      errors.push('Google Client Secret mancante');
    }

    if (!settings.googleRefreshToken) {
      errors.push('Google Refresh Token mancante');
    }

    if (!settings.googleUserEmail) {
      errors.push('Google User Email mancante');
    }
  } else if (provider === 'smtp') {
    if (!settings.smtpEnabled) {
      errors.push('SMTP non abilitato');
      return { valid: false, errors };
    }

    if (!settings.smtpHost) {
      errors.push('Host SMTP mancante');
    }

    if (!settings.smtpPort || settings.smtpPort < 1 || settings.smtpPort > 65535) {
      errors.push('Porta SMTP non valida');
    }

    if (!settings.smtpUser) {
      errors.push('Username SMTP mancante');
    }

    if (!settings.smtpPassword) {
      errors.push('Password SMTP mancante');
    }

    if (!settings.smtpFromEmail) {
      errors.push('Email mittente mancante');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Generate invite email HTML template
 */
function generateInviteEmailHtml(invitation: EmailInvitation): string {
  const roleLabels: Record<string, string> = {
    admin: 'Amministratore',
    manager: 'Manager',
    user: 'Utente',
    viewer: 'Visualizzatore'
  };

  const roleLabel = roleLabels[invitation.role] || invitation.role;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invito a Ncode ERP</title>
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
          color: #3B82F6;
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
          background: #3B82F6;
          color: #ffffff;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 500;
          margin: 20px 0;
        }
        .button:hover {
          background: #2563EB;
        }
        .info-box {
          background: #F3F4F6;
          border-left: 4px solid #3B82F6;
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
          <div class="logo">Ncode ERP</div>
        </div>

        <h1>Ciao ${invitation.toName}!</h1>

        <div class="content">
          <p><strong>${invitation.inviterName}</strong> ti ha invitato a unirti a <strong>${invitation.companyName}</strong> su Ncode ERP.</p>

          <div class="info-box">
            <p style="margin: 0;"><strong>Ruolo assegnato:</strong> ${roleLabel}</p>
          </div>

          <p>Clicca sul pulsante qui sotto per accettare l'invito e completare la registrazione:</p>

          <div style="text-align: center;">
            <a href="${invitation.inviteLink}" class="button">Accetta Invito</a>
          </div>

          <p style="color: #6B7280; font-size: 14px;">
            Oppure copia e incolla questo link nel tuo browser:<br>
            <a href="${invitation.inviteLink}" style="color: #3B82F6;">${invitation.inviteLink}</a>
          </p>

          <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
            Questo invito scadrà tra 7 giorni.
          </p>
        </div>

        <div class="footer">
          <p>Ncode ERP - Sistema di gestione aziendale</p>
          <p>Se non hai richiesto questo invito, puoi ignorare questa email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate plain text version of invite email
 */
function generateInviteEmailText(invitation: EmailInvitation): string {
  const roleLabels: Record<string, string> = {
    admin: 'Amministratore',
    manager: 'Manager',
    user: 'Utente',
    viewer: 'Visualizzatore'
  };

  const roleLabel = roleLabels[invitation.role] || invitation.role;

  return `
Ciao ${invitation.toName}!

${invitation.inviterName} ti ha invitato a unirti a ${invitation.companyName} su Ncode ERP.

Ruolo assegnato: ${roleLabel}

Clicca sul link qui sotto per accettare l'invito e completare la registrazione:
${invitation.inviteLink}

Questo invito scadrà tra 7 giorni.

---
Ncode ERP - Sistema di gestione aziendale
Se non hai richiesto questo invito, puoi ignorare questa email.
  `.trim();
}

/**
 * Send invitation email to a new user
 * Uses Supabase Edge Function to send email via SMTP or Google OAuth2
 */
export async function sendInvitationEmail(
  companyId: string,
  invitation: EmailInvitation
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get email settings
    const settings = await getSmtpSettings(companyId);
    if (!settings) {
      return { success: false, error: 'Impossibile recuperare le impostazioni email' };
    }

    // Validate settings
    const validation = validateEmailSettings(settings);
    if (!validation.valid) {
      return {
        success: false,
        error: `Configurazione email non valida: ${validation.errors.join(', ')}`
      };
    }

    // Prepare email content
    const emailHtml = generateInviteEmailHtml(invitation);
    const emailText = generateInviteEmailText(invitation);

    const provider = settings.emailProvider || 'smtp';

    // Prepare request body based on provider
    const requestBody: any = {
      provider,
      from: {
        name: provider === 'google-oauth2'
          ? (settings.googleFromName || 'Ncode ERP')
          : (settings.smtpFromName || settings.smtpFromEmail || 'Ncode ERP'),
        email: provider === 'google-oauth2'
          ? (settings.googleUserEmail || '')
          : (settings.smtpFromEmail || settings.smtpUser || ''),
      },
      to: {
        name: invitation.toName,
        email: invitation.toEmail,
      },
      subject: `Invito a ${invitation.companyName} - Ncode ERP`,
      html: emailHtml,
      text: emailText,
    };

    if (provider === 'google-oauth2') {
      requestBody.googleOAuth2 = {
        clientId: settings.googleClientId,
        clientSecret: settings.googleClientSecret,
        refreshToken: settings.googleRefreshToken,
        userEmail: settings.googleUserEmail,
      };
    } else {
      requestBody.smtp = {
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.smtpSecure,
        user: settings.smtpUser,
        password: settings.smtpPassword,
      };
    }

    // Call Supabase Edge Function to send email
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: requestBody,
    });

    if (error) {
      console.error('Error sending email:', error);

      // Provide more helpful error message
      let errorMessage = error.message || 'Errore invio email';

      if (errorMessage.includes('FunctionsRelayError') || errorMessage.includes('non-2xx')) {
        errorMessage = 'Edge Function non disponibile. Per testare l\'invio email:\n\n' +
          '1. Deploy su Supabase Cloud: supabase functions deploy send-email\n' +
          '2. Oppure avvia localmente: supabase functions serve\n\n' +
          'L\'invio email funzionerà in produzione dopo il deploy.';
      }

      return { success: false, error: errorMessage };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Unexpected error sending email:', err);
    return { success: false, error: err.message || 'Errore imprevisto' };
  }
}

/**
 * Test SMTP configuration by sending a test email
 */
export async function testSmtpConfiguration(
  companyId: string,
  testEmail: string
): Promise<{ success: boolean; error?: string }> {
  const invitation: EmailInvitation = {
    toEmail: testEmail,
    toName: 'Test User',
    inviterName: 'Ncode ERP',
    companyName: 'Test Company',
    inviteLink: 'https://example.com/test',
    role: 'user',
  };

  return sendInvitationEmail(companyId, invitation);
}
