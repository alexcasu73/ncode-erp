-- Add notification_refresh_interval column to settings table
-- This allows users to configure how often invoice due dates are checked (1, 3, or 5 minutes)

-- Add the column with default value 5 minutes
ALTER TABLE settings
ADD COLUMN IF NOT EXISTS notification_refresh_interval INTEGER DEFAULT 5
CHECK (notification_refresh_interval IN (1, 3, 5));

-- Update existing records to have the default value
UPDATE settings
SET notification_refresh_interval = 5
WHERE notification_refresh_interval IS NULL;

-- Make the column NOT NULL
ALTER TABLE settings
ALTER COLUMN notification_refresh_interval SET NOT NULL;

-- Update complete_user_registration function to include notification_refresh_interval
CREATE OR REPLACE FUNCTION complete_user_registration(p_user_id UUID, p_email TEXT, p_full_name TEXT, p_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- 1. Crea record in users table
  INSERT INTO users (id, email, full_name, is_active)
  VALUES (p_user_id, p_email, p_full_name, true);

  -- 2. Collega utente ad azienda con ruolo admin
  INSERT INTO company_users (user_id, company_id, role, is_active)
  VALUES (p_user_id, p_company_id, 'admin', true);

  -- 3. Crea settings default per l'azienda (solo se non esiste)
  IF NOT EXISTS (SELECT 1 FROM settings WHERE company_id = p_company_id) THEN
    INSERT INTO settings (id, company_id, default_ai_provider, anthropic_api_key, openai_api_key, notification_refresh_interval)
    VALUES ('default', p_company_id, 'anthropic', '', '', 5);
  END IF;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in complete_user_registration: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
