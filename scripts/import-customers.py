#!/usr/bin/env python3
"""
Script per importare l'anagrafica clienti da file Excel in Supabase
"""
import pandas as pd
import sys
import os
from dotenv import load_dotenv

# Carica variabili d'ambiente
load_dotenv()

# Per Supabase locale, useremo una connessione diretta al database PostgreSQL
import psycopg2
from psycopg2.extras import RealDictCursor

# Configurazione database locale Supabase
DB_CONFIG = {
    'host': 'localhost',
    'port': 54322,  # Porta predefinita per il database Supabase locale
    'database': 'postgres',
    'user': 'postgres',
    'password': 'postgres'
}

# Company ID predefinito per Ncode Studio
NCODE_STUDIO_COMPANY_ID = '00000000-0000-0000-0000-000000000001'

def connect_db():
    """Connette al database PostgreSQL"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"Errore di connessione al database: {e}")
        print("\nAssicurati che Supabase sia in esecuzione con: npx supabase start")
        sys.exit(1)

def read_excel_customers(file_path):
    """Legge i clienti dal file Excel"""
    try:
        df = pd.read_excel(file_path, sheet_name='Anagrafiche clienti')
        print(f"✓ Letti {len(df)} clienti dal file Excel")
        return df
    except Exception as e:
        print(f"Errore durante la lettura del file Excel: {e}")
        sys.exit(1)

def map_customer_data(row):
    """Mappa una riga Excel ai campi del database"""
    # Gestisce valori NaN
    def clean_value(val):
        if pd.isna(val):
            return None
        return str(val).strip()

    return {
        'company_id': NCODE_STUDIO_COMPANY_ID,
        'name': clean_value(row.get('Azienda')),
        'company': clean_value(row.get('Ragione sociale')),
        'email': clean_value(row.get('Email')),
        'vat_id': clean_value(row.get('p.iva/codice fiscale')),
        'sdi_code': clean_value(row.get('SDI')),
        'address': clean_value(row.get('Sede')),
        'phone': clean_value(row.get('Telefono')),
        'contact_person': clean_value(row.get('Contatto')),
        'pec': clean_value(row.get('PEC')),
        'legal_representative': clean_value(row.get('Legale Rappresentante')),
        'status': 'active',  # Stato predefinito
        'revenue': 0  # Revenue predefinito
    }

def import_customers(df, conn):
    """Importa i clienti nel database"""
    cursor = conn.cursor()
    imported = 0
    errors = []

    print(f"\nInizio importazione di {len(df)} clienti...")
    print("="*80)

    for idx, row in df.iterrows():
        try:
            customer = map_customer_data(row)

            # Skip se il nome è vuoto
            if not customer['name']:
                print(f"⚠ Riga {idx + 1}: Saltata (nome mancante)")
                continue

            # Inserisci il cliente
            insert_query = """
                INSERT INTO customers (
                    company_id, name, company, email, vat_id, sdi_code,
                    address, phone, contact_person, pec, legal_representative,
                    status, revenue
                )
                VALUES (
                    %(company_id)s, %(name)s, %(company)s, %(email)s, %(vat_id)s, %(sdi_code)s,
                    %(address)s, %(phone)s, %(contact_person)s, %(pec)s, %(legal_representative)s,
                    %(status)s, %(revenue)s
                )
                ON CONFLICT (id) DO NOTHING
            """

            cursor.execute(insert_query, customer)
            imported += 1
            print(f"✓ Importato: {customer['name']}")

        except Exception as e:
            error_msg = f"Riga {idx + 1} ({row.get('Azienda', 'N/A')}): {str(e)}"
            errors.append(error_msg)
            print(f"✗ Errore: {error_msg}")

    # Commit delle modifiche
    conn.commit()
    cursor.close()

    print("="*80)
    print(f"\n✓ Importazione completata!")
    print(f"  - Clienti importati: {imported}")
    print(f"  - Errori: {len(errors)}")

    if errors:
        print("\nErrori riscontrati:")
        for error in errors:
            print(f"  • {error}")

    return imported, errors

def main():
    """Funzione principale"""
    file_path = "/Users/alessandrocasu/Downloads/BP-2026 Ncode Studio (1).xlsx"

    print("="*80)
    print("IMPORTAZIONE ANAGRAFICA CLIENTI")
    print("="*80)

    # Connetti al database
    print("\n1. Connessione al database...")
    conn = connect_db()
    print("✓ Connesso al database")

    # Leggi il file Excel
    print("\n2. Lettura file Excel...")
    df = read_excel_customers(file_path)

    # Importa i clienti
    print("\n3. Importazione clienti...")
    imported, errors = import_customers(df, conn)

    # Chiudi la connessione
    conn.close()

    print("\n" + "="*80)
    print(f"PROCESSO COMPLETATO - {imported} clienti importati")
    print("="*80)

if __name__ == "__main__":
    main()
