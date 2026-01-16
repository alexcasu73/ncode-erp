-- Create settings table in Supabase
-- This table stores application settings including AI provider API keys
-- Only one row will exist with id='default'

CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    default_ai_provider TEXT NOT NULL DEFAULT 'anthropic' CHECK (default_ai_provider IN ('anthropic', 'openai')),
    anthropic_api_key TEXT NOT NULL DEFAULT '',
    openai_api_key TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default row
INSERT INTO settings (id, default_ai_provider, anthropic_api_key, openai_api_key)
VALUES ('default', 'anthropic', '', '')
ON CONFLICT (id) DO NOTHING;

-- Add RLS (Row Level Security) policies
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (adjust based on your auth setup)
CREATE POLICY "Enable all operations for authenticated users" ON settings
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
