-- Fix: Aggiungi policy INSERT mancante per la tabella companies
-- Senza questa policy, gli utenti non possono creare nuove aziende

CREATE POLICY "Authenticated users can create companies"
ON companies
FOR INSERT
TO public
WITH CHECK (auth.uid() IS NOT NULL);
