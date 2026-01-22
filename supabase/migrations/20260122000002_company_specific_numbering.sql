-- Migration: Company-specific numbering for invoices and cashflow
-- Each company has its own independent numbering that resets each year
-- Invoices: A-IN-001/2025, A-IN-002/2025, etc. (A = company code)
-- Cashflow: A-CF-001/2025, A-CF-002/2025, etc.

-- ============================================================================
-- ADD COMPANY CODE FIELD
-- ============================================================================

-- Add code field to companies table for short prefix
ALTER TABLE companies ADD COLUMN IF NOT EXISTS code TEXT;

-- Create function to generate company code from name
CREATE OR REPLACE FUNCTION generate_company_code(company_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_code TEXT;
  final_code TEXT;
  counter INTEGER := 1;
BEGIN
  -- Extract uppercase letters from company name (max 3 chars)
  base_code := UPPER(
    REGEXP_REPLACE(
      SUBSTRING(
        REGEXP_REPLACE(company_name, '[^A-Za-z]', '', 'g'),
        1, 3
      ),
      '[^A-Z]', '', 'g'
    )
  );

  -- If less than 1 char, use 'C' (for Company)
  IF LENGTH(base_code) < 1 THEN
    base_code := 'C';
  END IF;

  -- Ensure uniqueness
  final_code := base_code;
  WHILE EXISTS (SELECT 1 FROM companies WHERE code = final_code) LOOP
    counter := counter + 1;
    final_code := base_code || counter;
  END LOOP;

  RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to auto-generate company code
CREATE OR REPLACE FUNCTION set_company_code()
RETURNS TRIGGER AS $$
BEGIN
  -- If code is not provided or is empty, generate one
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := generate_company_code(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for companies (must be created before making code NOT NULL)
CREATE TRIGGER trigger_set_company_code
  BEFORE INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION set_company_code();

-- Generate codes for existing companies
UPDATE companies
SET code = generate_company_code(name)
WHERE code IS NULL OR code = '';

-- Make code NOT NULL after populating and creating trigger
ALTER TABLE companies ALTER COLUMN code SET NOT NULL;

-- Add unique constraint
ALTER TABLE companies ADD CONSTRAINT companies_code_key UNIQUE (code);

-- Create index
CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(code);

-- ============================================================================
-- CASHFLOW FUNCTIONS
-- ============================================================================

-- Drop existing cashflow function and trigger
DROP TRIGGER IF EXISTS trigger_set_cashflow_id ON cashflow_records;
DROP FUNCTION IF EXISTS set_cashflow_id() CASCADE;
DROP FUNCTION IF EXISTS generate_cashflow_id(INTEGER) CASCADE;

-- Create new cashflow ID generation function with company_id parameter
CREATE OR REPLACE FUNCTION generate_cashflow_id(p_company_id UUID, payment_year INTEGER DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  company_code TEXT;
  target_year INTEGER;
  max_id INTEGER;
  next_id INTEGER;
  new_id TEXT;
  attempts INTEGER := 0;
BEGIN
  -- Get company code
  SELECT code INTO company_code
  FROM companies
  WHERE id = p_company_id;

  IF company_code IS NULL THEN
    RAISE EXCEPTION 'Company % not found or has no code', p_company_id;
  END IF;

  -- Use provided year or current year
  target_year := COALESCE(payment_year, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);

  -- Find the maximum existing numeric ID for this company and year
  -- Pattern: COMPANYCODE-CF-NNN/YYYY
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(id FROM company_code || '-CF-(\d+)/\d{4}') AS INTEGER
      )
    ), 0
  ) INTO max_id
  FROM cashflow_records
  WHERE company_id = p_company_id
    AND id ~ ('^' || company_code || '-CF-\d+/' || target_year || '$');

  -- Start from max_id + 1
  next_id := max_id + 1;

  -- Generate ID with company code, 3-digit padding and year
  new_id := company_code || '-CF-' || LPAD(next_id::TEXT, 3, '0') || '/' || target_year;

  -- Check if it exists globally (should not, but be safe)
  WHILE EXISTS (
    SELECT 1 FROM cashflow_records WHERE id = new_id
  ) AND attempts < 1000 LOOP
    next_id := next_id + 1;
    new_id := company_code || '-CF-' || LPAD(next_id::TEXT, 3, '0') || '/' || target_year;
    attempts := attempts + 1;
  END LOOP;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to auto-generate cashflow IDs
CREATE OR REPLACE FUNCTION set_cashflow_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If ID is not provided or is empty, generate one
  IF NEW.id IS NULL OR NEW.id = '' THEN
    -- Use the year from data_pagamento if available
    IF NEW.data_pagamento IS NOT NULL THEN
      NEW.id := generate_cashflow_id(NEW.company_id, EXTRACT(YEAR FROM NEW.data_pagamento)::INTEGER);
    ELSE
      NEW.id := generate_cashflow_id(NEW.company_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cashflow records
CREATE TRIGGER trigger_set_cashflow_id
  BEFORE INSERT ON cashflow_records
  FOR EACH ROW
  EXECUTE FUNCTION set_cashflow_id();

-- ============================================================================
-- INVOICE FUNCTIONS
-- ============================================================================

-- Create invoice ID generation function with company_id parameter
CREATE OR REPLACE FUNCTION generate_invoice_id(p_company_id UUID, invoice_year INTEGER DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  company_code TEXT;
  target_year INTEGER;
  max_id INTEGER;
  next_id INTEGER;
  new_id TEXT;
  attempts INTEGER := 0;
BEGIN
  -- Get company code
  SELECT code INTO company_code
  FROM companies
  WHERE id = p_company_id;

  IF company_code IS NULL THEN
    RAISE EXCEPTION 'Company % not found or has no code', p_company_id;
  END IF;

  -- Use provided year or current year
  target_year := COALESCE(invoice_year, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);

  -- Find the maximum existing numeric ID for this company and year
  -- Handle both old format (Fattura_xxx) and new format (COMPANYCODE-IN-xxx/yyyy)
  SELECT COALESCE(
    MAX(
      CASE
        -- New format: ABC-IN-123/2025
        WHEN id ~ ('^' || company_code || '-IN-\d+/\d{4}$') THEN
          CAST(SUBSTRING(id FROM company_code || '-IN-(\d+)/\d{4}') AS INTEGER)
        -- Old format without company code: IN-123/2025
        WHEN id ~ '^IN-\d+/\d{4}$' THEN
          CAST(SUBSTRING(id FROM 'IN-(\d+)/\d{4}') AS INTEGER)
        -- Old format: Fattura_123 or Fattura_123/2025
        WHEN id ~ '^Fattura_\d+' THEN
          CAST(
            REGEXP_REPLACE(
              SUBSTRING(id FROM 'Fattura_(\d+)'),
              '/.*$', ''
            ) AS INTEGER
          )
        ELSE 0
      END
    ), 0
  ) INTO max_id
  FROM invoices
  WHERE company_id = p_company_id
    AND (
      id ~ ('^' || company_code || '-IN-\d+/' || target_year || '$')
      OR id ~ ('^IN-\d+/' || target_year || '$')
      OR (id ~ '^Fattura_\d+' AND anno = target_year)
    );

  -- Start from max_id + 1
  next_id := max_id + 1;

  -- Generate ID with company code, 3-digit padding and year
  new_id := company_code || '-IN-' || LPAD(next_id::TEXT, 3, '0') || '/' || target_year;

  -- Check if it exists globally (should not, but be safe)
  WHILE EXISTS (
    SELECT 1 FROM invoices WHERE id = new_id
  ) AND attempts < 1000 LOOP
    next_id := next_id + 1;
    new_id := company_code || '-IN-' || LPAD(next_id::TEXT, 3, '0') || '/' || target_year;
    attempts := attempts + 1;
  END LOOP;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to auto-generate invoice IDs
CREATE OR REPLACE FUNCTION set_invoice_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate ID if it's not provided or has old format
  IF NEW.id IS NULL OR NEW.id = '' OR NEW.id ~ '^Fattura_' THEN
    -- Use the year from data if available, otherwise from anno field
    IF NEW.data IS NOT NULL THEN
      NEW.id := generate_invoice_id(NEW.company_id, EXTRACT(YEAR FROM NEW.data)::INTEGER);
    ELSIF NEW.anno IS NOT NULL THEN
      NEW.id := generate_invoice_id(NEW.company_id, NEW.anno);
    ELSE
      NEW.id := generate_invoice_id(NEW.company_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invoices (only for INSERT, not UPDATE to avoid breaking existing IDs)
CREATE TRIGGER trigger_set_invoice_id
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_id();

-- ============================================================================
-- CONVERT EXISTING RECORDS
-- ============================================================================

-- Function to convert existing cashflow records to company-specific numbering
CREATE OR REPLACE FUNCTION convert_cashflow_to_company_numbering()
RETURNS void AS $$
DECLARE
  rec RECORD;
  payment_year INTEGER;
  new_id TEXT;
  old_id TEXT;
BEGIN
  -- Process each cashflow record that doesn't have the new format with company code
  -- Group by company to ensure proper numbering
  FOR rec IN
    SELECT id, company_id, data_pagamento, created_at
    FROM cashflow_records
    WHERE id !~ '^\w+-CF-\d{3}/\d{4}$'
    ORDER BY company_id, data_pagamento ASC, created_at ASC
  LOOP
    old_id := rec.id;

    -- Extract year from payment date, or use current year if no date
    IF rec.data_pagamento IS NOT NULL THEN
      payment_year := EXTRACT(YEAR FROM rec.data_pagamento)::INTEGER;
    ELSE
      payment_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
    END IF;

    -- Generate new ID for this company and year
    new_id := generate_cashflow_id(rec.company_id, payment_year);

    -- Update foreign keys in bank_transactions first
    UPDATE bank_transactions
    SET matched_cashflow_id = new_id
    WHERE matched_cashflow_id = old_id;

    -- Update the cashflow record ID
    UPDATE cashflow_records
    SET id = new_id
    WHERE id = old_id;

    RAISE NOTICE 'Converted cashflow % to %', old_id, new_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to convert existing invoice records to company-specific numbering
CREATE OR REPLACE FUNCTION convert_invoices_to_company_numbering()
RETURNS void AS $$
DECLARE
  rec RECORD;
  invoice_year INTEGER;
  new_id TEXT;
  old_id TEXT;
BEGIN
  -- Process each invoice that doesn't have the new format with company code
  -- Group by company to ensure proper numbering
  FOR rec IN
    SELECT id, company_id, data, anno, created_at
    FROM invoices
    WHERE id !~ '^\w+-IN-\d{3}/\d{4}$'
    ORDER BY company_id,
             COALESCE(anno, EXTRACT(YEAR FROM data)::INTEGER, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER),
             data ASC,
             created_at ASC
  LOOP
    old_id := rec.id;

    -- Extract year from data or anno field
    IF rec.data IS NOT NULL THEN
      invoice_year := EXTRACT(YEAR FROM rec.data)::INTEGER;
    ELSIF rec.anno IS NOT NULL THEN
      invoice_year := rec.anno;
    ELSE
      invoice_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
    END IF;

    -- Generate new ID for this company and year
    new_id := generate_invoice_id(rec.company_id, invoice_year);

    -- Update foreign keys first
    UPDATE bank_transactions
    SET matched_invoice_id = new_id
    WHERE matched_invoice_id = old_id;

    UPDATE cashflow_records
    SET invoice_id = new_id
    WHERE invoice_id = old_id;

    UPDATE invoice_notifications
    SET invoice_id = new_id
    WHERE invoice_id = old_id;

    -- Update the invoice ID
    UPDATE invoices
    SET id = new_id
    WHERE id = old_id;

    RAISE NOTICE 'Converted invoice % to %', old_id, new_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the conversions
SELECT convert_cashflow_to_company_numbering();
SELECT convert_invoices_to_company_numbering();

-- Drop the temporary conversion functions
DROP FUNCTION convert_cashflow_to_company_numbering();
DROP FUNCTION convert_invoices_to_company_numbering();

-- ============================================================================
-- LOG MIGRATION RESULTS
-- ============================================================================

DO $$
DECLARE
  company_rec RECORD;
  year_rec RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration complete!';
  RAISE NOTICE '========================================';

  -- Log cashflow records by company
  RAISE NOTICE 'CASHFLOW RECORDS BY COMPANY:';
  FOR company_rec IN
    SELECT
      c.name as company_name,
      cf.company_id,
      COUNT(*) as total_records
    FROM cashflow_records cf
    JOIN companies c ON c.id = cf.company_id
    GROUP BY c.name, cf.company_id
    ORDER BY c.name
  LOOP
    RAISE NOTICE '  Company: % (Total: %)', company_rec.company_name, company_rec.total_records;

    -- Show years for this company
    FOR year_rec IN
      SELECT
        SUBSTRING(id FROM '/(\d{4})$') as year,
        COUNT(*) as count,
        MIN(id) as first_id,
        MAX(id) as last_id
      FROM cashflow_records
      WHERE company_id = company_rec.company_id
        AND id ~ '^\w+-CF-\d{3}/\d{4}$'
      GROUP BY SUBSTRING(id FROM '/(\d{4})$')
      ORDER BY year
    LOOP
      RAISE NOTICE '    Year %: % records (% to %)',
        year_rec.year, year_rec.count, year_rec.first_id, year_rec.last_id;
    END LOOP;
  END LOOP;

  -- Log invoice records by company
  RAISE NOTICE '';
  RAISE NOTICE 'INVOICE RECORDS BY COMPANY:';
  FOR company_rec IN
    SELECT
      c.name as company_name,
      i.company_id,
      COUNT(*) as total_records
    FROM invoices i
    JOIN companies c ON c.id = i.company_id
    GROUP BY c.name, i.company_id
    ORDER BY c.name
  LOOP
    RAISE NOTICE '  Company: % (Total: %)', company_rec.company_name, company_rec.total_records;

    -- Show years for this company
    FOR year_rec IN
      SELECT
        SUBSTRING(id FROM '/(\d{4})$') as year,
        COUNT(*) as count,
        MIN(id) as first_id,
        MAX(id) as last_id
      FROM invoices
      WHERE company_id = company_rec.company_id
        AND id ~ '^\w+-IN-\d{3}/\d{4}$'
      GROUP BY SUBSTRING(id FROM '/(\d{4})$')
      ORDER BY year
    LOOP
      RAISE NOTICE '    Year %: % records (% to %)',
        year_rec.year, year_rec.count, year_rec.first_id, year_rec.last_id;
    END LOOP;
  END LOOP;

  RAISE NOTICE '========================================';
END $$;
