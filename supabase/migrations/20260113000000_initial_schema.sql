-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  status TEXT,
  revenue DECIMAL(10, 2) DEFAULT 0,
  vat_id TEXT,
  sdi_code TEXT,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deals table
CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  title TEXT NOT NULL,
  customer_name TEXT,
  value DECIMAL(10, 2) DEFAULT 0,
  stage TEXT,
  probability INTEGER DEFAULT 0,
  expected_close TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  data DATE,
  mese TEXT,
  anno INTEGER,
  nome_progetto TEXT,
  tipo TEXT,
  stato_fatturazione TEXT,
  spesa TEXT,
  tipo_spesa TEXT,
  note TEXT,
  flusso DECIMAL(10, 2) DEFAULT 0,
  iva DECIMAL(10, 2) DEFAULT 0,
  percentuale_iva DECIMAL(5, 2) DEFAULT 0,
  percentuale_fatturazione DECIMAL(5, 2) DEFAULT 100,
  checked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  date TEXT,
  description TEXT,
  category TEXT,
  amount DECIMAL(10, 2) DEFAULT 0,
  type TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Financial Items table
CREATE TABLE IF NOT EXISTS financial_items (
  id TEXT PRIMARY KEY,
  section TEXT,
  category TEXT,
  name TEXT NOT NULL,
  amount DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cashflow Records table
CREATE TABLE IF NOT EXISTS cashflow_records (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  invoice_id TEXT,
  data_pagamento DATE,
  importo DECIMAL(10, 2),
  note TEXT,
  tipo TEXT,
  descrizione TEXT,
  categoria TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);

-- Bank Balances table
CREATE TABLE IF NOT EXISTS bank_balances (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  anno INTEGER NOT NULL UNIQUE,
  saldo_iniziale DECIMAL(10, 2) DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reconciliation Sessions table
CREATE TABLE IF NOT EXISTS reconciliation_sessions (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  upload_date TEXT,
  periodo TEXT,
  periodo_dal TEXT,
  periodo_al TEXT,
  numero_conto TEXT,
  saldo_iniziale DECIMAL(10, 2) DEFAULT 0,
  saldo_finale DECIMAL(10, 2) DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  matched_count INTEGER DEFAULT 0,
  pending_count INTEGER DEFAULT 0,
  ignored_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  closed_date TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bank Transactions table
CREATE TABLE IF NOT EXISTS bank_transactions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  data TEXT,
  data_valuta TEXT,
  causale TEXT,
  descrizione TEXT,
  importo DECIMAL(10, 2) DEFAULT 0,
  tipo TEXT,
  saldo DECIMAL(10, 2),
  match_status TEXT DEFAULT 'pending',
  matched_invoice_id TEXT,
  matched_cashflow_id TEXT,
  match_confidence DECIMAL(5, 2),
  match_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (session_id) REFERENCES reconciliation_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (matched_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (matched_cashflow_id) REFERENCES cashflow_records(id) ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_invoices_anno ON invoices(anno);
CREATE INDEX IF NOT EXISTS idx_invoices_tipo ON invoices(tipo);
CREATE INDEX IF NOT EXISTS idx_cashflow_invoice_id ON cashflow_records(invoice_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_data_pagamento ON cashflow_records(data_pagamento);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_session_id ON bank_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_match_status ON bank_transactions(match_status);
