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

// Tipo di spesa per le uscite
export type TipoSpesa = 'Costi per servizi' | 'Altri costi' | 'Team' | '';

// Categoria spesa
export type CategoriaSpesa = 'Tools' | 'Utenze' | 'Affitto casa' | 'Banca' | 'Commercialista' | 'Marketing' | 'Intrattenimento' | 'Generiche' | 'Costi per servizi' | '';

export interface Invoice {
  id: string;
  data: Date | string;
  mese: string;
  anno: number;
  nomeProgetto: string;
  tipo: 'Entrata' | 'Uscita';
  statoFatturazione: 'Stimato' | 'Effettivo' | 'Nessuno';
  nextStep?: string;
  spesa: string; // Categoria spesa (Tools, Utenze, etc.)
  tipoSpesa: string; // Tipo spesa (Costi per servizi, Team, etc.)
  note: string;
  flusso: number; // Importo netto
  iva: number; // Importo IVA
  percentualeIva: number; // Aliquota IVA (0, 22)
  percentualeFatturazione: number; // % fatturazione
  checked: boolean;
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