import { Router } from 'express';
import { initEmailClient } from '../email/email.service.js';
import { supabaseAdmin } from '../supabase/admin.js';

function generateSlug(name) {
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
}

export function createAuthRouter() {
  const router = Router();

  /**
   * Register new user with email confirmation
   * Creates user in Supabase (unconfirmed) and sends confirmation email via Gmail API
   */
  router.post('/register', async (req, res) => {
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
  router.post('/confirm-email', async (req, res) => {
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

  return router;
}
