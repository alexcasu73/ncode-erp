-- Funzione atomica per gestire il template default
-- Evita race condition tra i due UPDATE separati

CREATE OR REPLACE FUNCTION set_default_bank_template(
  p_template_id UUID,
  p_company_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Rimuove il default da tutti i template della company
  UPDATE bank_templates
  SET is_default = false
  WHERE company_id = p_company_id;

  -- Imposta il nuovo default (se p_template_id è NULL rimuove solo)
  IF p_template_id IS NOT NULL THEN
    UPDATE bank_templates
    SET is_default = true
    WHERE id = p_template_id AND company_id = p_company_id;
  END IF;
END;
$$;
