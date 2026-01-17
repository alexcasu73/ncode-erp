-- Add notification_refresh_interval column to settings table
-- This column stores how often to check for invoice due dates (in minutes)

ALTER TABLE settings
ADD COLUMN IF NOT EXISTS notification_refresh_interval INTEGER DEFAULT 5 CHECK (notification_refresh_interval IN (1, 3, 5));

-- Update existing row to have default value
UPDATE settings
SET notification_refresh_interval = 5
WHERE id = 'default' AND notification_refresh_interval IS NULL;
