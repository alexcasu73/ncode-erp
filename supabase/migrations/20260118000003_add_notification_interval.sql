-- Add notification refresh interval to settings table
ALTER TABLE settings
ADD COLUMN IF NOT EXISTS notification_refresh_interval INTEGER DEFAULT 5 CHECK (notification_refresh_interval IN (1, 3, 5));

-- Add comment
COMMENT ON COLUMN settings.notification_refresh_interval IS 'Invoice notification refresh interval in minutes (1, 3, or 5)';
