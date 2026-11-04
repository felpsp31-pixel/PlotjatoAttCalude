export type InvoiceStatus = 'open' | 'paid' | 'overdue';

export interface Attachment {
  url: string;
  name: string;
  date: string; // ISO date string
}

export interface Invoice {
  id: string;
  entityId: string;
  description: string;
  value: number;
  dueDate: string;
  referenceMonth: string;
  status: InvoiceStatus;
  attachments: Attachment[];
}

export interface Entity {
  id: string;
  name: string;
  type: 'supplier' | 'client' | 'casual';
  phone?: string;
  email?: string;
  document?: string;
  retainsISS: boolean;
}

export const MOCK_ENTITIES: Entity[] = [];

export const MOCK_INVOICES: Invoice[] = [];
