-- Create a sequence for progressive cashflow IDs
CREATE SEQUENCE IF NOT EXISTS cashflow_id_seq START WITH 1;

-- Drop the old function
DROP FUNCTION IF EXISTS generate_cashflow_id();

-- Create a new function to generate progressive IDs in format CF-001, CF-002, etc.
CREATE OR REPLACE FUNCTION generate_cashflow_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'CF-' || LPAD(nextval('cashflow_id_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Update existing cashflow_records to use progressive IDs
-- This will reassign IDs starting from CF-0001
DO $$
DECLARE
  rec RECORD;
  counter INTEGER := 1;
BEGIN
  FOR rec IN
    SELECT id FROM cashflow_records ORDER BY created_at
  LOOP
    EXECUTE format('UPDATE cashflow_records SET id = %L WHERE id = %L', 'CF-' || LPAD(counter::TEXT, 4, '0'), rec.id);
    counter := counter + 1;
  END LOOP;

  -- Set the sequence to the next available number
  PERFORM setval('cashflow_id_seq', counter);
END $$;
