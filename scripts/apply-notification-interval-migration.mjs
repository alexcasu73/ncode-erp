import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('Reading SQL migration file...');
    const sqlPath = path.join(__dirname, '../sql/add-notification-refresh-interval.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying migration to add notification_refresh_interval column...');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Error applying migration:', error);
      console.log('\nTrying alternative method...');
      
      // Alternative: use direct SQL execution if exec_sql doesn't exist
      const lines = sql.split(';').filter(line => line.trim());
      for (const line of lines) {
        if (line.trim()) {
          console.log(`Executing: ${line.trim().substring(0, 50)}...`);
          const { error: lineError } = await supabase.rpc('exec', { sql: line });
          if (lineError) {
            console.error('Error:', lineError);
          }
        }
      }
    } else {
      console.log('✅ Migration applied successfully!');
    }

    // Verify the column was added
    console.log('\nVerifying column...');
    const { data: settings, error: selectError } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (selectError) {
      console.error('Error verifying:', selectError);
    } else {
      console.log('✅ Settings row:', settings);
      if (settings && 'notification_refresh_interval' in settings) {
        console.log('✅ Column notification_refresh_interval exists with value:', settings.notification_refresh_interval);
      } else {
        console.log('⚠️  Column might not be visible yet. Try manual SQL.');
      }
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

applyMigration();
