-- Create a function to generate consistent cashflow IDs in format CF-timestamp-random
CREATE OR REPLACE FUNCTION generate_cashflow_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'CF-' || EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || FLOOR(RANDOM() * 1000)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Update the cashflow_records table to use the new function
ALTER TABLE cashflow_records
  ALTER COLUMN id SET DEFAULT generate_cashflow_id();
