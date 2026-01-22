-- Fix company code generation function
-- The original function had the wrong order of operations (UPPER was applied after REGEXP_REPLACE)
-- This caused it to generate only single letters instead of 3-letter codes

CREATE OR REPLACE FUNCTION generate_company_code(company_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_code TEXT;
  final_code TEXT;
  counter INTEGER := 1;
BEGIN
  -- Extract first 3 letters from company name (uppercase, removing non-alphabetic chars)
  base_code := SUBSTRING(
    REGEXP_REPLACE(
      UPPER(company_name),
      '[^A-Z]', '', 'g'
    ),
    1, 3
  );

  -- If less than 1 char, use 'C' (for Company)
  IF LENGTH(base_code) < 1 THEN
    base_code := 'C';
  END IF;

  -- Ensure uniqueness by adding a number if needed
  final_code := base_code;
  WHILE EXISTS (SELECT 1 FROM companies WHERE code = final_code) LOOP
    counter := counter + 1;
    final_code := base_code || counter;
  END LOOP;

  RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- Update existing company code from 'N' to 'NCO' if it was incorrectly generated
UPDATE companies
SET code = 'NCO'
WHERE code = 'N'
  AND UPPER(SUBSTRING(REGEXP_REPLACE(UPPER(name), '[^A-Z]', '', 'g'), 1, 3)) = 'NCO';
