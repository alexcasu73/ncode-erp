CREATE OR REPLACE FUNCTION flip_bank_transactions_tipo(
  p_session_id TEXT,
  p_company_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE bank_transactions
  SET tipo = CASE WHEN tipo = 'Entrata' THEN 'Uscita' ELSE 'Entrata' END
  WHERE session_id = p_session_id
    AND company_id = p_company_id
    AND match_status = 'pending';
END;
$$;
