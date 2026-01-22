-- Migration: Change cashflow ID format from CF-xxxx to CF-xxx/yyyy
-- This migration:
-- 1. Creates a new function to generate IDs with year (CF-001/2025, CF-002/2025, etc.)
-- 2. Converts all existing records to the new format
-- 3. Resets the counter each year

-- Drop existing function
DROP FUNCTION IF EXISTS generate_cashflow_id() CASCADE;

-- Create new function that generates IDs with year format
-- The function accepts an optional year parameter, defaults to current year
CREATE OR REPLACE FUNCTION generate_cashflow_id(payment_year INTEGER DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  target_year INTEGER;
  max_id INTEGER;
  next_id INTEGER;
  new_id TEXT;
  attempts INTEGER := 0;
BEGIN
  -- Use provided year or current year
  target_year := COALESCE(payment_year, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);

  -- Find the maximum existing numeric ID for this year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(id FROM 'CF-(\d+)/\d{4}') AS INTEGER
      )
    ), 0
  ) INTO max_id
  FROM cashflow_records
  WHERE id ~ ('^CF-\d+/' || target_year || '$');

  -- Start from max_id + 1
  next_id := max_id + 1;

  -- Generate ID with 3-digit padding and year
  new_id := 'CF-' || LPAD(next_id::TEXT, 3, '0') || '/' || target_year;

  -- Check if it exists (should not, but be safe)
  WHILE EXISTS (SELECT 1 FROM cashflow_records WHERE id = new_id) AND attempts < 1000 LOOP
    next_id := next_id + 1;
    new_id := 'CF-' || LPAD(next_id::TEXT, 3, '0') || '/' || target_year;
    attempts := attempts + 1;
  END LOOP;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Create a function to convert existing IDs
CREATE OR REPLACE FUNCTION convert_cashflow_ids()
RETURNS void AS $$
DECLARE
  rec RECORD;
  payment_year INTEGER;
  new_id TEXT;
  old_id TEXT;
BEGIN
  -- Process each cashflow record that doesn't have the new format
  FOR rec IN
    SELECT id, data_pagamento
    FROM cashflow_records
    WHERE id !~ '^CF-\d{3}/\d{4}$'
    ORDER BY data_pagamento ASC, created_at ASC
  LOOP
    old_id := rec.id;

    -- Extract year from payment date, or use current year if no date
    IF rec.data_pagamento IS NOT NULL THEN
      payment_year := EXTRACT(YEAR FROM rec.data_pagamento)::INTEGER;
    ELSE
      payment_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
    END IF;

    -- Generate new ID for this year
    new_id := generate_cashflow_id(payment_year);

    -- Update foreign keys in bank_transactions first
    UPDATE bank_transactions
    SET matched_cashflow_id = new_id
    WHERE matched_cashflow_id = old_id;

    -- Update the cashflow record ID
    UPDATE cashflow_records
    SET id = new_id
    WHERE id = old_id;

    RAISE NOTICE 'Converted % to %', old_id, new_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the conversion
SELECT convert_cashflow_ids();

-- Drop the temporary conversion function
DROP FUNCTION convert_cashflow_ids();

-- Create a trigger function to auto-generate IDs based on payment date
CREATE OR REPLACE FUNCTION set_cashflow_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If ID is not provided or is empty, generate one
  IF NEW.id IS NULL OR NEW.id = '' THEN
    -- Use the year from data_pagamento if available
    IF NEW.data_pagamento IS NOT NULL THEN
      NEW.id := generate_cashflow_id(EXTRACT(YEAR FROM NEW.data_pagamento)::INTEGER);
    ELSE
      NEW.id := generate_cashflow_id();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_set_cashflow_id ON cashflow_records;

-- Create trigger to auto-generate IDs on insert
CREATE TRIGGER trigger_set_cashflow_id
  BEFORE INSERT ON cashflow_records
  FOR EACH ROW
  EXECUTE FUNCTION set_cashflow_id();

-- Remove the DEFAULT from the column since we're using a trigger now
ALTER TABLE cashflow_records ALTER COLUMN id DROP DEFAULT;

-- Log the migration
DO $$
DECLARE
  record_count INTEGER;
  year_stats RECORD;
BEGIN
  SELECT COUNT(*) INTO record_count FROM cashflow_records;

  RAISE NOTICE 'Migration complete! Total cashflow records: %', record_count;
  RAISE NOTICE 'Records by year:';

  FOR year_stats IN
    SELECT
      SUBSTRING(id FROM '/(\d{4})$') as year,
      COUNT(*) as count,
      MIN(id) as first_id,
      MAX(id) as last_id
    FROM cashflow_records
    WHERE id ~ '^CF-\d{3}/\d{4}$'
    GROUP BY SUBSTRING(id FROM '/(\d{4})$')
    ORDER BY year
  LOOP
    RAISE NOTICE '  Year %: % records (% to %)',
      year_stats.year,
      year_stats.count,
      year_stats.first_id,
      year_stats.last_id;
  END LOOP;
END $$;
