// Supabase Edge Function to send emails via SMTP or Google OAuth2
// Deploy with: supabase functions deploy send-email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

interface GoogleOAuth2Config {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  userEmail: string;
}

interface EmailRequest {
  provider: 'smtp' | 'google-oauth2';
  smtp?: SmtpConfig;
  googleOAuth2?: GoogleOAuth2Config;
  from: {
    name: string;
    email: string;
  };
  to: {
    name: string;
    email: string;
  };
  subject: string;
  html: string;
  text: string;
}

// Get access token from refresh token
async function getGoogleAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Send email via Gmail API using OAuth2
async function sendViaGoogleOAuth2(
  config: GoogleOAuth2Config,
  from: { name: string; email: string },
  to: { name: string; email: string },
  subject: string,
  html: string,
  text: string
): Promise<void> {
  // Get access token
  const accessToken = await getGoogleAccessToken(
    config.clientId,
    config.clientSecret,
    config.refreshToken
  );

  // Create email in RFC 2822 format
  const emailLines = [
    `From: ${from.name} <${config.userEmail}>`,
    `To: ${to.name} <${to.email}>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="boundary123"',
    '',
    '--boundary123',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    text,
    '',
    '--boundary123',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
    '',
    '--boundary123--',
  ].join('\r\n');

  // Encode email as base64url
  const encoder = new TextEncoder();
  const emailData = encoder.encode(emailLines);
  const base64Email = btoa(String.fromCharCode(...emailData))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Send via Gmail API
  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: base64Email,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email via Gmail API: ${error}`);
  }
}

// Send email via SMTP
async function sendViaSMTP(
  smtp: SmtpConfig,
  from: { name: string; email: string },
  to: { name: string; email: string },
  subject: string,
  html: string,
  text: string
): Promise<void> {
  const client = new SmtpClient();

  try {
    // Connect to SMTP server
    await client.connectTLS({
      hostname: smtp.host,
      port: smtp.port,
      username: smtp.user,
      password: smtp.password,
    });

    // Send email
    await client.send({
      from: `${from.name} <${from.email}>`,
      to: `${to.name} <${to.email}>`,
      subject: subject,
      content: text || html,
      html: html,
    });

    // Close connection
    await client.close();
  } catch (error) {
    await client.close();
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { provider, smtp, googleOAuth2, from, to, subject, html, text }: EmailRequest = await req.json()

    // Validate required fields
    if (!provider || !from || !to || !subject) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    try {
      if (provider === 'google-oauth2') {
        if (!googleOAuth2) {
          throw new Error('Google OAuth2 configuration missing');
        }
        await sendViaGoogleOAuth2(googleOAuth2, from, to, subject, html, text);
      } else if (provider === 'smtp') {
        if (!smtp) {
          throw new Error('SMTP configuration missing');
        }
        await sendViaSMTP(smtp, from, to, subject, html, text);
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Email sent successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (sendError) {
      console.error('Send Error:', sendError);
      return new Response(
        JSON.stringify({
          error: 'Failed to send email',
          details: sendError instanceof Error ? sendError.message : 'Unknown error'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('General Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
