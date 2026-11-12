"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useBreadcrumbStore } from "@/store/breadcrumb-store";
import { Home } from "lucide-react";

interface Crumb {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

const collectionNames: Record<string, string> = {
  clients: "Clients",
  quotations: "Quotations",
  events: "Events",
  invoices: "Invoices",
  payments: "Payments",
  inventory: "Inventory",
  expenses: "Expenses",
  "tie-ups": "Tie-ups",
  calendar: "Operations Calendar",
};

const portalCollectionNames: Record<string, string> = {
  events: "Scheduled Events",
  quotations: "Review Quotations",
  invoices: "My Invoices",
  profile: "Profile & Security",
};

function isRecordIdentifier(segment: string, prevSegment?: string): boolean {
  // UUID v4 pattern
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Pure numeric ID
  const numericRegex = /^\d+$/;
  // Long alphanumeric hash / CUID / MongoDB ID (16+ chars)
  const hashIdRegex = /^[0-9a-zA-Z_-]{16,}$/;

  if (uuidRegex.test(segment) || numericRegex.test(segment) || hashIdRegex.test(segment)) {
    return true;
  }

  // Positional check: following a primary collection and not a known static action
  const knownActions = new Set([
    "create",
    "new",
    "board",
    "calendar",
    "timeline",
    "portal",
    "details",
    "movements",
    "withdrawals",
    "transactions",
  ]);

  if (prevSegment && collectionNames[prevSegment] && !knownActions.has(segment)) {
    return true;
  }

  return false;
}

function getFallbackRecordTitle(collection?: string): string {
  switch (collection) {
    case "clients":
      return "Client Details";
    case "events":
      return "Event Details";
    case "invoices":
      return "Invoice Details";
    case "quotations":
      return "Quotation Details";
    case "payments":
      return "Payment Details";
    default:
      return "Record Details";
  }
}

export function AppBreadcrumbs({ isClientPortal = false }: { isClientPortal?: boolean }) {
  const pathname = usePathname();
  const customTitle = useBreadcrumbStore((s) => s.customTitle);

  const crumbs = React.useMemo<Crumb[]>(() => {
    const rawSegments = pathname.split("/").filter(Boolean);

    if (isClientPortal) {
      // Portal Root
      const portalCrumbs: Crumb[] = [
        { label: "Portal", href: "/portal/dashboard" },
      ];

      // Remove "portal" prefix segment
      const portalSegments = rawSegments[0] === "portal" ? rawSegments.slice(1) : rawSegments;

      if (portalSegments.length === 0 || portalSegments[0] === "dashboard") {
        return [{ label: "Portal Dashboard", isCurrent: true }];
      }

      const collection = portalSegments[0];
      const collectionLabel = portalCollectionNames[collection] || collection;
      const collectionHref = `/portal/${collection}`;

      if (portalSegments.length === 1) {
        portalCrumbs.push({ label: collectionLabel, isCurrent: true });
        return portalCrumbs;
      }

      // Has sub-segment (e.g. /portal/events/[id])
      portalCrumbs.push({ label: collectionLabel, href: collectionHref });

      const detailSegment = portalSegments[1];
      if (isRecordIdentifier(detailSegment, collection)) {
        const title = customTitle || getFallbackRecordTitle(collection);
        portalCrumbs.push({ label: title, isCurrent: true });
      } else {
        portalCrumbs.push({
          label: detailSegment.replace(/-/g, " "),
          isCurrent: true,
        });
      }

      return portalCrumbs;
    }

    // Admin Root
    if (rawSegments.length === 0 || rawSegments[0] === "dashboard") {
      return [{ label: "Dashboard", isCurrent: true }];
    }

    const adminCrumbs: Crumb[] = [
      { label: "Dashboard", href: "/dashboard" },
    ];

    const collection = rawSegments[0];
    const collectionLabel = collectionNames[collection] || collection.replace(/-/g, " ");
    const collectionHref = `/${collection}`;

    if (rawSegments.length === 1) {
      adminCrumbs.push({ label: collectionLabel, isCurrent: true });
      return adminCrumbs;
    }

    // 2+ segments (e.g., /events/board, /invoices/new, /clients/[id])
    adminCrumbs.push({ label: collectionLabel, href: collectionHref });

    const subSegment = rawSegments[1];

    if (isRecordIdentifier(subSegment, collection)) {
      // Dynamic record: NEVER show raw ID
      const recordTitle = customTitle || getFallbackRecordTitle(collection);
      adminCrumbs.push({ label: recordTitle, isCurrent: true });
    } else {
      // Static sub-route actions
      let actionLabel = subSegment.replace(/-/g, " ");
      if (subSegment === "new" || subSegment === "create") {
        if (collection === "clients") actionLabel = "Register Client";
        else if (collection === "quotations") actionLabel = "Create Quotation";
        else if (collection === "invoices") actionLabel = "Create Invoice";
        else if (collection === "payments") actionLabel = "Record Payment";
        else if (collection === "events") actionLabel = "Create Event";
      } else if (subSegment === "board") {
        actionLabel = "Kanban Board";
      } else if (subSegment === "calendar") {
        actionLabel = "Event Calendar";
      } else if (subSegment === "timeline") {
        actionLabel = "Gantt Timeline";
      } else if (subSegment === "movements") {
        actionLabel = "Stock Movements";
      } else if (subSegment === "withdrawals") {
        actionLabel = "Personal Withdrawals";
      } else if (subSegment === "transactions") {
        actionLabel = "Tie-up Transactions";
      } else if (subSegment === "portal") {
        actionLabel = "Portal Access";
      } else if (subSegment === "details") {
        actionLabel = "Directory Details";
      }

      adminCrumbs.push({ label: actionLabel, isCurrent: true });
    }

    return adminCrumbs;
  }, [pathname, isClientPortal, customTitle]);

  return (
    <Breadcrumb className="text-xs">
      <BreadcrumbList>
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          const isFirst = idx === 0;

          return (
            <React.Fragment key={`${crumb.label}-${idx}`}>
              <BreadcrumbItem>
                {crumb.isCurrent || !crumb.href ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href={crumb.href}
                    className="flex items-center gap-1 hover:text-foreground"
                    title={crumb.label}
                  >
                    {isFirst && !isClientPortal ? (
                      <>
                        <Home className="size-3.5 text-muted-foreground/80 shrink-0" />
                        <span className="hidden sm:inline">{crumb.label}</span>
                      </>
                    ) : (
                      <span>{crumb.label}</span>
                    )}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
