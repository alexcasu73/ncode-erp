-- Fix bank_balances unique constraint for multi-tenancy
-- The table had UNIQUE(anno) which prevented multiple companies from having the same year
-- Now we fix it to UNIQUE(anno, company_id) for proper multi-tenant isolation

-- Drop the old unique constraint on anno only
ALTER TABLE bank_balances DROP CONSTRAINT IF EXISTS bank_balances_anno_key;

-- Add new composite unique constraint on (anno, company_id)
ALTER TABLE bank_balances ADD CONSTRAINT bank_balances_anno_company_key UNIQUE (anno, company_id);

-- Add comment
COMMENT ON CONSTRAINT bank_balances_anno_company_key ON bank_balances IS 'Each company can have only one bank balance per year';
