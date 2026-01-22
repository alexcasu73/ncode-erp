-- Fix complete_user_registration function
-- Remove reference to non-existent notification_refresh_interval field

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
    INSERT INTO settings (id, company_id, default_ai_provider, anthropic_api_key, openai_api_key)
    VALUES ('default', p_company_id, 'anthropic', '', '');
  END IF;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in complete_user_registration: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Ensure all existing companies have default settings
INSERT INTO settings (id, company_id, default_ai_provider, anthropic_api_key, openai_api_key)
SELECT 'default', id, 'anthropic', '', ''
FROM companies
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE company_id = companies.id)
ON CONFLICT (id, company_id) DO NOTHING;
