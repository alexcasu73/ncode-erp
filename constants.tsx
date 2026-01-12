import { Deal, DealStage, Customer, Invoice, Transaction, FinancialItem } from './types';
import { LayoutDashboard, Users, Briefcase, Receipt, PieChart, Wallet, BookOpen } from 'lucide-react';

export const APP_NAME = "Ncode ERP";

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Panoramica', icon: LayoutDashboard },
  { id: 'crm', label: 'Clienti', icon: Users },
  { id: 'deals', label: 'Opportunità', icon: Briefcase },
  { id: 'invoicing', label: 'Fatture', icon: Receipt },
  { id: 'cashflow', label: 'Flusso di Cassa', icon: Wallet },
  { id: 'financials', label: 'Bilancio', icon: BookOpen },
  { id: 'analytics', label: 'Analisi', icon: PieChart },
];

export const MOCK_CUSTOMERS: Customer[] = [
  { 
    id: '1', 
    name: 'Alia Bonner', 
    company: 'TechFlow S.r.l.', 
    email: 'alia@techflow.com', 
    status: 'Attivo', 
    revenue: 15600, 
    avatar: 'https://picsum.photos/100/100?random=1',
    vatId: 'IT0123456001',
    sdiCode: 'M5UXCR1',
    address: 'Via Roma 10, Milano',
    phone: '+39 02 1234567'
  },
  { 
    id: '2', 
    name: 'Millie Tran', 
    company: 'SoftCorp SpA', 
    email: 'millie@softcorp.com', 
    status: 'Attivo', 
    revenue: 8400, 
    avatar: 'https://picsum.photos/100/100?random=2',
    vatId: 'IT9876543002',
    sdiCode: 'KRRH6B9',
    address: 'Corso Italia 45, Torino',
    phone: '+39 011 9876543'
  },
  { 
    id: '3', 
    name: 'Natalia Bloggs', 
    company: 'Innovate Ltd', 
    email: 'nat@innovate.com', 
    status: 'Prospetto', 
    revenue: 0, 
    avatar: 'https://picsum.photos/100/100?random=3',
    vatId: 'IT1122334003',
    sdiCode: '0000000',
    address: 'Piazza Navona 3, Roma',
    phone: '+39 06 1122334'
  },
  { 
    id: '4', 
    name: 'John Doe', 
    company: 'Acme Inc', 
    email: 'john@acme.com', 
    status: 'Attivo', 
    revenue: 22000, 
    avatar: 'https://picsum.photos/100/100?random=4',
    vatId: 'IT5566778004',
    sdiCode: 'SUBM70N',
    address: 'Via Napoli 88, Napoli',
    phone: '+39 081 5566778'
  },
];

export const MOCK_DEALS: Deal[] = [
  { id: '101', title: 'Licenza Enterprise', customerName: 'TechFlow', value: 50000, stage: DealStage.NEGOTIATION, probability: 70, expectedClose: '2026-02-15' },
  { id: '102', title: 'Pacchetto Consulenza', customerName: 'Innovate Ltd', value: 12000, stage: DealStage.PROPOSAL, probability: 40, expectedClose: '2026-03-01' },
  { id: '103', title: 'Abbonamento Annuale', customerName: 'SoftCorp', value: 8500, stage: DealStage.WON, probability: 100, expectedClose: '2026-01-10' },
  { id: '104', title: 'Servizio Q1', customerName: 'Acme Inc', value: 15000, stage: DealStage.QUALIFICATION, probability: 20, expectedClose: '2026-04-01' },
];

export const MOCK_INVOICES: Invoice[] = [
  { id: 'INV-001', number: '001/2026', customerName: 'TechFlow', amount: 5600.00, date: '2026-01-02', status: 'Pagato' },
  { id: 'INV-002', number: '002/2026', customerName: 'SoftCorp', amount: 2400.00, date: '2026-01-03', status: 'In Sospeso' },
  { id: 'INV-003', number: '003/2026', customerName: 'Acme Inc', amount: 12500.50, date: '2025-12-15', status: 'Scaduto' },
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'TRX-001', date: '2026-01-15', description: 'Pagamento Fattura #INV-001', category: 'Vendite', amount: 5600.00, type: 'Entrata', status: 'Completato' },
  { id: 'TRX-002', date: '2026-01-16', description: 'Affitto Ufficio Gennaio', category: 'Affitto', amount: 1200.00, type: 'Uscita', status: 'Completato' },
  { id: 'TRX-003', date: '2026-01-18', description: 'Licenza Software Cloud', category: 'Software', amount: 150.00, type: 'Uscita', status: 'Completato' },
  { id: 'TRX-004', date: '2026-01-20', description: 'Consulenza TechFlow', category: 'Servizi', amount: 2500.00, type: 'Entrata', status: 'In Attesa' },
  { id: 'TRX-005', date: '2026-01-22', description: 'Fornitura Cancelleria', category: 'Ufficio', amount: 85.50, type: 'Uscita', status: 'Completato' },
];

export const MOCK_FINANCIAL_ITEMS: FinancialItem[] = [
    // Stato Patrimoniale - Attivo
    { id: 'SP-A-1', section: 'Stato Patrimoniale', category: 'Attivo', name: 'Immobilizzazioni Immateriali', amount: 15000 },
    { id: 'SP-A-2', section: 'Stato Patrimoniale', category: 'Attivo', name: 'Immobilizzazioni Materiali', amount: 45000 },
    { id: 'SP-A-3', section: 'Stato Patrimoniale', category: 'Attivo', name: 'Crediti verso Clienti', amount: 32500 },
    { id: 'SP-A-4', section: 'Stato Patrimoniale', category: 'Attivo', name: 'Disponibilità Liquide (Banca/Cassa)', amount: 18200 },
    // Stato Patrimoniale - Passivo
    { id: 'SP-P-1', section: 'Stato Patrimoniale', category: 'Passivo', name: 'Capitale Sociale', amount: 10000 },
    { id: 'SP-P-2', section: 'Stato Patrimoniale', category: 'Passivo', name: 'Riserve', amount: 25000 },
    { id: 'SP-P-3', section: 'Stato Patrimoniale', category: 'Passivo', name: 'Debiti verso Fornitori', amount: 12400 },
    { id: 'SP-P-4', section: 'Stato Patrimoniale', category: 'Passivo', name: 'Debiti Tributari', amount: 8500 },
    
    // Conto Economico - Valore Produzione
    { id: 'CE-VP-1', section: 'Conto Economico', category: 'Valore della Produzione', name: 'Ricavi delle vendite e prestazioni', amount: 156000 },
    { id: 'CE-VP-2', section: 'Conto Economico', category: 'Valore della Produzione', name: 'Altri ricavi e proventi', amount: 2500 },
    
    // Conto Economico - Costi Produzione
    { id: 'CE-CP-1', section: 'Conto Economico', category: 'Costi della Produzione', name: 'Costi per materie prime', amount: 35000 },
    { id: 'CE-CP-2', section: 'Conto Economico', category: 'Costi della Produzione', name: 'Costi per servizi', amount: 28000 },
    { id: 'CE-CP-3', section: 'Conto Economico', category: 'Costi della Produzione', name: 'Costi per godimento beni terzi', amount: 12000 },
    { id: 'CE-CP-4', section: 'Conto Economico', category: 'Costi della Produzione', name: 'Costi per il personale', amount: 45000 },
    { id: 'CE-CP-5', section: 'Conto Economico', category: 'Costi della Produzione', name: 'Ammortamenti e svalutazioni', amount: 8500 },
];

export const SALES_DATA = [
  { name: '1 Ago', sales: 60, returns: 10 },
  { name: '5 Ago', sales: 90, returns: 15 },
  { name: '10 Ago', sales: 75, returns: 20 },
  { name: '13 Ago', sales: 85, returns: 12 },
  { name: '15 Ago', sales: 100, returns: 18 },
  { name: '20 Ago', sales: 65, returns: 8 },
  { name: '22 Ago', sales: 80, returns: 25 },
  { name: '25 Ago', sales: 55, returns: 10 },
  { name: '30 Ago', sales: 78, returns: 15 },
  { name: '31 Ago', sales: 95, returns: 12 },
];

export const REVENUE_DATA = [
  { name: 'Mar', value: 200 },
  { name: 'Apr', value: 350 },
  { name: 'Mag', value: 250 },
  { name: 'Giu', value: 450 },
  { name: 'Lug', value: 550 },
];