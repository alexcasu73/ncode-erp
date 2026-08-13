import { Router } from 'express';
import { supabaseAdmin } from '../supabase/admin.js';

export function createUsersRouter({ pool }) {
  const router = Router();

  // Create user invitation with magic link
  router.post('/create', async (req, res) => {
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
  router.post('/complete-invitation', async (req, res) => {
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
  router.get('/validate-invitation/:token', async (req, res) => {
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
  router.delete('/:userId', async (req, res) => {
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

  return router;
}
