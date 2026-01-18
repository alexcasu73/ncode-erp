-- Add company_id to settings table for multi-tenant support
ALTER TABLE settings
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Drop existing primary key constraint
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;

-- Create composite primary key (id, company_id)
-- This allows each company to have its own settings row with id='default'
ALTER TABLE settings ADD PRIMARY KEY (id, company_id);

-- Add index for faster lookups by company
CREATE INDEX IF NOT EXISTS idx_settings_company_id ON settings(company_id);

-- Update RLS policies to filter by company_id
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON settings;

-- Policy: Users can only access settings for their company
CREATE POLICY "Users can access their company settings" ON settings
    FOR ALL
    USING (
        company_id IN (
            SELECT company_id FROM company_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM company_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Add comment
COMMENT ON COLUMN settings.company_id IS 'Company ID for multi-tenant isolation';
