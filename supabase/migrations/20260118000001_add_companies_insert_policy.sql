-- Fix: Aggiungi policy INSERT mancanti per companies e company_users
-- Senza queste policy, gli utenti non possono creare nuove aziende

-- Policy per creare aziende
CREATE POLICY "Authenticated users can create companies"
ON companies
FOR INSERT
TO public
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy per creare collegamenti utente-azienda
CREATE POLICY "Users can create company memberships"
ON company_users
FOR INSERT
TO public
WITH CHECK (user_id = auth.uid());
