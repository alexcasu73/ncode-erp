export enum DealStage {
  LEAD = 'Lead',
  QUALIFICATION = 'Qualification',
  PROPOSAL = 'Proposal',
  NEGOTIATION = 'Negotiation',
  WON = 'Won',
  LOST = 'Lost'
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  status: 'Active' | 'Prospect' | 'Inactive';
  revenue: number;
  avatar: string;
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
  status: 'Paid' | 'Pending' | 'Overdue';
}

export interface NavItem {
  id: string;
  label: string;
  icon: any; // Using lucide-react types loosely here
}
