import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { Customer, Deal, Invoice, Transaction, FinancialItem, DealStage, CashflowRecord, BankBalance, BankTransaction, ReconciliationSession, AppSettings, InvoiceNotification } from '../types';
import {
  MOCK_CUSTOMERS,
  MOCK_DEALS,
  MOCK_INVOICES,
  MOCK_TRANSACTIONS,
  MOCK_FINANCIAL_ITEMS
} from '../constants';

// Helper functions for snake_case <-> camelCase conversion
const snakeToCamel = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(snakeToCamel);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      acc[camelKey] = snakeToCamel(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
};

const camelToSnake = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(camelToSnake);
  }
  // Handle Date objects - convert to ISO string for PostgreSQL
  if (obj instanceof Date) {
    return obj.toISOString().split('T')[0]; // YYYY-MM-DD format
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      acc[snakeKey] = camelToSnake(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
};

export interface AIProcessingState {
  isProcessing: boolean;
  sessionId: string | null;
  current: number;
  total: number;
  shouldStop: boolean;
}

interface DataContextType {
  // Data
  customers: Customer[];
  deals: Deal[];
  invoices: Invoice[];
  transactions: Transaction[];
  financialItems: FinancialItem[];
  cashflowRecords: CashflowRecord[];
  bankBalances: BankBalance[];
  reconciliationSessions: ReconciliationSession[];
  bankTransactions: BankTransaction[];
  settings: AppSettings | null;
  invoiceNotifications: InvoiceNotification[];

  // Loading states
  loading: boolean;
  error: string | null;
  isSupabaseConfigured: boolean;

  // AI Processing state (global, persists across page changes)
  aiProcessing: AIProcessingState;
  setAiProcessing: (state: Partial<AIProcessingState>) => void;
  stopAiProcessing: () => void;

  // Customer CRUD
  addCustomer: (customer: Omit<Customer, 'id'>) => Promise<Customer | null>;
  updateCustomer: (id: string, customer: Partial<Customer>) => Promise<boolean>;
  deleteCustomer: (id: string) => Promise<boolean>;

  // Deal CRUD
  addDeal: (deal: Omit<Deal, 'id'>) => Promise<Deal | null>;
  updateDeal: (id: string, deal: Partial<Deal>) => Promise<boolean>;
  deleteDeal: (id: string) => Promise<boolean>;

  // Invoice CRUD
  addInvoice: (invoice: Omit<Invoice, 'id'>) => Promise<Invoice | null>;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => Promise<boolean>;
  deleteInvoice: (id: string) => Promise<boolean>;

  // Transaction CRUD
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<Transaction | null>;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<boolean>;

  // Financial Item CRUD
  addFinancialItem: (item: Omit<FinancialItem, 'id'>) => Promise<FinancialItem | null>;
  updateFinancialItem: (id: string, item: Partial<FinancialItem>) => Promise<boolean>;
  deleteFinancialItem: (id: string) => Promise<boolean>;

  // Cashflow CRUD
  addCashflowRecord: (record: Omit<CashflowRecord, 'id'>) => Promise<CashflowRecord | null>;
  updateCashflowRecord: (id: string, record: Partial<CashflowRecord>) => Promise<boolean>;
  deleteCashflowRecord: (id: string) => Promise<boolean>;

  // Bank Balance CRUD
  setBankBalance: (anno: number, saldoIniziale: number, note?: string) => Promise<BankBalance | null>;
  getBankBalance: (anno: number) => BankBalance | undefined;

  // Reconciliation Session CRUD
  addReconciliationSession: (session: ReconciliationSession) => Promise<ReconciliationSession | null>;
  updateReconciliationSession: (id: string, session: Partial<ReconciliationSession>) => Promise<boolean>;
  deleteReconciliationSession: (id: string) => Promise<boolean>;
  clearAllReconciliationSessions: () => Promise<boolean>;

  // Bank Transaction CRUD
  addBankTransaction: (transaction: BankTransaction) => Promise<BankTransaction | null>;
  updateBankTransaction: (id: string, transaction: Partial<BankTransaction>) => Promise<boolean>;
  deleteBankTransaction: (id: string) => Promise<boolean>;

  // Settings
  getSettings: () => Promise<AppSettings | null>;
  updateSettings: (settings: Partial<Omit<AppSettings, 'id'>>) => Promise<boolean>;

  // User Management
  getCompanyUsers: () => Promise<any[]>;
  createUser: (userData: { email: string; name: string; password: string; role: string }) => Promise<{ error: Error | null }>;
  updateUser: (userId: string, updates: { full_name?: string; role?: string; is_active?: boolean }) => Promise<{ error: Error | null }>;
  deleteUser: (userId: string) => Promise<void>;

  // Invoice Notifications
  checkInvoiceDueDates: () => Promise<void>; // Controlla scadenze e genera notifiche
  dismissNotification: (id: string) => Promise<boolean>; // Cancella una notifica

  // Refresh
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { companyId, user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [financialItems, setFinancialItems] = useState<FinancialItem[]>([]);
  const [cashflowRecords, setCashflowRecords] = useState<CashflowRecord[]>([]);
  const [bankBalances, setBankBalances] = useState<BankBalance[]>([]);
  const [reconciliationSessions, setReconciliationSessions] = useState<ReconciliationSession[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [invoiceNotifications, setInvoiceNotifications] = useState<InvoiceNotification[]>([]);

  // AI Processing state - persists across component unmounts
  const [aiProcessing, setAiProcessingState] = useState<AIProcessingState>({
    isProcessing: false,
    sessionId: null,
    current: 0,
    total: 0,
    shouldStop: false
  });

  const setAiProcessing = useCallback((state: Partial<AIProcessingState>) => {
    setAiProcessingState(prev => ({ ...prev, ...state }));
  }, []);

  const stopAiProcessing = useCallback(() => {
    setAiProcessingState(prev => ({ ...prev, shouldStop: true }));
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSupabaseConfigured = Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      // Use mock data
      setCustomers(MOCK_CUSTOMERS);
      setDeals(MOCK_DEALS);
      setInvoices(MOCK_INVOICES);
      setTransactions(MOCK_TRANSACTIONS);
      setFinancialItems(MOCK_FINANCIAL_ITEMS);
      setCashflowRecords([]);
      setBankBalances([]);
      setReconciliationSessions([]);
      setBankTransactions([]);
      setLoading(false);
      return;
    }

    // Wait for companyId to be available
    if (!companyId) {
      console.log('[DataContext] Waiting for companyId...');
      setLoading(false);
      return;
    }

    try {
      console.log('[DataContext] Fetching data for company:', companyId);

      const [customersRes, dealsRes, invoicesRes, transactionsRes, financialItemsRes, cashflowRes, bankBalancesRes, reconciliationSessionsRes, bankTransactionsRes, settingsRes, notificationsRes] = await Promise.all([
        supabase.from('customers').select('*').eq('company_id', companyId),
        supabase.from('deals').select('*').eq('company_id', companyId),
        supabase.from('invoices').select('*').eq('company_id', companyId),
        supabase.from('transactions').select('*').eq('company_id', companyId),
        supabase.from('financial_items').select('*').eq('company_id', companyId),
        supabase.from('cashflow_records').select('*').eq('company_id', companyId),
        supabase.from('bank_balances').select('*').eq('company_id', companyId),
        supabase.from('reconciliation_sessions').select('*').eq('company_id', companyId),
        supabase.from('bank_transactions').select('*').eq('company_id', companyId),
        supabase.from('settings').select('*').eq('company_id', companyId).single(),
        supabase.from('invoice_notifications').select('*').eq('dismissed', false),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (transactionsRes.error) throw transactionsRes.error;
      if (financialItemsRes.error) throw financialItemsRes.error;
      // Cashflow, bank_balances, and settings tables may not exist yet, so we don't throw on error

      setCustomers(snakeToCamel(customersRes.data || []));
      setDeals(snakeToCamel(dealsRes.data || []));
      setInvoices(snakeToCamel(invoicesRes.data || []));
      setTransactions(snakeToCamel(transactionsRes.data || []));
      setFinancialItems(snakeToCamel(financialItemsRes.data || []));
      setCashflowRecords(snakeToCamel(cashflowRes.data || []));
      setBankBalances(snakeToCamel(bankBalancesRes.data || []));
      setReconciliationSessions(snakeToCamel(reconciliationSessionsRes.data || []));
      setBankTransactions(snakeToCamel(bankTransactionsRes.data || []));
      setInvoiceNotifications(snakeToCamel(notificationsRes.data || []));

      // Settings - single row, may not exist yet
      if (settingsRes.data) {
        setSettings(snakeToCamel(settingsRes.data));
      } else {
        // Initialize with defaults if doesn't exist
        setSettings({
          id: 'default',
          defaultAiProvider: 'anthropic',
          anthropicApiKey: '',
          openaiApiKey: '',
          notificationRefreshInterval: 5
        });
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Error fetching data');
      // Fallback to mock data on error
      setCustomers(MOCK_CUSTOMERS);
      setDeals(MOCK_DEALS);
      setInvoices(MOCK_INVOICES);
      setTransactions(MOCK_TRANSACTIONS);
      setFinancialItems(MOCK_FINANCIAL_ITEMS);
      setCashflowRecords([]);
      setBankBalances([]);
      setReconciliationSessions([]);
      setBankTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [isSupabaseConfigured, companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Periodic check for invoice due dates
  useEffect(() => {
    if (!isSupabaseConfigured || invoices.length === 0 || !settings) return;

    // Get refresh interval from settings (default 5 minutes)
    const refreshMinutes = settings.notificationRefreshInterval || 5;
    const refreshMs = refreshMinutes * 60 * 1000;

    console.log(`[Notifications] Setting up periodic check every ${refreshMinutes} minute(s)`);

    // Initial check after 1 second
    const initialTimer = setTimeout(() => {
      checkInvoiceDueDates();
    }, 1000);

    // Set up interval for periodic checks
    const interval = setInterval(() => {
      console.log(`[Notifications] Periodic check for invoice due dates (every ${refreshMinutes} min)...`);
      checkInvoiceDueDates();
    }, refreshMs);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupabaseConfigured, invoices.length, settings?.notificationRefreshInterval]);

  // Customer CRUD
  const addCustomer = async (customer: Omit<Customer, 'id'>): Promise<Customer | null> => {
    if (!isSupabaseConfigured) {
      const newCustomer = { ...customer, id: `C-${Date.now()}` } as Customer;
      setCustomers(prev => [...prev, newCustomer]);
      return newCustomer;
    }

    if (!companyId) {
      console.error('No company ID available');
      return null;
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({ ...camelToSnake(customer), company_id: companyId })
      .select()
      .single();

    if (error) {
      console.error('Error adding customer:', error);
      return null;
    }

    const newCustomer = snakeToCamel(data) as Customer;
    setCustomers(prev => [...prev, newCustomer]);
    return newCustomer;
  };

  const updateCustomer = async (id: string, customer: Partial<Customer>): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...customer } : c));
      return true;
    }

    const { error } = await supabase
      .from('customers')
      .update(camelToSnake(customer))
      .eq('id', id);

    if (error) {
      console.error('Error updating customer:', error);
      return false;
    }

    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...customer } : c));
    return true;
  };

  const deleteCustomer = async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setCustomers(prev => prev.filter(c => c.id !== id));
      return true;
    }

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting customer:', error);
      return false;
    }

    setCustomers(prev => prev.filter(c => c.id !== id));
    return true;
  };

  // Deal CRUD
  const addDeal = async (deal: Omit<Deal, 'id'>): Promise<Deal | null> => {
    if (!isSupabaseConfigured) {
      const newDeal = { ...deal, id: `D-${Date.now()}` } as Deal;
      setDeals(prev => [...prev, newDeal]);
      return newDeal;
    }

    const dealWithCompany = {
      ...deal,
      companyId: '00000000-0000-0000-0000-000000000001' // Ncode Studio
    };

    const { data, error } = await supabase
      .from('deals')
      .insert(camelToSnake(dealWithCompany))
      .select()
      .single();

    if (error) {
      console.error('Error adding deal:', error);
      return null;
    }

    const newDeal = snakeToCamel(data) as Deal;
    setDeals(prev => [...prev, newDeal]);
    return newDeal;
  };

  const updateDeal = async (id: string, deal: Partial<Deal>): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setDeals(prev => prev.map(d => d.id === id ? { ...d, ...deal } : d));
      return true;
    }

    const { error } = await supabase
      .from('deals')
      .update(camelToSnake(deal))
      .eq('id', id);

    if (error) {
      console.error('Error updating deal:', error);
      return false;
    }

    setDeals(prev => prev.map(d => d.id === id ? { ...d, ...deal } : d));
    return true;
  };

  const deleteDeal = async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setDeals(prev => prev.filter(d => d.id !== id));
      return true;
    }

    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting deal:', error);
      return false;
    }

    setDeals(prev => prev.filter(d => d.id !== id));
    return true;
  };

  // Invoice CRUD
  const addInvoice = async (invoice: Omit<Invoice, 'id'>): Promise<Invoice | null> => {
    // Generate invoice ID: Fattura_XXX where XXX is sequential number
    const maxNum = invoices.reduce((max, inv) => {
      const match = inv.id.match(/Fattura_(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);
    const newId = `Fattura_${String(maxNum + 1).padStart(3, '0')}`;
    const invoiceWithId = {
      ...invoice,
      id: newId,
      companyId: '00000000-0000-0000-0000-000000000001' // Ncode Studio
    };

    console.log('Adding invoice:', invoiceWithId);

    if (!isSupabaseConfigured) {
      const newInvoice = invoiceWithId as Invoice;
      setInvoices(prev => [...prev, newInvoice]);
      return newInvoice;
    }

    const dataToInsert = camelToSnake(invoiceWithId);
    console.log('Data to insert:', dataToInsert);

    const { data, error } = await supabase
      .from('invoices')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('Error adding invoice:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return null;
    }

    console.log('Invoice created:', data);
    const newInvoice = snakeToCamel(data) as Invoice;
    setInvoices(prev => [...prev, newInvoice]);

    // Check if the new invoice has a due date and create notification if needed
    if (newInvoice.dataScadenza) {
      setTimeout(() => checkInvoiceDueDates(), 100);
    }

    return newInvoice;
  };

  const updateInvoice = async (id: string, invoice: Partial<Invoice>): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...invoice } : i));
      return true;
    }

    const { error } = await supabase
      .from('invoices')
      .update(camelToSnake(invoice))
      .eq('id', id);

    if (error) {
      console.error('Error updating invoice:', error);
      return false;
    }

    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...invoice } : i));

    // If due date was updated, check notification for this specific invoice
    if (invoice.dataScadenza !== undefined) {
      console.log(`[updateInvoice] Due date changed for invoice ${id}, checking notification immediately`);

      // Get the updated invoice data
      const fullInvoice = invoices.find(inv => inv.id === id);
      if (fullInvoice) {
        const updatedInvoice = { ...fullInvoice, ...invoice };

        // Check if this invoice should have a notification
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(invoice.dataScadenza);
        dueDate.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        const dueDateStr = dueDate.toISOString().split('T')[0];

        // Check if invoice is in stato 'Effettivo' with unpaid cashflow
        const isEligibleForNotification = updatedInvoice.statoFatturazione === 'Effettivo' &&
                                         cashflowRecords.some(cf =>
                                           cf.invoiceId === id &&
                                           cf.statoFatturazione !== 'Effettivo'
                                         );

        let tipo: 'da_pagare' | 'scaduta' | null = null;

        if (isEligibleForNotification) {
          if (dueDateStr === todayStr) {
            tipo = 'da_pagare';
          } else if (dueDate < today) {
            tipo = 'scaduta';
          }
        }

        // Check if notification exists
        const { data: existing } = await supabase
          .from('invoice_notifications')
          .select('*')
          .eq('invoice_id', id)
          .eq('dismissed', false)
          .maybeSingle();

        if (tipo) {
          // Should have a notification
          if (existing) {
            // Update if needed
            const existingNotif = snakeToCamel(existing) as InvoiceNotification;
            if (existingNotif.tipo !== tipo) {
              const { error: updateError } = await supabase
                .from('invoice_notifications')
                .update({ tipo, data_scadenza: invoice.dataScadenza })
                .eq('id', existingNotif.id);

              if (!updateError) {
                setInvoiceNotifications(prev =>
                  prev.map(n => n.id === existingNotif.id ? { ...n, tipo, dataScadenza: invoice.dataScadenza } : n)
                );
                console.log(`[updateInvoice] Updated notification to '${tipo}'`);
              }
            }
          } else {
            // Create new notification
            const { data, error } = await supabase
              .from('invoice_notifications')
              .insert({
                id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                invoice_id: id,
                tipo,
                data_scadenza: invoice.dataScadenza,
                dismissed: false
              })
              .select()
              .single();

            if (!error && data) {
              setInvoiceNotifications(prev => [...prev, snakeToCamel(data)]);
              console.log(`[updateInvoice] Created notification '${tipo}'`);
            }
          }
        } else {
          // Should NOT have a notification - dismiss if exists
          if (existing) {
            console.log(`[updateInvoice] Dismissing notification - due date is in the future or not eligible`);
            const { error: dismissError } = await supabase
              .from('invoice_notifications')
              .update({ dismissed: true })
              .eq('id', existing.id);

            if (!dismissError) {
              setInvoiceNotifications(prev => prev.filter(n => n.id !== existing.id));
              console.log(`[updateInvoice] Notification dismissed`);
            }
          }
        }
      }
    }

    return true;
  };

  const deleteInvoice = async (id: string): Promise<boolean> => {
    // Check if there are cashflow records associated with this invoice
    const associatedCashflows = cashflowRecords.filter(cf => cf.invoiceId === id);

    if (associatedCashflows.length > 0) {
      console.error('Cannot delete invoice with associated cashflow records');
      const movimentiDettagli = associatedCashflows.map(cf =>
        `- ID: ${cf.id}, Data Pagamento: ${cf.dataPagamento || 'N/D'}, Note: ${cf.note || 'Nessuna nota'}`
      ).join('\n');
      alert(`Non puoi eliminare questa fattura perché ha ${associatedCashflows.length} movimento/i di cassa associato/i:\n\n${movimentiDettagli}\n\nVai in Flusso di Cassa e elimina prima questi movimenti. Potrebbero essere nascosti dai filtri (controlla Anno/Mese/Tipo/Stato).`);
      return false;
    }

    if (!isSupabaseConfigured) {
      setInvoices(prev => prev.filter(i => i.id !== id));
      return true;
    }

    // Delete the invoice
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting invoice:', error);
      return false;
    }

    // Update local state
    setInvoices(prev => prev.filter(i => i.id !== id));
    return true;
  };

  // Transaction CRUD
  const addTransaction = async (transaction: Omit<Transaction, 'id'>): Promise<Transaction | null> => {
    if (!isSupabaseConfigured) {
      const newTransaction = { ...transaction, id: `TRX-${Date.now()}` } as Transaction;
      setTransactions(prev => [...prev, newTransaction]);
      return newTransaction;
    }

    if (!companyId) {
      console.error('No company ID available');
      return null;
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...camelToSnake(transaction), company_id: companyId })
      .select()
      .single();

    if (error) {
      console.error('Error adding transaction:', error);
      return null;
    }

    const newTransaction = snakeToCamel(data) as Transaction;
    setTransactions(prev => [...prev, newTransaction]);
    return newTransaction;
  };

  const updateTransaction = async (id: string, transaction: Partial<Transaction>): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...transaction } : t));
      return true;
    }

    const { error } = await supabase
      .from('transactions')
      .update(camelToSnake(transaction))
      .eq('id', id);

    if (error) {
      console.error('Error updating transaction:', error);
      return false;
    }

    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...transaction } : t));
    return true;
  };

  const deleteTransaction = async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setTransactions(prev => prev.filter(t => t.id !== id));
      return true;
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting transaction:', error);
      return false;
    }

    setTransactions(prev => prev.filter(t => t.id !== id));
    return true;
  };

  // Financial Item CRUD
  const addFinancialItem = async (item: Omit<FinancialItem, 'id'>): Promise<FinancialItem | null> => {
    // Generate ID for financial item
    const newId = `FI-${Date.now()}`;
    const itemWithId = { ...item, id: newId };

    if (!isSupabaseConfigured) {
      const newItem = itemWithId as FinancialItem;
      setFinancialItems(prev => [...prev, newItem]);
      return newItem;
    }

    if (!companyId) {
      console.error('No company ID available');
      return null;
    }

    const { data, error } = await supabase
      .from('financial_items')
      .insert({ ...camelToSnake(itemWithId), company_id: companyId })
      .select()
      .single();

    if (error) {
      console.error('Error adding financial item:', error);
      return null;
    }

    const newItem = snakeToCamel(data) as FinancialItem;
    setFinancialItems(prev => [...prev, newItem]);
    return newItem;
  };

  const updateFinancialItem = async (id: string, item: Partial<FinancialItem>): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setFinancialItems(prev => prev.map(fi => fi.id === id ? { ...fi, ...item } : fi));
      return true;
    }

    const { error } = await supabase
      .from('financial_items')
      .update(camelToSnake(item))
      .eq('id', id);

    if (error) {
      console.error('Error updating financial item:', error);
      return false;
    }

    setFinancialItems(prev => prev.map(fi => fi.id === id ? { ...fi, ...item } : fi));
    return true;
  };

  const deleteFinancialItem = async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setFinancialItems(prev => prev.filter(fi => fi.id !== id));
      return true;
    }

    const { error } = await supabase
      .from('financial_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting financial item:', error);
      return false;
    }

    setFinancialItems(prev => prev.filter(fi => fi.id !== id));
    return true;
  };

  // Cashflow Record CRUD
  const addCashflowRecord = async (record: Omit<CashflowRecord, 'id'>): Promise<CashflowRecord | null> => {
    if (!isSupabaseConfigured) {
      const newRecord = { ...record, id: `CF-${Date.now()}` } as CashflowRecord;
      setCashflowRecords(prev => [...prev, newRecord]);
      return newRecord;
    }

    const recordWithCompany = {
      ...record,
      companyId: '00000000-0000-0000-0000-000000000001' // Ncode Studio
    };
    const dataToInsert = camelToSnake(recordWithCompany);
    console.log('🔵 Inserting cashflow record into Supabase:', dataToInsert);

    const { data, error } = await supabase
      .from('cashflow_records')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding cashflow record:', error);
      console.error('   Error code:', error.code);
      console.error('   Error message:', error.message);
      console.error('   Error details:', error.details);
      console.error('   Data attempted:', dataToInsert);
      return null;
    }

    console.log('✅ Cashflow record inserted successfully:', data);
    const newRecord = snakeToCamel(data) as CashflowRecord;
    setCashflowRecords(prev => [...prev, newRecord]);
    return newRecord;
  };

  const updateCashflowRecord = async (id: string, record: Partial<CashflowRecord>): Promise<boolean> => {
    // Find the current cashflow record
    const currentCashflow = cashflowRecords.find(cf => cf.id === id);

    if (!isSupabaseConfigured) {
      setCashflowRecords(prev => prev.map(cf => cf.id === id ? { ...cf, ...record } : cf));
      return true;
    }

    const dataToUpdate = camelToSnake(record);
    console.log('🔵 [updateCashflowRecord] Updating cashflow record:', id);
    console.log('   Original data:', record);
    console.log('   Converted to snake_case:', dataToUpdate);

    const { error } = await supabase
      .from('cashflow_records')
      .update(dataToUpdate)
      .eq('id', id);

    if (error) {
      console.error('❌ Error updating cashflow record:', error);
      return false;
    }

    console.log('✅ [updateCashflowRecord] Cashflow record updated successfully');
    setCashflowRecords(prev => prev.map(cf => cf.id === id ? { ...cf, ...record } : cf));

    // If stato changed to Effettivo and cashflow has an invoice, reload the invoice
    // because the trigger will have updated it
    if (record.statoFatturazione === 'Effettivo' && currentCashflow?.invoiceId) {
      console.log('🔄 [updateCashflowRecord] Reloading invoice after cashflow became Effettivo');
      const { data: updatedInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', currentCashflow.invoiceId)
        .single();

      if (!invoiceError && updatedInvoice) {
        const invoice = snakeToCamel(updatedInvoice) as Invoice;
        setInvoices(prev => prev.map(inv => inv.id === currentCashflow.invoiceId ? invoice : inv));
        console.log('✅ [updateCashflowRecord] Invoice reloaded, new stato:', invoice.statoFatturazione);
      }
    }

    // If stato changed and cashflow has an invoiceId, re-check notifications
    console.log('🔍 [updateCashflowRecord] Checking notification conditions:');
    console.log('   record.statoFatturazione:', record.statoFatturazione);
    console.log('   currentCashflow?.invoiceId:', currentCashflow?.invoiceId);
    console.log('   currentCashflow?.statoFatturazione:', currentCashflow?.statoFatturazione);

    if (record.statoFatturazione !== undefined && currentCashflow?.invoiceId) {
      const statoChanged = currentCashflow.statoFatturazione !== record.statoFatturazione;
      console.log('   Stato changed?', statoChanged);

      if (statoChanged) {
        console.log(`📢 [Cashflow] Stato changed from '${currentCashflow.statoFatturazione}' to '${record.statoFatturazione}' for invoice ${currentCashflow.invoiceId}, checking notifications...`);

        // Check notifications immediately for this specific invoice
        const invoice = invoices.find(inv => inv.id === currentCashflow.invoiceId);
        if (invoice && invoice.dataScadenza) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dueDate = new Date(invoice.dataScadenza);
          dueDate.setHours(0, 0, 0, 0);
          const todayStr = today.toISOString().split('T')[0];
          const dueDateStr = dueDate.toISOString().split('T')[0];

          // Check if invoice should have a notification
          const updatedCashflow = { ...currentCashflow, ...record };
          const isEligibleForNotification = invoice.statoFatturazione === 'Effettivo' &&
                                           updatedCashflow.statoFatturazione !== 'Effettivo';

          console.log('   Invoice:', invoice.id);
          console.log('   Invoice stato:', invoice.statoFatturazione);
          console.log('   Updated cashflow stato:', updatedCashflow.statoFatturazione);
          console.log('   Is eligible for notification?', isEligibleForNotification);
          console.log('   Due date:', dueDateStr, 'Today:', todayStr);

          let tipo: 'da_pagare' | 'scaduta' | null = null;

          if (isEligibleForNotification) {
            if (dueDateStr === todayStr) {
              tipo = 'da_pagare';
            } else if (dueDate < today) {
              tipo = 'scaduta';
            }
          }

          console.log('   Notification tipo:', tipo);

          // Check if notification exists
          const { data: existing } = await supabase
            .from('invoice_notifications')
            .select('*')
            .eq('invoice_id', currentCashflow.invoiceId)
            .eq('dismissed', false)
            .maybeSingle();

          if (tipo) {
            // Should have a notification
            if (existing) {
              // Update if needed
              const existingNotif = snakeToCamel(existing) as InvoiceNotification;
              if (existingNotif.tipo !== tipo) {
                await supabase
                  .from('invoice_notifications')
                  .update({ tipo })
                  .eq('id', existingNotif.id);

                setInvoiceNotifications(prev =>
                  prev.map(n => n.id === existingNotif.id ? { ...n, tipo } : n)
                );
                console.log(`[Cashflow] Updated notification to '${tipo}'`);
              }
            } else {
              // Create new notification
              const { data, error } = await supabase
                .from('invoice_notifications')
                .insert({
                  id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  invoice_id: currentCashflow.invoiceId,
                  tipo,
                  data_scadenza: invoice.dataScadenza,
                  dismissed: false
                })
                .select()
                .single();

              if (!error && data) {
                setInvoiceNotifications(prev => [...prev, snakeToCamel(data)]);
                console.log(`[Cashflow] Created notification '${tipo}'`);
              }
            }
          } else {
            // Should NOT have a notification - dismiss if exists
            if (existing) {
              console.log(`✅ [Cashflow] Dismissing notification - cashflow is paid or not eligible`);
              await supabase
                .from('invoice_notifications')
                .update({ dismissed: true })
                .eq('id', existing.id);

              setInvoiceNotifications(prev => prev.filter(n => n.id !== existing.id));
              console.log(`✅ [Cashflow] Notification dismissed successfully`);
            } else {
              console.log(`ℹ️  [Cashflow] No notification to dismiss (cashflow is paid/not eligible and no notification exists)`);
            }
          }
        } else {
          console.log(`⚠️  [Cashflow] Invoice ${currentCashflow.invoiceId} has no due date, skipping notification check`);
        }
      } else {
        console.log(`ℹ️  [Cashflow] Stato not changed, skipping notification check`);
      }
    } else {
      console.log(`ℹ️  [Cashflow] Skipping notification check - statoFatturazione is undefined or no invoiceId`);
    }

    return true;
  };

  const deleteCashflowRecord = async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setCashflowRecords(prev => prev.filter(cf => cf.id !== id));
      return true;
    }

    const { error } = await supabase
      .from('cashflow_records')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting cashflow record:', error);
      return false;
    }

    setCashflowRecords(prev => prev.filter(cf => cf.id !== id));
    return true;
  };

  // Bank Balance functions
  const setBankBalance = async (anno: number, saldoIniziale: number, note?: string): Promise<BankBalance | null> => {
    const existingBalance = bankBalances.find(b => b.anno === anno);

    if (!isSupabaseConfigured) {
      if (existingBalance) {
        const updated = { ...existingBalance, saldoIniziale, note };
        setBankBalances(prev => prev.map(b => b.anno === anno ? updated : b));
        return updated;
      } else {
        const newBalance: BankBalance = { id: `BB-${Date.now()}`, anno, saldoIniziale, note };
        setBankBalances(prev => [...prev, newBalance]);
        return newBalance;
      }
    }

    if (!companyId) {
      console.error('No company ID available');
      return null;
    }

    if (existingBalance) {
      // Update existing
      const { data, error } = await supabase
        .from('bank_balances')
        .update(camelToSnake({ saldoIniziale, note }))
        .eq('anno', anno)
        .eq('company_id', companyId)
        .select()
        .single();

      if (error) {
        console.error('Error updating bank balance:', error);
        return null;
      }

      const updated = snakeToCamel(data) as BankBalance;
      setBankBalances(prev => prev.map(b => b.anno === anno ? updated : b));
      return updated;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('bank_balances')
        .insert({ ...camelToSnake({ anno, saldoIniziale, note }), company_id: companyId })
        .select()
        .single();

      if (error) {
        console.error('Error adding bank balance:', error);
        return null;
      }

      const newBalance = snakeToCamel(data) as BankBalance;
      setBankBalances(prev => [...prev, newBalance]);
      return newBalance;
    }
  };

  const getBankBalance = (anno: number): BankBalance | undefined => {
    return bankBalances.find(b => b.anno === anno);
  };

  // Reconciliation Session CRUD
  const addReconciliationSession = async (session: ReconciliationSession): Promise<ReconciliationSession | null> => {
    if (!isSupabaseConfigured) {
      setReconciliationSessions(prev => [...prev, session]);
      return session;
    }

    const { data, error } = await supabase
      .from('reconciliation_sessions')
      .insert(camelToSnake(session))
      .select()
      .single();

    if (error) {
      console.error('Error adding reconciliation session:', error);
      return null;
    }

    const newSession = snakeToCamel(data) as ReconciliationSession;
    setReconciliationSessions(prev => [...prev, newSession]);
    return newSession;
  };

  const updateReconciliationSession = async (id: string, session: Partial<ReconciliationSession>): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setReconciliationSessions(prev => prev.map(s => s.id === id ? { ...s, ...session } : s));
      return true;
    }

    const { error } = await supabase
      .from('reconciliation_sessions')
      .update(camelToSnake(session))
      .eq('id', id);

    if (error) {
      console.error('Error updating reconciliation session:', error);
      return false;
    }

    setReconciliationSessions(prev => prev.map(s => s.id === id ? { ...s, ...session } : s));
    return true;
  };

  const deleteReconciliationSession = async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setReconciliationSessions(prev => prev.filter(s => s.id !== id));
      setBankTransactions(prev => prev.filter(t => t.sessionId !== id));
      return true;
    }

    const { error } = await supabase
      .from('reconciliation_sessions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting reconciliation session:', error);
      return false;
    }

    setReconciliationSessions(prev => prev.filter(s => s.id !== id));
    setBankTransactions(prev => prev.filter(t => t.sessionId !== id));
    return true;
  };

  const clearAllReconciliationSessions = async (): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setReconciliationSessions([]);
      setBankTransactions([]);
      return true;
    }

    // Delete all reconciliation sessions
    const { error: sessionsError } = await supabase
      .from('reconciliation_sessions')
      .delete()
      .neq('id', ''); // Delete all rows

    if (sessionsError) {
      console.error('Error clearing reconciliation sessions:', sessionsError);
      return false;
    }

    // Delete all bank transactions
    const { error: transactionsError } = await supabase
      .from('bank_transactions')
      .delete()
      .neq('id', ''); // Delete all rows

    if (transactionsError) {
      console.error('Error clearing bank transactions:', transactionsError);
      return false;
    }

    setReconciliationSessions([]);
    setBankTransactions([]);
    return true;
  };

  // Bank Transaction CRUD
  const addBankTransaction = async (transaction: BankTransaction): Promise<BankTransaction | null> => {
    if (!isSupabaseConfigured) {
      setBankTransactions(prev => [...prev, transaction]);
      return transaction;
    }

    const { data, error } = await supabase
      .from('bank_transactions')
      .insert(camelToSnake(transaction))
      .select()
      .single();

    if (error) {
      console.error('Error adding bank transaction:', error);
      return null;
    }

    const newTransaction = snakeToCamel(data) as BankTransaction;
    setBankTransactions(prev => [...prev, newTransaction]);
    return newTransaction;
  };

  const updateBankTransaction = async (id: string, transaction: Partial<BankTransaction>): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setBankTransactions(prev => prev.map(t => t.id === id ? { ...t, ...transaction } : t));
      return true;
    }

    const { error } = await supabase
      .from('bank_transactions')
      .update(camelToSnake(transaction))
      .eq('id', id);

    if (error) {
      console.error('Error updating bank transaction:', error);
      return false;
    }

    setBankTransactions(prev => prev.map(t => t.id === id ? { ...t, ...transaction } : t));
    return true;
  };

  const deleteBankTransaction = async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setBankTransactions(prev => prev.filter(t => t.id !== id));
      return true;
    }

    const { error } = await supabase
      .from('bank_transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting bank transaction:', error);
      return false;
    }

    setBankTransactions(prev => prev.filter(t => t.id !== id));
    return true;
  };

  // Settings functions
  const getSettings = async (): Promise<AppSettings | null> => {
    console.log('[getSettings] Called - isSupabaseConfigured:', isSupabaseConfigured, 'companyId:', companyId);

    if (!isSupabaseConfigured) {
      // Return from state if Supabase not configured
      console.log('[getSettings] Supabase not configured, returning state:', settings);
      return settings;
    }

    if (!companyId) {
      console.error('[getSettings] No company ID available for settings');
      return null;
    }

    try {
      console.log('[getSettings] Querying settings for company:', companyId);
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'default')
        .eq('company_id', companyId)
        .single();

      if (error) {
        console.error('[getSettings] Error fetching settings:', error);
        // Return default settings if none exist yet
        return {
          id: 'default',
          defaultAiProvider: 'anthropic',
          anthropicApiKey: '',
          openaiApiKey: '',
          notificationRefreshInterval: 5
        };
      }

      console.log('[getSettings] Settings fetched successfully:', {
        hasAnthropicKey: !!data.anthropic_api_key,
        hasOpenaiKey: !!data.openai_api_key,
        anthropicKeyLength: data.anthropic_api_key?.length,
        openaiKeyLength: data.openai_api_key?.length
      });

      const convertedSettings = snakeToCamel(data);
      setSettings(convertedSettings);
      return convertedSettings;
    } catch (err) {
      console.error('[getSettings] Error in getSettings:', err);
      return null;
    }
  };

  const updateSettings = async (newSettings: Partial<Omit<AppSettings, 'id'>>): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      // Update local state if Supabase not configured
      setSettings(prev => prev ? { ...prev, ...newSettings } : null);
      return true;
    }

    if (!companyId) {
      console.error('No company ID available for updating settings');
      return false;
    }

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          id: 'default',
          company_id: companyId,
          ...camelToSnake(newSettings),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error updating settings:', error);
        return false;
      }

      // Update local state
      setSettings(prev => prev ? { ...prev, ...newSettings } : null);
      return true;
    } catch (err) {
      console.error('Error in updateSettings:', err);
      return false;
    }
  };

  // User Management Functions
  const getCompanyUsers = async (): Promise<any[]> => {
    if (!companyId) {
      console.error('No company ID available');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('company_users')
        .select(`
          user_id,
          role,
          is_active,
          created_at,
          users:user_id (
            id,
            email,
            full_name
          )
        `)
        .eq('company_id', companyId);

      if (error) {
        console.error('Error fetching company users:', error);
        return [];
      }

      // Transform the data to a flatter structure
      const transformedUsers = (data || []).map((cu: any) => ({
        id: cu.user_id,
        email: cu.users.email,
        name: cu.users.full_name,
        role: cu.role,
        is_active: cu.is_active,
        created_at: cu.created_at,
      }));

      return transformedUsers;
    } catch (err) {
      console.error('Error in getCompanyUsers:', err);
      return [];
    }
  };

  const createUser = async (userData: {
    email: string;
    name: string;
    password: string;
    role: string;
  }): Promise<{ error: Error | null }> => {
    if (!companyId) {
      return { error: new Error('No company ID available') };
    }

    if (!user) {
      return { error: new Error('No authenticated user') };
    }

    try {
      console.log('👤 Admin creating new user:', userData.email);

      // PERMISSION CHECK: Verify current user is an admin
      const { data: currentUserRole, error: roleError } = await supabase
        .from('company_users')
        .select('role')
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .single();

      if (roleError || !currentUserRole || currentUserRole.role !== 'admin') {
        console.error('❌ Permission denied: User is not an admin');
        return { error: new Error('Permesso negato: solo gli amministratori possono creare utenti') };
      }

      console.log('✅ Permission check passed: User is admin');

      // CRITICAL: Save current admin session before creating new user
      // This prevents the new user from "taking over" the current session
      const { data: currentSession } = await supabase.auth.getSession();

      if (!currentSession.session) {
        return { error: new Error('Nessuna sessione attiva. Effettua il login e riprova.') };
      }

      const adminSession = currentSession.session;
      console.log('💾 Saved admin session:', adminSession.user.email);

      // 1. Create user in Supabase Auth
      // WARNING: This will AUTO-LOGIN the new user and replace current session!
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
            company_id: companyId,
          },
          emailRedirectTo: undefined,
        },
      });

      if (authError) {
        console.error('❌ Error creating auth user:', authError);
        return { error: new Error('Errore nella creazione dell\'utente: ' + authError.message) };
      }

      if (!authData.user) {
        return { error: new Error('Errore: utente non creato') };
      }

      const userId = authData.user.id;
      console.log('✅ Created auth user:', userId);

      // 2. Create user in users table
      const { error: userError } = await supabase.from('users').insert({
        id: userId,
        email: userData.email,
        full_name: userData.name,
        is_active: true,
      });

      if (userError) {
        console.error('❌ Error creating user record:', userError);
        // Try to restore admin session even on error
        await supabase.auth.setSession(adminSession);
        return { error: new Error('Errore nella creazione del profilo utente: ' + userError.message) };
      }

      console.log('✅ Created user record');

      // 3. Link user to company
      const { error: linkError } = await supabase.from('company_users').insert({
        user_id: userId,
        company_id: companyId,
        role: userData.role,
        is_active: true,
      });

      if (linkError) {
        console.error('❌ Error linking user to company:', linkError);
        // Try to restore admin session even on error
        await supabase.auth.setSession(adminSession);
        return { error: new Error('Errore nel collegamento utente-azienda: ' + linkError.message) };
      }

      console.log('✅ Linked user to company');

      // 4. CRITICAL: Restore admin session
      // The signUp above replaced our session with the new user's session
      // We need to restore the admin's session to prevent "impersonation"
      console.log('🔄 Restoring admin session...');
      const { error: restoreError } = await supabase.auth.setSession(adminSession);

      if (restoreError) {
        console.error('❌ Failed to restore admin session:', restoreError);
        // This is critical - if we can't restore, the admin is now logged in as the new user!
        return { error: new Error('Utente creato ma impossibile ripristinare la sessione admin. Fai logout e login per continuare.') };
      }

      console.log('✅ Admin session restored:', adminSession.user.email);
      console.log('🎉 User created successfully without impersonation!');

      return { error: null };
    } catch (err) {
      console.error('❌ Unexpected error creating user:', err);
      return { error: err as Error };
    }
  };

  const updateUser = async (
    userId: string,
    updates: { full_name?: string; role?: string; is_active?: boolean }
  ): Promise<{ error: Error | null }> => {
    if (!companyId) {
      return { error: new Error('No company ID available') };
    }

    if (!user) {
      return { error: new Error('No authenticated user') };
    }

    try {
      // PERMISSION CHECK: Verify current user is an admin
      const { data: currentUserRole, error: roleError } = await supabase
        .from('company_users')
        .select('role')
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .single();

      if (roleError || !currentUserRole || currentUserRole.role !== 'admin') {
        console.error('❌ Permission denied: User is not an admin');
        return { error: new Error('Permesso negato: solo gli amministratori possono modificare utenti') };
      }
      // Update users table if full_name is provided
      if (updates.full_name) {
        const { error: userError } = await supabase
          .from('users')
          .update({ full_name: updates.full_name })
          .eq('id', userId);

        if (userError) {
          console.error('Error updating user full_name:', userError);
          return { error: new Error('Errore nell\'aggiornamento del nome: ' + userError.message) };
        }
      }

      // Update company_users table for role and is_active
      if (updates.role !== undefined || updates.is_active !== undefined) {
        const updateData: any = {};
        if (updates.role !== undefined) updateData.role = updates.role;
        if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

        const { error: linkError } = await supabase
          .from('company_users')
          .update(updateData)
          .eq('user_id', userId)
          .eq('company_id', companyId);

        if (linkError) {
          console.error('Error updating user role/status:', linkError);
          return { error: new Error('Errore nell\'aggiornamento del ruolo/stato: ' + linkError.message) };
        }
      }

      return { error: null };
    } catch (err) {
      console.error('Unexpected error updating user:', err);
      return { error: err as Error };
    }
  };

  const deleteUser = async (userId: string): Promise<void> => {
    if (!companyId) {
      throw new Error('No company ID available');
    }

    if (!user) {
      throw new Error('No authenticated user');
    }

    try {
      // PERMISSION CHECK: Verify current user is an admin (unless deleting self)
      if (userId !== user.id) {
        const { data: currentUserRole, error: roleError } = await supabase
          .from('company_users')
          .select('role')
          .eq('user_id', user.id)
          .eq('company_id', companyId)
          .eq('is_active', true)
          .single();

        if (roleError || !currentUserRole || currentUserRole.role !== 'admin') {
          console.error('❌ Permission denied: User is not an admin');
          throw new Error('Permesso negato: solo gli amministratori possono eliminare utenti');
        }
      }

      // Check if this is the last admin/user in the company
      const { data: companyUsers, error: checkError } = await supabase
        .from('company_users')
        .select('user_id, role')
        .eq('company_id', companyId)
        .eq('is_active', true);

      if (checkError) {
        console.error('Error checking company users:', checkError);
        throw new Error('Errore nella verifica degli utenti');
      }

      // Check if there's only one user left
      if (companyUsers && companyUsers.length <= 1) {
        throw new Error('Non puoi eliminare l\'ultimo utente dell\'azienda');
      }

      // Check if this is the last admin
      const adminUsers = companyUsers?.filter(cu => cu.role === 'admin') || [];
      const isUserAdmin = adminUsers.some(cu => cu.user_id === userId);

      if (isUserAdmin && adminUsers.length <= 1) {
        throw new Error('Non puoi eliminare l\'ultimo amministratore dell\'azienda');
      }

      // 1. Delete from company_users (this removes the link)
      const { error: linkError } = await supabase
        .from('company_users')
        .delete()
        .eq('user_id', userId)
        .eq('company_id', companyId);

      if (linkError) {
        console.error('Error deleting company_users link:', linkError);
        throw new Error('Errore nell\'eliminazione del collegamento utente-azienda');
      }

      // 2. Delete from users table
      // This will trigger the database trigger to delete from auth.users automatically
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (userError) {
        console.error('Error deleting user record:', userError);
        throw new Error('Errore nell\'eliminazione del profilo utente');
      }

      console.log('✅ User deleted successfully. Database triggers will handle auth cleanup.');

      // If deleting current user, sign out
      if (userId === user?.id) {
        console.log('🚪 Current user deleted, signing out...');
        // Clear local data
        localStorage.clear();
        sessionStorage.clear();
        // Sign out and redirect
        await supabase.auth.signOut();
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Unexpected error deleting user:', err);
      throw err;
    }
  };

  // Check invoice due dates and create notifications
  const checkInvoiceDueDates = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // Get all invoices with due dates
      const invoicesWithDueDate = invoices.filter(inv => inv.dataScadenza);

      for (const invoice of invoicesWithDueDate) {
        // Only check invoices in stato 'Effettivo' (confirmed invoices)
        if (invoice.statoFatturazione !== 'Effettivo') {
          console.log(`[Notifications] Skipping invoice ${invoice.id} - invoice stato is '${invoice.statoFatturazione}' (not Effettivo)`);
          continue;
        }

        // Check if this invoice has an associated cashflow
        const cashflow = cashflowRecords.find(cf => cf.invoiceId === invoice.id);

        // Skip if no cashflow exists
        if (!cashflow) {
          console.log(`[Notifications] Skipping invoice ${invoice.id} - no cashflow associated`);
          continue;
        }

        // Skip if cashflow is 'Effettivo' (already paid)
        if (cashflow.statoFatturazione === 'Effettivo') {
          console.log(`[Notifications] Skipping invoice ${invoice.id} - cashflow is 'Effettivo' (paid)`);
          continue;
        }

        // Only notify for confirmed invoices (Effettivo) with unpaid cashflow (Stimato)
        console.log(`[Notifications] Checking invoice ${invoice.id} (stato: ${invoice.statoFatturazione}) with cashflow stato '${cashflow.statoFatturazione}'`);

        const dueDate = new Date(invoice.dataScadenza!);
        dueDate.setHours(0, 0, 0, 0);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        let tipo: 'da_pagare' | 'scaduta' | null = null;

        if (dueDateStr === todayStr) {
          tipo = 'da_pagare';
        } else if (dueDate < today) {
          tipo = 'scaduta';
        }

        if (tipo) {

          // Check if notification already exists and is not dismissed (any type)
          const { data: existing } = await supabase
            .from('invoice_notifications')
            .select('*')
            .eq('invoice_id', invoice.id)
            .eq('dismissed', false)
            .maybeSingle();

          if (existing) {
            // Notification exists - check if tipo needs to be updated
            const existingNotif = snakeToCamel(existing) as InvoiceNotification;

            if (existingNotif.tipo !== tipo) {
              // Update notification tipo (e.g., from 'da_pagare' to 'scaduta')
              console.log(`[Notifications] Updating notification for invoice ${invoice.id} from '${existingNotif.tipo}' to '${tipo}'`);

              const { error: updateError } = await supabase
                .from('invoice_notifications')
                .update({ tipo })
                .eq('id', existingNotif.id);

              if (updateError) {
                console.error('Error updating notification tipo:', updateError);
              } else {
                // Update local state
                setInvoiceNotifications(prev =>
                  prev.map(n => n.id === existingNotif.id ? { ...n, tipo } : n)
                );
                console.log(`[Notifications] Updated notification tipo to '${tipo}' for invoice ${invoice.id}`);
              }
            }
          } else {
            // Create new notification
            const notification: Omit<InvoiceNotification, 'id' | 'createdAt'> = {
              invoiceId: invoice.id,
              tipo,
              dataScadenza: dueDateStr,
              dismissed: false
            };

            const { data, error } = await supabase
              .from('invoice_notifications')
              .insert({
                id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                invoice_id: notification.invoiceId,
                tipo: notification.tipo,
                data_scadenza: notification.dataScadenza,
                dismissed: notification.dismissed
              })
              .select()
              .single();

            if (error) {
              console.error('Error creating notification:', error);
            } else if (data) {
              // Add to local state
              setInvoiceNotifications(prev => [...prev, snakeToCamel(data)]);
              console.log(`[Notifications] Created notification for invoice ${invoice.id} - ${tipo}`);
            }
          }
        } else {
          // tipo is null - due date is in the future
          // Dismiss any existing notification for this invoice
          const { data: existing } = await supabase
            .from('invoice_notifications')
            .select('*')
            .eq('invoice_id', invoice.id)
            .eq('dismissed', false)
            .maybeSingle();

          if (existing) {
            console.log(`[Notifications] Due date is in the future - dismissing notification for invoice ${invoice.id}`);
            const { error: dismissError } = await supabase
              .from('invoice_notifications')
              .update({ dismissed: true })
              .eq('id', existing.id);

            if (!dismissError) {
              setInvoiceNotifications(prev => prev.filter(n => n.id !== existing.id));
              console.log(`[Notifications] Dismissed notification for invoice ${invoice.id}`);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error in checkInvoiceDueDates:', err);
    }
  }, [isSupabaseConfigured, invoices, cashflowRecords]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dismiss a notification
  const dismissNotification = async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured) return false;

    try {
      const { error } = await supabase
        .from('invoice_notifications')
        .update({ dismissed: true })
        .eq('id', id);

      if (error) {
        console.error('Error dismissing notification:', error);
        return false;
      }

      // Update local state
      setInvoiceNotifications(prev => prev.filter(n => n.id !== id));
      return true;
    } catch (err) {
      console.error('Error in dismissNotification:', err);
      return false;
    }
  };

  const value: DataContextType = {
    customers,
    deals,
    invoices,
    transactions,
    financialItems,
    cashflowRecords,
    loading,
    error,
    isSupabaseConfigured,
    aiProcessing,
    setAiProcessing,
    stopAiProcessing,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addDeal,
    updateDeal,
    deleteDeal,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addFinancialItem,
    updateFinancialItem,
    deleteFinancialItem,
    addCashflowRecord,
    updateCashflowRecord,
    deleteCashflowRecord,
    bankBalances,
    setBankBalance,
    getBankBalance,
    reconciliationSessions,
    bankTransactions,
    addReconciliationSession,
    updateReconciliationSession,
    deleteReconciliationSession,
    clearAllReconciliationSessions,
    addBankTransaction,
    updateBankTransaction,
    deleteBankTransaction,
    settings,
    getSettings,
    updateSettings,
    getCompanyUsers,
    createUser,
    updateUser,
    deleteUser,
    invoiceNotifications,
    checkInvoiceDueDates,
    dismissNotification,
    refreshData: fetchData,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};
