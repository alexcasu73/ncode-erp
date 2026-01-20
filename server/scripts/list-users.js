/**
 * List all users and invitations in the database
 */
import { createPool } from '../src/db/pool.js';
import dotenv from 'dotenv';

dotenv.config();

const pool = createPool(process.env.DATABASE_URL);

async function listUsers() {
  try {
    console.log('👥 Fetching all users and invitations...\n');

    // Get all users from users table
    const usersResult = await pool.query(`
      SELECT
        u.id,
        u.email,
        u.full_name,
        u.is_active,
        u.created_at,
        cu.company_id,
        cu.role,
        c.name as company_name
      FROM users u
      LEFT JOIN company_users cu ON u.id = cu.user_id
      LEFT JOIN companies c ON cu.company_id = c.id
      ORDER BY u.created_at DESC
    `);

    // Get all pending invitations
    const invitationsResult = await pool.query(`
      SELECT
        ui.id,
        ui.email,
        ui.role,
        ui.company_id,
        ui.expires_at,
        ui.used_at,
        ui.created_at,
        c.name as company_name
      FROM user_invitations ui
      LEFT JOIN companies c ON ui.company_id = c.id
      ORDER BY ui.created_at DESC
    `);

    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 ACTIVE USERS');
    console.log('═══════════════════════════════════════════════════════\n');

    if (usersResult.rows.length === 0) {
      console.log('  No active users found\n');
    } else {
      usersResult.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.full_name} (${user.email})`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Company: ${user.company_name || 'N/A'} (${user.company_id || 'N/A'})`);
        console.log(`   Role: ${user.role || 'N/A'}`);
        console.log(`   Active: ${user.is_active ? 'Yes ✅' : 'No ❌'}`);
        console.log(`   Created: ${new Date(user.created_at).toLocaleString('it-IT')}`);
        console.log('');
      });
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('📧 PENDING INVITATIONS');
    console.log('═══════════════════════════════════════════════════════\n');

    if (invitationsResult.rows.length === 0) {
      console.log('  No pending invitations\n');
    } else {
      invitationsResult.rows.forEach((inv, index) => {
        const isExpired = new Date(inv.expires_at) < new Date();
        const isUsed = !!inv.used_at;

        let status = '🟢 Active';
        if (isUsed) status = '✅ Used';
        else if (isExpired) status = '🔴 Expired';

        console.log(`${index + 1}. ${inv.email} [${status}]`);
        console.log(`   ID: ${inv.id}`);
        console.log(`   Company: ${inv.company_name || 'N/A'} (${inv.company_id})`);
        console.log(`   Role: ${inv.role}`);
        console.log(`   Created: ${new Date(inv.created_at).toLocaleString('it-IT')}`);
        console.log(`   Expires: ${new Date(inv.expires_at).toLocaleString('it-IT')}`);
        if (inv.used_at) {
          console.log(`   Used: ${new Date(inv.used_at).toLocaleString('it-IT')}`);
        }
        console.log('');
      });
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total active users: ${usersResult.rows.length}`);
    console.log(`Total invitations: ${invitationsResult.rows.length}`);
    const activeInvitations = invitationsResult.rows.filter(inv =>
      !inv.used_at && new Date(inv.expires_at) > new Date()
    ).length;
    console.log(`Active invitations: ${activeInvitations}`);
    console.log('═══════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

listUsers();
