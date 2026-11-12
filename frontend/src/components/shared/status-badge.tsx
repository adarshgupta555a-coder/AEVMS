import * as React from "react";
import { cn } from "@/lib/utils";
import type {
  EventStatus,
  QuotationStatus,
  InvoiceStatus,
  TaskStatus,
  TaskPriority,
} from "@/types/models";

export type StatusCategory =
  | "event"
  | "quotation"
  | "invoice"
  | "task"
  | "priority";

export interface StatusStyleConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
}

const eventStatusMap: Record<EventStatus, StatusStyleConfig> = {
  DRAFT: {
    label: "Draft",
    badgeClass: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20",
    dotClass: "bg-zinc-400",
  },
  PLANNING: {
    label: "Planning",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    dotClass: "bg-amber-500",
  },
  CONFIRMED: {
    label: "Confirmed",
    badgeClass: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
    dotClass: "bg-indigo-500",
  },
  IN_PROGRESS: {
    label: "In Progress",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    dotClass: "bg-blue-500 animate-pulse",
  },
  COMPLETED: {
    label: "Completed",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    dotClass: "bg-emerald-500",
  },
  CANCELLED: {
    label: "Cancelled",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 line-through decoration-rose-500/50",
    dotClass: "bg-rose-500",
  },
};

const quotationStatusMap: Record<QuotationStatus, StatusStyleConfig> = {
  DRAFT: {
    label: "Draft",
    badgeClass: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20",
    dotClass: "bg-zinc-400",
  },
  SENT: {
    label: "Sent",
    badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
    dotClass: "bg-sky-500",
  },
  VIEWED: {
    label: "Viewed",
    badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
    dotClass: "bg-purple-500",
  },
  ACCEPTED: {
    label: "Accepted",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    dotClass: "bg-emerald-500",
  },
  REJECTED: {
    label: "Rejected",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
    dotClass: "bg-rose-500",
  },
  EXPIRED: {
    label: "Expired",
    badgeClass: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
    dotClass: "bg-zinc-400",
  },
  CANCELLED: {
    label: "Cancelled",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 line-through decoration-rose-500/50",
    dotClass: "bg-rose-500",
  },
};

const invoiceStatusMap: Record<InvoiceStatus, StatusStyleConfig> = {
  DRAFT: {
    label: "Draft",
    badgeClass: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20",
    dotClass: "bg-zinc-400",
  },
  ISSUED: {
    label: "Issued",
    badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
    dotClass: "bg-sky-500",
  },
  SENT: {
    label: "Sent",
    badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
    dotClass: "bg-sky-500",
  },
  PARTIALLY_PAID: {
    label: "Partially Paid",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    dotClass: "bg-amber-500",
  },
  PAID: {
    label: "Paid",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    dotClass: "bg-emerald-500",
  },
  OVERDUE: {
    label: "Overdue",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 font-bold",
    dotClass: "bg-rose-500 animate-ping",
  },
  CANCELLED: {
    label: "Cancelled",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 line-through decoration-rose-500/50",
    dotClass: "bg-rose-500",
  },
};

const taskStatusMap: Record<TaskStatus, StatusStyleConfig> = {
  TODO: {
    label: "To Do",
    badgeClass: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20",
    dotClass: "bg-zinc-400",
  },
  IN_PROGRESS: {
    label: "In Progress",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    dotClass: "bg-blue-500 animate-pulse",
  },
  DONE: {
    label: "Done",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    dotClass: "bg-emerald-500",
  },
  COMPLETED: {
    label: "Completed",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    dotClass: "bg-emerald-500",
  },
  CANCELLED: {
    label: "Cancelled",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 line-through",
    dotClass: "bg-rose-500",
  },
};

const taskPriorityMap: Record<TaskPriority, StatusStyleConfig> = {
  LOW: {
    label: "Low",
    badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
    dotClass: "bg-slate-400",
  },
  MEDIUM: {
    label: "Medium",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    dotClass: "bg-blue-500",
  },
  HIGH: {
    label: "High",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    dotClass: "bg-amber-500",
  },
  URGENT: {
    label: "Urgent",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 font-semibold",
    dotClass: "bg-rose-500 animate-pulse",
  },
};

export type AnyStatus =
  | EventStatus
  | QuotationStatus
  | InvoiceStatus
  | TaskStatus
  | TaskPriority
  | string;

export interface StatusBadgeProps {
  status: AnyStatus;
  type?: StatusCategory;
  showDot?: boolean;
  className?: string;
  customLabel?: string;
}

export function StatusBadge({
  status,
  type,
  showDot = true,
  className,
  customLabel,
}: StatusBadgeProps) {
  // Resolve config based on explicit type or fallback heuristic
  let config: StatusStyleConfig | undefined;

  const normalizedStatus = (status || "").toUpperCase();

  if (type === "event" && normalizedStatus in eventStatusMap) {
    config = eventStatusMap[normalizedStatus as EventStatus];
  } else if (type === "quotation" && normalizedStatus in quotationStatusMap) {
    config = quotationStatusMap[normalizedStatus as QuotationStatus];
  } else if (type === "invoice" && normalizedStatus in invoiceStatusMap) {
    config = invoiceStatusMap[normalizedStatus as InvoiceStatus];
  } else if (type === "task" && normalizedStatus in taskStatusMap) {
    config = taskStatusMap[normalizedStatus as TaskStatus];
  } else if (type === "priority" && normalizedStatus in taskPriorityMap) {
    config = taskPriorityMap[normalizedStatus as TaskPriority];
  } else {
    // Auto-detect based on enum value
    config =
      eventStatusMap[normalizedStatus as EventStatus] ||
      quotationStatusMap[normalizedStatus as QuotationStatus] ||
      invoiceStatusMap[normalizedStatus as InvoiceStatus] ||
      taskStatusMap[normalizedStatus as TaskStatus] ||
      taskPriorityMap[normalizedStatus as TaskPriority];
  }

  // Fallback config for custom or unknown status
  if (!config) {
    config = {
      label: status ? status.replace(/_/g, " ") : "Unknown",
      badgeClass: "bg-muted text-muted-foreground border-border/60",
      dotClass: "bg-muted-foreground",
    };
  }

  const displayLabel = customLabel || config.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-tight whitespace-nowrap shadow-2xs transition-colors",
        config.badgeClass,
        className
      )}
    >
      {showDot && (
        <span
          className={cn("size-1.5 shrink-0 rounded-full", config.dotClass)}
          aria-hidden="true"
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
}

// Named convenience components for explicit semantic clarity
export function EventStatusBadge({
  status,
  ...props
}: Omit<StatusBadgeProps, "type" | "status"> & { status: EventStatus }) {
  return <StatusBadge type="event" status={status} {...props} />;
}

export function QuotationStatusBadge({
  status,
  ...props
}: Omit<StatusBadgeProps, "type" | "status"> & { status: QuotationStatus }) {
  return <StatusBadge type="quotation" status={status} {...props} />;
}

export function InvoiceStatusBadge({
  status,
  ...props
}: Omit<StatusBadgeProps, "type" | "status"> & { status: InvoiceStatus }) {
  return <StatusBadge type="invoice" status={status} {...props} />;
}

export function TaskStatusBadge({
  status,
  ...props
}: Omit<StatusBadgeProps, "type" | "status"> & { status: TaskStatus }) {
  return <StatusBadge type="task" status={status} {...props} />;
}

export function PriorityBadge({
  priority,
  ...props
}: Omit<StatusBadgeProps, "type" | "status"> & { priority: TaskPriority }) {
  return <StatusBadge type="priority" status={priority} {...props} />;
}
