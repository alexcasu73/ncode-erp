-- Reset cashflow sequence to match existing data
-- This fixes the "duplicate key" error when adding new cashflow records

-- Find the highest numeric ID currently in use and set sequence to next value
DO $$
DECLARE
  max_id INTEGER;
BEGIN
  -- Extract the numeric part from all CF-XXXX IDs and find the maximum
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(id FROM 'CF-(\d+)') AS INTEGER
      )
    ), 0
  ) INTO max_id
  FROM cashflow_records
  WHERE id ~ '^CF-\d+$';

  -- Reset sequence to max_id + 1
  PERFORM setval('cashflow_id_seq', max_id + 1, false);

  RAISE NOTICE 'Cashflow sequence reset: highest existing ID = CF-%, next ID will be CF-%',
    LPAD(max_id::TEXT, 4, '0'),
    LPAD((max_id + 1)::TEXT, 4, '0');
END $$;
