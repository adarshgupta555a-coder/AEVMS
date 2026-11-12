import {
  LayoutDashboard,
  Users,
  FileText,
  CalendarCheck,
  Boxes,
  Wallet,
  Handshake,
  Receipt,
  CreditCard,
} from "lucide-react";
import type { NavGroup } from "@/types/navigation";

export const adminNavigationConfig: NavGroup[] = [
  {
    groupLabel: "Overview",
    items: [
      {
        title: "Executive Dashboard",
        icon: LayoutDashboard,
        href: "/dashboard",
      },
    ],
  },
  {
    groupLabel: "Core Operations",
    items: [
      {
        title: "Client Management",
        icon: Users,
        items: [
          {
            title: "All Clients",
            href: "/clients",
            description: "Directory of business clients and contact profiles",
          },
          {
            title: "Register Client",
            href: "/clients/create",
            description: "Onboard new client profile and initial intake",
          },
          {
            title: "Portal Access",
            href: "/clients/portal",
            description: "Manage client portal assignments and invitation status",
          },
        ],
      },
      {
        title: "Quotation Management",
        icon: FileText,
        items: [
          {
            title: "All Quotations",
            href: "/quotations",
            description: "View and manage all client quotations and statuses",
          },
          {
            title: "Create Quotation",
            href: "/quotations/new",
            description: "Build a new itemized quotation with live tax and discounts",
          },
        ],
      },
      {
        title: "Event Operations",
        icon: CalendarCheck,
        items: [
          {
            title: "All Events",
            href: "/events",
            description: "Monitor active events, timelines, and budgets",
          },
          {
            title: "Kanban Board",
            href: "/events/board",
            description: "Visual pipeline of events across lifecycle statuses",
          },
          {
            title: "Event Calendar",
            href: "/events/calendar",
            description: "Master calendar for site visits, meetings, and dates",
          },
          {
            title: "Gantt Timeline",
            href: "/events/timeline",
            description: "Interactive project schedule and duration bars",
          },
          {
            title: "Create Event",
            href: "/events/new",
            description: "Schedule and register a new event project",
          },
        ],
      },
    ],
  },
  {
    groupLabel: "Resource & Partner Logistics",
    items: [
      {
        title: "Inventory Management",
        icon: Boxes,
        items: [
          {
            title: "Inventory Items",
            href: "/inventory",
            description: "Stock item master catalog and reorder alerts",
          },
          {
            title: "Stock Movements",
            href: "/inventory/movements",
            description: "Issue to events, warehouse returns, and damage ledger",
          },
        ],
      },
      {
        title: "Expense Management",
        icon: Wallet,
        items: [
          {
            title: "All Expenses",
            href: "/expenses",
            description: "General operating expenses and overhead disbursements",
          },
          {
            title: "Event Expenses",
            href: "/expenses/events",
            description: "Direct project production expenses and vendor costs",
          },
          {
            title: "Personal Withdrawals",
            href: "/expenses/withdrawals",
            description: "Isolated owner draws and partner equity withdrawals",
          },
        ],
      },
      {
        title: "Tie-up Management",
        icon: Handshake,
        items: [
          {
            title: "All Tie-ups",
            href: "/tie-ups",
            description: "Hotel, resort, and banquet venue collaboration directory",
          },
          {
            title: "Tie-up Transactions",
            href: "/tie-ups/transactions",
            description: "Refundable venue security deposits and commissions",
          },
        ],
      },
    ],
  },
  {
    groupLabel: "Finance & Settlements",
    items: [
      {
        title: "Billing & Invoicing",
        icon: Receipt,
        items: [
          {
            title: "All Invoices",
            href: "/invoices",
            description: "Proforma and final tax invoices with live balances",
          },
          {
            title: "Create Invoice",
            href: "/invoices/new",
            description: "Generate a new itemized invoice with advance adjustment",
          },
        ],
      },
      {
        title: "Payment Engine",
        icon: CreditCard,
        items: [
          {
            title: "Payment Records",
            href: "/payments",
            description: "Client payment transaction receipts and history",
          },
          {
            title: "Record Payment",
            href: "/payments/new",
            description: "Allocate incoming client funds across pending invoices",
          },
        ],
      },
    ],
  },
];
