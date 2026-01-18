-- Funzione per creare azienda durante la registrazione
-- Usa SECURITY DEFINER per bypassare RLS quando l'utente non è ancora autenticato

CREATE OR REPLACE FUNCTION create_company_for_registration(
  company_name TEXT,
  company_slug TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
BEGIN
  -- Inserisce la nuova azienda bypassando RLS
  INSERT INTO companies (name, slug, is_active)
  VALUES (company_name, company_slug, true)
  RETURNING id INTO new_company_id;

  RETURN new_company_id;
END;
$$;

-- Permetti a PUBLIC di eseguire questa funzione
GRANT EXECUTE ON FUNCTION create_company_for_registration(TEXT, TEXT) TO public;
