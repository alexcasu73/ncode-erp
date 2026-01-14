-- Fix cashflow ID generation to handle duplicates automatically
-- If ID exists, find max ID and use that + 1

DROP FUNCTION IF EXISTS generate_cashflow_id() CASCADE;

-- Create a robust function that always finds the next available ID
CREATE OR REPLACE FUNCTION generate_cashflow_id()
RETURNS TEXT AS $$
DECLARE
  max_id INTEGER;
  next_id INTEGER;
  new_id TEXT;
  attempts INTEGER := 0;
BEGIN
  -- Try to find the maximum existing numeric ID
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(id FROM 'CF-(\d+)') AS INTEGER
      )
    ), 0
  ) INTO max_id
  FROM cashflow_records
  WHERE id ~ '^CF-\d+$';

  -- Start from max_id + 1
  next_id := max_id + 1;

  -- Generate ID with padding
  new_id := 'CF-' || LPAD(next_id::TEXT, 4, '0');

  -- Check if it exists (should not, but be safe)
  WHILE EXISTS (SELECT 1 FROM cashflow_records WHERE id = new_id) AND attempts < 1000 LOOP
    next_id := next_id + 1;
    new_id := 'CF-' || LPAD(next_id::TEXT, 4, '0');
    attempts := attempts + 1;
  END LOOP;

  -- Update sequence to match (for next time)
  PERFORM setval('cashflow_id_seq', next_id + 1, false);

  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Re-add the default value to use this function
ALTER TABLE cashflow_records
  ALTER COLUMN id SET DEFAULT generate_cashflow_id();

-- Log the fix
DO $$
DECLARE
  max_id INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(id FROM 'CF-(\d+)') AS INTEGER
      )
    ), 0
  ) INTO max_id
  FROM cashflow_records
  WHERE id ~ '^CF-\d+$';

  RAISE NOTICE 'Cashflow ID generation fixed. Current max ID: CF-%, next will be CF-%',
    LPAD(max_id::TEXT, 4, '0'),
    LPAD((max_id + 1)::TEXT, 4, '0');
END $$;
