/**
 * Add notification_refresh_interval field to settings table
 */
import { createPool } from '../src/db/pool.js';
import dotenv from 'dotenv';

dotenv.config();

const pool = createPool(process.env.DATABASE_URL);

async function addNotificationRefreshInterval() {
  try {
    console.log('📋 Adding notification_refresh_interval to settings table...\n');

    // Check if column already exists
    const { rows: columns } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'settings'
        AND column_name = 'notification_refresh_interval'
    `);

    if (columns.length > 0) {
      console.log('✅ Column notification_refresh_interval already exists');
      process.exit(0);
    }

    // Add the column
    await pool.query(`
      ALTER TABLE settings
      ADD COLUMN notification_refresh_interval INTEGER DEFAULT 5 CHECK (notification_refresh_interval IN (1, 3, 5));
    `);

    console.log('✅ Column notification_refresh_interval added successfully');

    // Update existing rows to have default value
    await pool.query(`
      UPDATE settings
      SET notification_refresh_interval = 5
      WHERE notification_refresh_interval IS NULL;
    `);

    console.log('✅ Existing rows updated with default value (5 minutes)');

    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║          Migration Completed Successfully            ║');
    console.log('╠═══════════════════════════════════════════════════════╣');
    console.log('║  Added field: notification_refresh_interval          ║');
    console.log('║  Type: INTEGER                                        ║');
    console.log('║  Constraint: CHECK (value IN (1, 3, 5))               ║');
    console.log('║  Default: 5 minutes                                   ║');
    console.log('╚═══════════════════════════════════════════════════════╝');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error adding notification_refresh_interval:', err);
    console.error('Details:', err.message);
    process.exit(1);
  }
}

addNotificationRefreshInterval();
