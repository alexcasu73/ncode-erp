-- Script per creare un utente admin
-- Email: admin@ncodestudio.com
-- Password: Admin123!

DO $$
DECLARE
  v_user_id UUID;
  v_user_exists BOOLEAN;
BEGIN
  -- Genera un nuovo ID per l'utente
  v_user_id := gen_random_uuid();

  -- Verifica se l'utente esiste già
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'admin@ncodestudio.com') INTO v_user_exists;

  IF v_user_exists THEN
    -- Se esiste, prendi il suo ID
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@ncodestudio.com';

    -- Aggiorna la password e i campi
    UPDATE auth.users
    SET
      encrypted_password = crypt('Admin123!', gen_salt('bf')),
      email_confirmed_at = NOW(),
      updated_at = NOW(),
      email_change = '',
      email_change_token_new = '',
      email_change_token_current = '',
      recovery_token = '',
      phone_change = '',
      phone_change_token = '',
      reauthentication_token = ''
    WHERE id = v_user_id;

    RAISE NOTICE 'Utente esistente aggiornato';
  ELSE
    -- Crea nuovo utente in auth.users
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      email_change_token_current,
      recovery_token,
      phone_change,
      phone_change_token,
      reauthentication_token,
      role,
      aud
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@ncodestudio.com',
      crypt('Admin123!', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'authenticated',
      'authenticated'
    );

    RAISE NOTICE 'Nuovo utente creato in auth.users';
  END IF;

  -- Inserisci o aggiorna nella tabella users
  INSERT INTO users (id, email, full_name, is_active)
  VALUES (v_user_id, 'admin@ncodestudio.com', 'Admin Ncode Studio', true)
  ON CONFLICT (email) DO UPDATE
  SET
    full_name = 'Admin Ncode Studio',
    is_active = true,
    updated_at = NOW();

  RAISE NOTICE 'Record creato/aggiornato in users';

  -- Associa l'utente alla company Ncode Studio con ruolo admin
  -- Prima elimina eventuali associazioni esistenti per questo utente
  DELETE FROM company_users cu WHERE cu.user_id = v_user_id;

  -- Poi inserisci la nuova associazione
  INSERT INTO company_users (company_id, user_id, role, is_active)
  VALUES ('00000000-0000-0000-0000-000000000001', v_user_id, 'admin', true);

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Utente admin creato con successo!';
  RAISE NOTICE 'Email: admin@ncodestudio.com';
  RAISE NOTICE 'Password: Admin123!';
  RAISE NOTICE '========================================';
END $$;
