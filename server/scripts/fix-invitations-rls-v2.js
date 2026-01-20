/**
 * Fix RLS policy on user_invitations table (v2 - without auth.users reference)
 */
import { createPool } from '../src/db/pool.js';
import dotenv from 'dotenv';

dotenv.config();

const pool = createPool(process.env.DATABASE_URL);

async function fixInvitationsRLS() {
  try {
    console.log('🔧 Fixing user_invitations RLS policy (v2)...');

    const sql = `
      BEGIN;

      -- Drop any existing SELECT policies on user_invitations
      DROP POLICY IF EXISTS "Users can view invitations by email" ON user_invitations;
      DROP POLICY IF EXISTS "Company members can view company invitations" ON user_invitations;

      -- Create simplified SELECT policy:
      -- Company members can see all invitations for their company
      CREATE POLICY "Company members can view company invitations"
      ON user_invitations
      FOR SELECT
      USING (
        -- User is a member of the company (can see all company invitations)
        company_id IN (
          SELECT company_id
          FROM company_users
          WHERE user_id = auth.uid()
            AND is_active = true
        )
        OR
        -- OR user is the invitee (after completing invitation)
        user_id = auth.uid()
      );

      COMMIT;
    `;

    await pool.query(sql);

    console.log('✅ RLS policy fixed successfully!');
    console.log('');
    console.log('Company members can now see:');
    console.log('  - All pending invitations for their company');
    console.log('  - Invitations they completed');
    console.log('');
    console.log('Note: Removed problematic auth.users reference');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error fixing RLS policy:', err);
    process.exit(1);
  }
}

fixInvitationsRLS();
