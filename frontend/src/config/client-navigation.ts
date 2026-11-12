import {
  LayoutDashboard,
  CalendarCheck,
  FileText,
  Receipt,
  UserCheck,
} from "lucide-react";
import type { NavGroup } from "@/types/navigation";

export const clientNavigationConfig: NavGroup[] = [
  {
    groupLabel: "Client Portal",
    items: [
      {
        title: "My Dashboard",
        icon: LayoutDashboard,
        href: "/portal/dashboard",
      },
    ],
  },
  {
    groupLabel: "My Services",
    items: [
      {
        title: "My Events",
        icon: CalendarCheck,
        items: [
          {
            title: "Scheduled Events",
            href: "/portal/events",
            description: "View your event itinerary, schedules, and details",
          },
        ],
      },
      {
        title: "My Quotations",
        icon: FileText,
        items: [
          {
            title: "Review Quotations",
            href: "/portal/quotations",
            description: "Review terms, item pricing, and accept/reject quotes",
          },
        ],
      },
      {
        title: "Invoices & Receipts",
        icon: Receipt,
        items: [
          {
            title: "My Invoices",
            href: "/portal/invoices",
            description: "View balances and download official invoice PDFs",
          },
        ],
      },
      {
        title: "Account Settings",
        icon: UserCheck,
        items: [
          {
            title: "Profile & Security",
            href: "/portal/profile",
            description: "Manage your contact information and portal password",
          },
        ],
      },
    ],
  },
];
