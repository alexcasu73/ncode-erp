// Supabase Edge Function to send emails via SMTP
// Deploy with: supabase functions deploy send-email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
  };
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { smtp, from, to, subject, html, text }: EmailRequest = await req.json()

    // Validate required fields
    if (!smtp || !from || !to || !subject) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create SMTP client
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

      return new Response(
        JSON.stringify({ success: true, message: 'Email sent successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (smtpError) {
      console.error('SMTP Error:', smtpError);
      return new Response(
        JSON.stringify({
          error: 'Failed to send email',
          details: smtpError instanceof Error ? smtpError.message : 'Unknown error'
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
