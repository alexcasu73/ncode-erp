export enum DealStage {
  LEAD = 'Lead',
  QUALIFICATION = 'Qualificazione',
  PROPOSAL = 'Proposta',
  NEGOTIATION = 'Negoziazione',
  WON = 'Vinto',
  LOST = 'Perso'
}

export interface AppSettings {
  id: string; // Always 'default' - single row
  defaultAiProvider: 'anthropic' | 'openai';
  anthropicApiKey: string;
  openaiApiKey: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  status: 'Attivo' | 'Prospetto' | 'Inattivo';
  revenue: number;
  avatar?: string; // Base64 image data (optional)
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

// Record di cashflow che può fare riferimento a una fattura o essere standalone
export interface CashflowRecord {
  id: string;
  invoiceId?: string; // Riferimento alla fattura (opzionale per movimenti standalone)
  dataPagamento?: string; // Data effettiva del pagamento
  importo?: number; // Importo (obbligatorio per standalone, opzionale se da fattura)
  note?: string; // Note aggiuntive sul movimento
  statoFatturazione?: 'Stimato' | 'Effettivo' | 'Nessuno'; // Stato indipendente del movimento
  createdAt?: string;
  // Campi per movimenti standalone (senza fattura)
  tipo?: 'Entrata' | 'Uscita'; // Tipo movimento (solo per standalone)
  descrizione?: string; // Descrizione movimento (solo per standalone)
  categoria?: string; // Categoria (solo per standalone)
  // Dati derivati dalla fattura (popolati in join)
  invoice?: Invoice;
}

// Saldo iniziale banca per anno
export interface BankBalance {
  id: string;
  anno: number;
  saldoIniziale: number;
  note?: string;
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

// Transazione bancaria importata dall'estratto conto
export interface BankTransaction {
  id: string;
  sessionId?: string;        // Riferimento alla sessione
  data: string;              // Data operazione (YYYY-MM-DD)
  dataValuta?: string;       // Data valuta
  causale?: string;          // Causale bancaria
  descrizione: string;       // Descrizione/causale
  importo: number;           // Importo (positivo entrata, negativo uscita)
  tipo: 'Entrata' | 'Uscita';
  saldo?: number;            // Saldo progressivo
  // Stato riconciliazione
  matchStatus: 'pending' | 'matched' | 'ignored' | 'manual';
  matchedInvoiceId?: string;
  matchedCashflowId?: string;
  matchConfidence?: number;  // 0-100
  matchReason?: string;      // Spiegazione AI
}

// Sessione di riconciliazione
export interface ReconciliationSession {
  id: string;
  fileName: string;
  uploadDate: string;
  periodo?: string;          // Es. "Gennaio 2025"
  numeroConto?: string;
  saldoIniziale?: number;
  saldoFinale?: number;
  totalTransactions: number;
  matchedCount: number;
  pendingCount: number;
  ignoredCount: number;
  status?: 'open' | 'closed'; // Stato della sessione
  closedDate?: string;        // Data di chiusura
  periodoDal?: string;        // Data inizio periodo (YYYY-MM-DD)
  periodoAl?: string;         // Data fine periodo (YYYY-MM-DD)
}

// Cashflow con fattura join (per comparison views)
export interface CashflowWithInvoice extends CashflowRecord {
  invoice?: Invoice;
}

// Riga per vista affiancata
export interface SideBySideRow {
  bankTransaction?: BankTransaction;
  cashflow?: CashflowWithInvoice;
  matchStatus: 'matched' | 'unmatched' | 'bankOnly' | 'cashflowOnly';
  confidence?: number;
}

// Report differenze tra banca e cashflow
export interface DifferenceReport {
  totalBankEntrate: number;
  totalBankUscite: number;
  totalBankNet: number;
  totalCashflowEntrate: number;
  totalCashflowUscite: number;
  totalCashflowNet: number;
  differenceEntrate: number;
  differenceUscite: number;
  differenceNet: number;
  matchedCount: number;
  unmatchedBankCount: number;
  unmatchedCashflowCount: number;
  reconciliationPercentage: number;
  anomalies?: Array<{
    invoiceId: string;
    invoice: Invoice;
    cashflowAmount: number;
    bankTransactionAmount?: number;
    type: 'no_bank_transaction' | 'amount_mismatch';
    message: string;
  }>;
}