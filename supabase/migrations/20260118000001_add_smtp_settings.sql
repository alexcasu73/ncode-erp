-- Add SMTP settings to settings table
ALTER TABLE settings
ADD COLUMN IF NOT EXISTS smtp_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS smtp_host TEXT,
ADD COLUMN IF NOT EXISTS smtp_port INTEGER DEFAULT 587,
ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS smtp_user TEXT,
ADD COLUMN IF NOT EXISTS smtp_password TEXT,
ADD COLUMN IF NOT EXISTS smtp_from_name TEXT,
ADD COLUMN IF NOT EXISTS smtp_from_email TEXT;

-- Add comment
COMMENT ON COLUMN settings.smtp_enabled IS 'Whether SMTP is enabled for sending invitation emails';
COMMENT ON COLUMN settings.smtp_host IS 'SMTP server host (e.g. smtp.gmail.com)';
COMMENT ON COLUMN settings.smtp_port IS 'SMTP server port (587 for TLS, 465 for SSL)';
COMMENT ON COLUMN settings.smtp_secure IS 'Use SSL (true for port 465, false for port 587 with STARTTLS)';
COMMENT ON COLUMN settings.smtp_user IS 'SMTP username (usually the email address)';
COMMENT ON COLUMN settings.smtp_password IS 'SMTP password or app-specific password';
COMMENT ON COLUMN settings.smtp_from_name IS 'Sender name displayed in emails';
COMMENT ON COLUMN settings.smtp_from_email IS 'Sender email address';
