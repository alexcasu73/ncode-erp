/**
 * Add RLS policies to restrict VIEWER role from modifying data
 * VIEWER can only SELECT (read-only access)
 */
import { createPool } from '../src/db/pool.js';
import dotenv from 'dotenv';

dotenv.config();

const pool = createPool(process.env.DATABASE_URL);

async function addViewerRestrictions() {
  try {
    console.log('🔒 Adding VIEWER restrictions to database...\n');

    const tables = [
      'customers',
      'invoices',
      'deals',
      'cashflow_records',
      'transactions',
      'financial_items',
      'bank_balances'
    ];

    for (const table of tables) {
      console.log(`📋 Processing table: ${table}`);

      // DROP existing INSERT/UPDATE/DELETE policies
      await pool.query(`
        DROP POLICY IF EXISTS "Users can insert company ${table}" ON ${table};
        DROP POLICY IF EXISTS "Users can update company ${table}" ON ${table};
        DROP POLICY IF EXISTS "Users can delete company ${table}" ON ${table};
      `);

      // CREATE new INSERT policy (exclude viewer)
      await pool.query(`
        CREATE POLICY "Users can insert company ${table}" ON ${table}
          FOR INSERT
          WITH CHECK (
            company_id IN (
              SELECT company_id FROM company_users
              WHERE user_id = auth.uid()
                AND is_active = true
                AND role != 'viewer'
            )
          );
      `);
      console.log(`  ✅ INSERT policy created (viewer blocked)`);

      // CREATE new UPDATE policy (exclude viewer)
      await pool.query(`
        CREATE POLICY "Users can update company ${table}" ON ${table}
          FOR UPDATE
          USING (
            company_id IN (
              SELECT company_id FROM company_users
              WHERE user_id = auth.uid()
                AND is_active = true
                AND role != 'viewer'
            )
          );
      `);
      console.log(`  ✅ UPDATE policy created (viewer blocked)`);

      // CREATE new DELETE policy (exclude viewer)
      await pool.query(`
        CREATE POLICY "Users can delete company ${table}" ON ${table}
          FOR DELETE
          USING (
            company_id IN (
              SELECT company_id FROM company_users
              WHERE user_id = auth.uid()
                AND is_active = true
                AND role != 'viewer'
            )
          );
      `);
      console.log(`  ✅ DELETE policy created (viewer blocked)\n`);
    }

    // Also update invoice_notifications
    console.log(`📋 Processing table: invoice_notifications`);
    await pool.query(`
      DROP POLICY IF EXISTS "Users can insert company invoice notifications" ON invoice_notifications;
      DROP POLICY IF EXISTS "Users can update company invoice notifications" ON invoice_notifications;
      DROP POLICY IF EXISTS "Users can delete company invoice notifications" ON invoice_notifications;

      CREATE POLICY "Users can insert company invoice notifications" ON invoice_notifications
        FOR INSERT
        WITH CHECK (
          invoice_id IN (
            SELECT id FROM invoices
            WHERE company_id IN (
              SELECT company_id FROM company_users
              WHERE user_id = auth.uid()
                AND is_active = true
                AND role != 'viewer'
            )
          )
        );

      CREATE POLICY "Users can update company invoice notifications" ON invoice_notifications
        FOR UPDATE
        USING (
          invoice_id IN (
            SELECT id FROM invoices
            WHERE company_id IN (
              SELECT company_id FROM company_users
              WHERE user_id = auth.uid()
                AND is_active = true
                AND role != 'viewer'
            )
          )
        );

      CREATE POLICY "Users can delete company invoice notifications" ON invoice_notifications
        FOR DELETE
        USING (
          invoice_id IN (
            SELECT id FROM invoices
            WHERE company_id IN (
              SELECT company_id FROM company_users
              WHERE user_id = auth.uid()
                AND is_active = true
                AND role != 'viewer'
            )
          )
        );
    `);
    console.log(`  ✅ invoice_notifications policies updated (viewer blocked)\n`);

    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║           VIEWER RESTRICTIONS APPLIED                 ║');
    console.log('╠═══════════════════════════════════════════════════════╣');
    console.log('║  VIEWER role can now:                                 ║');
    console.log('║  ✅ SELECT (read) all company data                    ║');
    console.log('║  ❌ INSERT (create) new records                       ║');
    console.log('║  ❌ UPDATE (modify) existing records                  ║');
    console.log('║  ❌ DELETE (remove) records                           ║');
    console.log('╠═══════════════════════════════════════════════════════╣');
    console.log('║  Tables protected:                                    ║');
    tables.forEach(t => {
      console.log(`║  - ${t.padEnd(49)} ║`);
    });
    console.log('║  - invoice_notifications                              ║');
    console.log('╚═══════════════════════════════════════════════════════╝');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error adding viewer restrictions:', err);
    console.error('Details:', err.message);
    process.exit(1);
  }
}

addViewerRestrictions();
