import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Customer, Deal, Invoice, Transaction, FinancialItem, DealStage, CashflowRecord, BankBalance, BankTransaction, ReconciliationSession, AppSettings } from '../types';
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

    try {
      const [customersRes, dealsRes, invoicesRes, transactionsRes, financialItemsRes, cashflowRes, bankBalancesRes, reconciliationSessionsRes, bankTransactionsRes, settingsRes] = await Promise.all([
        supabase.from('customers').select('*'),
        supabase.from('deals').select('*'),
        supabase.from('invoices').select('*'),
        supabase.from('transactions').select('*'),
        supabase.from('financial_items').select('*'),
        supabase.from('cashflow_records').select('*'),
        supabase.from('bank_balances').select('*'),
        supabase.from('reconciliation_sessions').select('*'),
        supabase.from('bank_transactions').select('*'),
        supabase.from('settings').select('*').eq('id', 'default').single(),
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
      // Settings - single row, may not exist yet
      if (settingsRes.data) {
        setSettings(snakeToCamel(settingsRes.data));
      } else {
        // Initialize with defaults if doesn't exist
        setSettings({
          id: 'default',
          defaultAiProvider: 'anthropic',
          anthropicApiKey: '',
          openaiApiKey: ''
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
  }, [isSupabaseConfigured]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Customer CRUD
  const addCustomer = async (customer: Omit<Customer, 'id'>): Promise<Customer | null> => {
    if (!isSupabaseConfigured) {
      const newCustomer = { ...customer, id: `C-${Date.now()}` } as Customer;
      setCustomers(prev => [...prev, newCustomer]);
      return newCustomer;
    }

    const { data, error } = await supabase
      .from('customers')
      .insert(camelToSnake(customer))
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

    const { data, error } = await supabase
      .from('deals')
      .insert(camelToSnake(deal))
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
    const invoiceWithId = { ...invoice, id: newId };

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

    const { data, error } = await supabase
      .from('transactions')
      .insert(camelToSnake(transaction))
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

    const { data, error } = await supabase
      .from('financial_items')
      .insert(camelToSnake(itemWithId))
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

    const dataToInsert = camelToSnake(record);
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
    if (!isSupabaseConfigured) {
      setCashflowRecords(prev => prev.map(cf => cf.id === id ? { ...cf, ...record } : cf));
      return true;
    }

    const { error } = await supabase
      .from('cashflow_records')
      .update(camelToSnake(record))
      .eq('id', id);

    if (error) {
      console.error('Error updating cashflow record:', error);
      return false;
    }

    setCashflowRecords(prev => prev.map(cf => cf.id === id ? { ...cf, ...record } : cf));
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

    if (existingBalance) {
      // Update existing
      const { data, error } = await supabase
        .from('bank_balances')
        .update(camelToSnake({ saldoIniziale, note }))
        .eq('anno', anno)
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
        .insert(camelToSnake({ anno, saldoIniziale, note }))
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
    if (!isSupabaseConfigured) {
      // Return from state if Supabase not configured
      return settings;
    }

    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'default')
        .single();

      if (error) {
        console.error('Error fetching settings:', error);
        return null;
      }

      const convertedSettings = snakeToCamel(data);
      setSettings(convertedSettings);
      return convertedSettings;
    } catch (err) {
      console.error('Error in getSettings:', err);
      return null;
    }
  };

  const updateSettings = async (newSettings: Partial<Omit<AppSettings, 'id'>>): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      // Update local state if Supabase not configured
      setSettings(prev => prev ? { ...prev, ...newSettings } : null);
      return true;
    }

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          id: 'default',
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
    refreshData: fetchData,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};
