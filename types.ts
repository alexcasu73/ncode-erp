export enum DealStage {
  LEAD = 'Lead',
  QUALIFICATION = 'Qualificazione',
  PROPOSAL = 'Proposta',
  NEGOTIATION = 'Negoziazione',
  WON = 'Vinto',
  LOST = 'Perso'
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  status: 'Attivo' | 'Prospetto' | 'Inattivo';
  revenue: number;
  avatar: string;
  vatId: string; // P.IVA
  sdiCode: string; // SDI
  address: string; // Sede
  phone: string; // Telefono
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  stage: DealStage;
  customerName: string;
  probability: number;
  expectedClose: string;
}

export interface Invoice {
  id: string;
  number: string;
  customerName: string;
  amount: number;
  date: string;
  status: 'Pagato' | 'In Sospeso' | 'Scaduto';
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: 'Entrata' | 'Uscita';
  status: 'Completato' | 'In Attesa';
}

export interface FinancialItem {
  id: string;
  section: 'Stato Patrimoniale' | 'Conto Economico';
  category: 'Attivo' | 'Passivo' | 'Valore della Produzione' | 'Costi della Produzione' | 'Proventi e Oneri';
  name: string;
  amount: number;
  isTotal?: boolean; // Highlight if it is a subtotal
}

export interface NavItem {
  id: string;
  label: string;
  icon: any; // Using lucide-react types loosely here
}