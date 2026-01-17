-- Add data_scadenza column to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS data_scadenza DATE;

-- Create invoice_notifications table
CREATE TABLE IF NOT EXISTS invoice_notifications (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('da_pagare', 'scaduta')),
    data_scadenza DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    dismissed BOOLEAN DEFAULT FALSE
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_invoice_notifications_dismissed ON invoice_notifications(dismissed);
CREATE INDEX IF NOT EXISTS idx_invoice_notifications_invoice_id ON invoice_notifications(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_data_scadenza ON invoices(data_scadenza);

-- Add RLS policies for invoice_notifications
ALTER TABLE invoice_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users" ON invoice_notifications
    FOR ALL
    USING (true)
    WITH CHECK (true);
