-- ============================================
-- DELETE NEW COMPANY (55dc098d-3aac-45d5-9744-5f2adf9e18a7)
-- ============================================
-- Delete the test company created by the user
-- This will cascade delete all related data
-- ============================================

-- Show what will be deleted
SELECT
  'Company' as type,
  id,
  name,
  slug,
  created_at
FROM companies
WHERE id = '55dc098d-3aac-45d5-9744-5f2adf9e18a7';

SELECT
  'Users in company' as type,
  u.id,
  u.name,
  u.email,
  cu.role
FROM users u
JOIN company_users cu ON u.id = cu.user_id
WHERE cu.company_id = '55dc098d-3aac-45d5-9744-5f2adf9e18a7';

-- Delete the company (this will cascade delete everything)
DELETE FROM companies
WHERE id = '55dc098d-3aac-45d5-9744-5f2adf9e18a7';

-- Verify deletion
SELECT COUNT(*) as remaining_companies FROM companies;

SELECT
  c.name as company_name,
  COUNT(u.id) as num_users
FROM companies c
LEFT JOIN company_users cu ON c.id = cu.company_id
LEFT JOIN users u ON cu.user_id = u.id
GROUP BY c.id, c.name
ORDER BY c.created_at;
