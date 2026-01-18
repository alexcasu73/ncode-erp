-- Add Google OAuth2 settings to settings table
ALTER TABLE settings
ADD COLUMN IF NOT EXISTS email_provider TEXT DEFAULT 'smtp' CHECK (email_provider IN ('smtp', 'google-oauth2')),
ADD COLUMN IF NOT EXISTS google_oauth2_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS google_client_id TEXT,
ADD COLUMN IF NOT EXISTS google_client_secret TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_user_email TEXT,
ADD COLUMN IF NOT EXISTS google_from_name TEXT;

-- Add comments
COMMENT ON COLUMN settings.email_provider IS 'Email provider: smtp (traditional) or google-oauth2';
COMMENT ON COLUMN settings.google_oauth2_enabled IS 'Whether Google OAuth2 is enabled for sending emails';
COMMENT ON COLUMN settings.google_client_id IS 'Google OAuth2 Client ID';
COMMENT ON COLUMN settings.google_client_secret IS 'Google OAuth2 Client Secret';
COMMENT ON COLUMN settings.google_refresh_token IS 'Google OAuth2 Refresh Token';
COMMENT ON COLUMN settings.google_user_email IS 'Gmail account to send emails from';
COMMENT ON COLUMN settings.google_from_name IS 'Sender name for Google OAuth2 emails';
