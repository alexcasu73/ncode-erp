#!/usr/bin/env python3
"""
Script per importare l'anagrafica clienti da file Excel
"""
import pandas as pd
import sys

def read_clienti(file_path):
    """Legge l'anagrafica clienti dal file Excel"""
    try:
        # Leggi il file Excel
        excel_file = pd.ExcelFile(file_path)

        # Mostra tutti i fogli disponibili
        print("Fogli disponibili nel file Excel:")
        for i, sheet in enumerate(excel_file.sheet_names):
            print(f"{i+1}. {sheet}")

        print("\n" + "="*80 + "\n")

        # Cerca un foglio che potrebbe contenere i clienti
        possible_sheets = ['Clienti', 'Anagrafica', 'Customers', 'Anagrafiche']
        client_sheet = None

        for sheet in possible_sheets:
            if sheet in excel_file.sheet_names:
                client_sheet = sheet
                break

        # Se non trovato, usa il primo foglio
        if not client_sheet:
            client_sheet = excel_file.sheet_names[0]

        print(f"Lettura del foglio: {client_sheet}\n")

        # Leggi il foglio
        df = pd.read_excel(file_path, sheet_name=client_sheet)

        # Mostra info sul dataframe
        print(f"Numero di righe: {len(df)}")
        print(f"Numero di colonne: {len(df.columns)}\n")

        print("Colonne disponibili:")
        for i, col in enumerate(df.columns):
            print(f"{i+1}. {col}")

        print("\n" + "="*80 + "\n")

        # Mostra le prime righe
        print("Prime 5 righe del dataset:\n")
        pd.set_option('display.max_columns', None)
        pd.set_option('display.width', None)
        pd.set_option('display.max_colwidth', 50)
        print(df.head())

        print("\n" + "="*80 + "\n")

        # Mostra info sui tipi di dati
        print("Tipi di dati per colonna:\n")
        print(df.dtypes)

        return df

    except Exception as e:
        print(f"Errore durante la lettura del file: {e}")
        sys.exit(1)

if __name__ == "__main__":
    file_path = "/Users/alessandrocasu/Downloads/BP-2026 Ncode Studio (1).xlsx"
    df = read_clienti(file_path)
