/**
 * Shared TypeScript Domain Models & Enums
 * Mirrors PostgreSQL schema managed via Prisma ORM (`backend/prisma/schema.prisma`)
 */

// ==========================================
// STRING UNION ENUMS
// ==========================================

export type UserRole = "ADMIN" | "CLIENT";

export type EventStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PLANNING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "DONE"
  | "COMPLETED"
  | "CANCELLED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type QuotationStatus =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "VIEWED"
  | "CANCELLED";

export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED"
  | "SENT"
  | "OVERDUE";

export type InvoiceType = "PROFORMA" | "FINAL";

export type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "UPI"
  | "CHEQUE"
  | "CARD"
  | "OTHER";

export type PaymentType =
  | "ADVANCE"
  | "PARTIAL"
  | "FULL"
  | "OTHER";

export type PaymentStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED";

export type DiscountType = "PERCENTAGE" | "FIXED";

export type CalendarEntryType =
  | "SITE_VISIT"
  | "CLIENT_MEETING"
  | "VENDOR_MEETING"
  | "REHEARSAL"
  | "EVENT_DATE"
  | "FOLLOW_UP"
  | "MEETING"
  | "OFFICE_ACTIVITY"
  | "OTHER";

// ==========================================
// DOMAIN MODEL INTERFACES
// ==========================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  clientId?: string | null;
  invitationToken?: string | null;
  invitationExpiresAt?: string | Date | null;
  client?: Client | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Client {
  id: string;
  name: string;
  email?: string | null;
  phone: string;
  address?: string | null;
  city?: string | null;
  notes?: string | null;
  user?: User | null;
  quotations?: Quotation[];
  events?: Event[];
  invoices?: Invoice[];
  payments?: Payment[];
  calendarEntries?: CalendarEntry[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  clientId: string;
  client?: Client;
  title: string;
  eventType: string;
  eventDate?: string | Date | null;
  venue?: string | null;
  guestCount?: number | null;
  subtotal: number | string;
  discountType?: DiscountType | null;
  discountValue: number | string;
  taxRate: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  validUntil?: string | Date | null;
  status: QuotationStatus;
  notes?: string | null;
  terms?: string | null;
  createdById: string;
  createdBy?: User;
  items?: QuotationItem[];
  sentAt?: string | Date | null;
  acceptedAt?: string | Date | null;
  rejectedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface QuotationItem {
  id: string;
  quotationId: string;
  quotation?: Quotation;
  itemName: string;
  description?: string | null;
  quantity: number | string;
  unit?: string | null;
  unitPrice: number | string;
  totalPrice: number | string;
  sortOrder: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Event {
  id: string;
  eventNumber: string;
  clientId: string;
  client?: Client;
  quotationId?: string | null;
  quotation?: Quotation | null;
  title: string;
  eventType: string;
  description?: string | null;
  eventDate: string | Date;
  startTime?: string | Date | null;
  endTime?: string | Date | null;
  venueName?: string | null;
  venueAddress?: string | null;
  guestCount?: number | null;
  budget?: number | string | null;
  status: EventStatus;
  notes?: string | null;
  createdById: string;
  createdBy?: User;
  tasks?: EventTask[];
  schedules?: EventSchedule[];
  calendar?: CalendarEntry[];
  invoices?: Invoice[];
  payments?: Payment[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface EventTask {
  id: string;
  eventId: string;
  event?: Event;
  title: string;
  description?: string | null;
  dueDate?: string | Date | null;
  status: TaskStatus;
  priority: TaskPriority;
  completedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface EventSchedule {
  id: string;
  eventId: string;
  event?: Event;
  title: string;
  description?: string | null;
  startAt: string | Date;
  endAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CalendarEntry {
  id: string;
  title: string;
  description?: string | null;
  type: CalendarEntryType;
  startAt: string | Date;
  endAt?: string | Date | null;
  allDay: boolean;
  location?: string | null;
  clientId: string;
  client?: Client;
  eventId?: string | null;
  event?: Event | null;
  createdById: string;
  createdBy?: User;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  client?: Client;
  eventId?: string | null;
  event?: Event | null;
  title: string;
  invoiceDate: string | Date;
  dueDate?: string | Date | null;
  subtotal: number | string;
  discountType?: DiscountType | null;
  discountValue: number | string;
  taxRate: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  status: InvoiceStatus;
  notes?: string | null;
  terms?: string | null;
  createdById: string;
  createdBy?: User;
  items?: InvoiceItem[];
  proformaPayments?: Payment[];
  paymentAllocations?: PaymentAllocation[];
  sentAt?: string | Date | null;
  cancelledAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  invoice?: Invoice;
  itemName: string;
  description?: string | null;
  quantity: number | string;
  unit?: string | null;
  unitPrice: number | string;
  totalPrice: number | string;
  sortOrder: number;
  type: InvoiceType;
  quotationId?: string | null;
  quotation?: Quotation | null;
  advanceAdjusted: number | string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  clientId: string;
  client?: Client;
  eventId?: string | null;
  event?: Event | null;
  proformaInvoiceId?: string | null;
  proformaInvoice?: Invoice | null;
  amount: number | string;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  transactionReference?: string | null;
  paymentDate: string | Date;
  notes?: string | null;
  recordedById: string;
  recordedBy?: User;
  allocations?: PaymentAllocation[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  payment?: Payment;
  invoiceId: string;
  invoice?: Invoice;
  amount: number | string;
  allocatedAt: string | Date;
}

export interface EventFinancialSummary {
  eventId: string;
  budget: number;
  totalInvoiced: number;
  totalPaid: number;
  outstandingBalance: number;
  quotationAmount?: number;
}
