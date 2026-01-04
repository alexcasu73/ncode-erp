import { Deal, DealStage, Customer, Invoice } from './types';
import { LayoutDashboard, Users, Briefcase, Receipt, PieChart, Wallet, Settings } from 'lucide-react';

export const APP_NAME = "Ncode ERP";

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'crm', label: 'Customers', icon: Users },
  { id: 'deals', label: 'Deals Pipeline', icon: Briefcase },
  { id: 'invoicing', label: 'Invoices', icon: Receipt },
  { id: 'cashflow', label: 'Cashflow', icon: Wallet },
  { id: 'analytics', label: 'Analytics', icon: PieChart },
];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: '1', name: 'Alia Bonner', company: 'TechFlow', email: 'alia@techflow.com', status: 'Active', revenue: 15600, avatar: 'https://picsum.photos/100/100?random=1' },
  { id: '2', name: 'Millie Tran', company: 'SoftCorp', email: 'millie@softcorp.com', status: 'Active', revenue: 8400, avatar: 'https://picsum.photos/100/100?random=2' },
  { id: '3', name: 'Natalia Bloggs', company: 'Innovate Ltd', email: 'nat@innovate.com', status: 'Prospect', revenue: 0, avatar: 'https://picsum.photos/100/100?random=3' },
  { id: '4', name: 'John Doe', company: 'Acme Inc', email: 'john@acme.com', status: 'Active', revenue: 22000, avatar: 'https://picsum.photos/100/100?random=4' },
];

export const MOCK_DEALS: Deal[] = [
  { id: '101', title: 'Enterprise License', customerName: 'TechFlow', value: 50000, stage: DealStage.NEGOTIATION, probability: 70, expectedClose: '2026-02-15' },
  { id: '102', title: 'Consulting Pack', customerName: 'Innovate Ltd', value: 12000, stage: DealStage.PROPOSAL, probability: 40, expectedClose: '2026-03-01' },
  { id: '103', title: 'Yearly Subscription', customerName: 'SoftCorp', value: 8500, stage: DealStage.WON, probability: 100, expectedClose: '2026-01-10' },
  { id: '104', title: 'Q1 Service Retainer', customerName: 'Acme Inc', value: 15000, stage: DealStage.QUALIFICATION, probability: 20, expectedClose: '2026-04-01' },
];

export const MOCK_INVOICES: Invoice[] = [
  { id: 'INV-001', number: '001/2026', customerName: 'TechFlow', amount: 5600.00, date: '2026-01-02', status: 'Paid' },
  { id: 'INV-002', number: '002/2026', customerName: 'SoftCorp', amount: 2400.00, date: '2026-01-03', status: 'Pending' },
  { id: 'INV-003', number: '003/2026', customerName: 'Acme Inc', amount: 12500.50, date: '2025-12-15', status: 'Overdue' },
];

export const SALES_DATA = [
  { name: '1 Aug', sales: 60, returns: 10 },
  { name: '5 Aug', sales: 90, returns: 15 },
  { name: '10 Aug', sales: 75, returns: 20 },
  { name: '13 Aug', sales: 85, returns: 12 },
  { name: '15 Aug', sales: 100, returns: 18 },
  { name: '20 Aug', sales: 65, returns: 8 },
  { name: '22 Aug', sales: 80, returns: 25 },
  { name: '25 Aug', sales: 55, returns: 10 },
  { name: '30 Aug', sales: 78, returns: 15 },
  { name: '31 Aug', sales: 95, returns: 12 },
];

export const REVENUE_DATA = [
  { name: 'Mar', value: 200 },
  { name: 'Apr', value: 350 },
  { name: 'May', value: 250 },
  { name: 'Jun', value: 450 },
  { name: 'Jul', value: 550 },
];
