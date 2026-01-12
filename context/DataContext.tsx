import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Customer, Deal, Invoice, Transaction, FinancialItem, DealStage } from '../types';
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
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      acc[snakeKey] = camelToSnake(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
};

interface DataContextType {
  // Data
  customers: Customer[];
  deals: Deal[];
  invoices: Invoice[];
  transactions: Transaction[];
  financialItems: FinancialItem[];

  // Loading states
  loading: boolean;
  error: string | null;
  isSupabaseConfigured: boolean;

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
      setLoading(false);
      return;
    }

    try {
      const [customersRes, dealsRes, invoicesRes, transactionsRes, financialItemsRes] = await Promise.all([
        supabase.from('customers').select('*'),
        supabase.from('deals').select('*'),
        supabase.from('invoices').select('*'),
        supabase.from('transactions').select('*'),
        supabase.from('financial_items').select('*'),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (dealsRes.error) throw dealsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (transactionsRes.error) throw transactionsRes.error;
      if (financialItemsRes.error) throw financialItemsRes.error;

      setCustomers(snakeToCamel(customersRes.data || []));
      setDeals(snakeToCamel(dealsRes.data || []));
      setInvoices(snakeToCamel(invoicesRes.data || []));
      setTransactions(snakeToCamel(transactionsRes.data || []));
      setFinancialItems(snakeToCamel(financialItemsRes.data || []));
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Error fetching data');
      // Fallback to mock data on error
      setCustomers(MOCK_CUSTOMERS);
      setDeals(MOCK_DEALS);
      setInvoices(MOCK_INVOICES);
      setTransactions(MOCK_TRANSACTIONS);
      setFinancialItems(MOCK_FINANCIAL_ITEMS);
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
    if (!isSupabaseConfigured) {
      const newInvoice = { ...invoice, id: `INV-${Date.now()}` } as Invoice;
      setInvoices(prev => [...prev, newInvoice]);
      return newInvoice;
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert(camelToSnake(invoice))
      .select()
      .single();

    if (error) {
      console.error('Error adding invoice:', error);
      return null;
    }

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
    if (!isSupabaseConfigured) {
      setInvoices(prev => prev.filter(i => i.id !== id));
      return true;
    }

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting invoice:', error);
      return false;
    }

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
    if (!isSupabaseConfigured) {
      const newItem = { ...item, id: `FI-${Date.now()}` } as FinancialItem;
      setFinancialItems(prev => [...prev, newItem]);
      return newItem;
    }

    const { data, error } = await supabase
      .from('financial_items')
      .insert(camelToSnake(item))
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

  const value: DataContextType = {
    customers,
    deals,
    invoices,
    transactions,
    financialItems,
    loading,
    error,
    isSupabaseConfigured,
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
    refreshData: fetchData,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};
