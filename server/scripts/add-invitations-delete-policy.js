/**
 * Add DELETE policy on user_invitations table
 * Allows company admins to delete pending invitations
 */
import { createPool } from '../src/db/pool.js';
import dotenv from 'dotenv';

dotenv.config();

const pool = createPool(process.env.DATABASE_URL);

async function addDeletePolicy() {
  try {
    console.log('🔧 Adding DELETE policy to user_invitations...');

    const sql = `
      BEGIN;

      -- Drop any existing DELETE policies on user_invitations
      DROP POLICY IF EXISTS "Company admins can delete invitations" ON user_invitations;
      DROP POLICY IF EXISTS "Company members can delete invitations" ON user_invitations;

      -- Create DELETE policy: company members can delete invitations for their company
      CREATE POLICY "Company members can delete invitations"
      ON user_invitations
      FOR DELETE
      USING (
        -- User is a member of the company (can delete company invitations)
        company_id IN (
          SELECT company_id
          FROM company_users
          WHERE user_id = auth.uid()
            AND is_active = true
        )
      );

      COMMIT;
    `;

    await pool.query(sql);

    console.log('✅ DELETE policy added successfully!');
    console.log('');
    console.log('Company members can now:');
    console.log('  - Delete pending invitations for their company');
    console.log('  - Cancel invitations that were sent by mistake');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error adding DELETE policy:', err);
    process.exit(1);
  }
}

addDeletePolicy();
