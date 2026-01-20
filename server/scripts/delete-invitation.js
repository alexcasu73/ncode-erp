/**
 * Delete invitation by email
 */
import { supabaseAdmin } from '../src/supabase/admin.js';
import dotenv from 'dotenv';

dotenv.config();

const emailToDelete = 'alex.casu@gmail.com';

async function deleteInvitation() {
  try {
    console.log(`🗑️  Deleting invitation for: ${emailToDelete}`);

    const { data, error } = await supabaseAdmin
      .from('user_invitations')
      .delete()
      .eq('email', emailToDelete)
      .select();

    if (error) {
      console.error('❌ Error deleting invitation:', error);
      process.exit(1);
    }

    if (data && data.length > 0) {
      console.log('✅ Deleted invitations:', data.length);
      console.log('   Details:', JSON.stringify(data, null, 2));
    } else {
      console.log('⚠️  No invitations found for', emailToDelete);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

deleteInvitation();
