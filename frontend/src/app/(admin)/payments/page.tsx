"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Receipt,
  Landmark,
  CreditCard,
  Banknote,
  Eye,
  Trash2,
  MoreHorizontal,
  RotateCcw,
  CalendarDays,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DataTable,
  type DataTableColumnDef,
} from "@/components/shared/data-table";
import { StatCard } from "@/components/shared/stat-card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatINR, formatDate, formatIndianPhone } from "@/lib/formatters";
import {
  usePayments,
  useDeletePaymentMutation,
} from "@/features/payments/hooks/use-payments";
import type { PaymentItem } from "@/features/payments/schemas/payment.schema";
import type { PaymentMethod, PaymentType } from "@/types/models";
import { cn } from "@/lib/utils";

// Method Badge Styler
export function PaymentMethodBadge({ method }: { method: PaymentMethod | string }) {
  const methodConfig: Record<string, { label: string; className: string }> = {
    CASH: {
      label: "Cash",
      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    },
    UPI: {
      label: "UPI",
      className: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
    },
    BANK_TRANSFER: {
      label: "Bank Transfer",
      className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    },
    CARD: {
      label: "Card",
      className: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
    },
    CHEQUE: {
      label: "Cheque",
      className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    OTHER: {
      label: "Other",
      className: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20",
    },
  };

  const cfg = methodConfig[method] || methodConfig.OTHER;
  return (
    <Badge variant="outline" className={cn("text-[11px] font-medium px-2 py-0.5", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

// Payment Type Badge
export function PaymentTypeBadge({ type }: { type: PaymentType | string }) {
  const typeConfig: Record<string, { label: string; className: string }> = {
    ADVANCE: {
      label: "Advance",
      className: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
    },
    PARTIAL: {
      label: "Partial",
      className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    FULL: {
      label: "Full",
      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    },
    OTHER: {
      label: "Other",
      className: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
    },
  };

  const cfg = typeConfig[type] || typeConfig.OTHER;
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium px-1.5 py-0.5", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

type PaymentTableRow = PaymentItem & Record<string, unknown>;

export default function PaymentsPage() {
  const router = useRouter();

  // Filters
  const [selectedMethod, setSelectedMethod] = React.useState<string>("ALL");
  const [selectedType, setSelectedType] = React.useState<string>("ALL");

  const queryParams = React.useMemo(() => {
    return {
      limit: 100,
      ...(selectedMethod !== "ALL"
        ? { paymentMethod: selectedMethod as PaymentMethod }
        : {}),
      ...(selectedType !== "ALL"
        ? { paymentType: selectedType as PaymentType }
        : {}),
    };
  }, [selectedMethod, selectedType]);

  const { data, isLoading, refetch } = usePayments(queryParams);
  const payments = React.useMemo(
    () => (data?.payments ?? []) as PaymentTableRow[],
    [data?.payments]
  );

  // Delete State
  const [deletingPayment, setDeletingPayment] = React.useState<PaymentItem | null>(null);
  const deleteMutation = useDeletePaymentMutation();

  const handleDelete = async () => {
    if (!deletingPayment) return;
    try {
      await deleteMutation.mutateAsync(deletingPayment.id);
      toast.success(`Payment "${deletingPayment.paymentNumber}" deleted successfully.`);
      setDeletingPayment(null);
      refetch();
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to delete payment");
      } else {
        toast.error("Failed to delete payment");
      }
    }
  };

  // Metrics summary
  const metrics = React.useMemo(() => {
    let totalCollected = 0;
    let cashTotal = 0;
    let upiBankTotal = 0;

    payments.forEach((p) => {
      const amt = Number(p.amount) || 0;
      totalCollected += amt;
      if (p.paymentMethod === "CASH") {
        cashTotal += amt;
      } else if (p.paymentMethod === "UPI" || p.paymentMethod === "BANK_TRANSFER") {
        upiBankTotal += amt;
      }
    });

    return {
      totalCollected,
      cashTotal,
      upiBankTotal,
      totalReceipts: data?.meta?.total ?? payments.length,
    };
  }, [payments, data?.meta?.total]);

  // Table Columns
  const columns = React.useMemo<DataTableColumnDef<PaymentTableRow>[]>(() => {
    return [
      {
        accessorKey: "paymentNumber",
        header: "Receipt #",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-mono text-xs font-semibold text-foreground">
              {row.original.paymentNumber}
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <CalendarDays className="size-3" />
              {formatDate(row.original.paymentDate)}
            </span>
          </div>
        ),
      },
      {
        id: "client",
        header: "Client Name",
        cell: ({ row }) => {
          const client = row.original.client;
          return (
            <div className="flex flex-col max-w-[190px]">
              <span className="text-xs font-medium text-foreground truncate">
                {client?.name || "Unknown Client"}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {client?.phone ? formatIndianPhone(client.phone) : client?.email || "-"}
              </span>
            </div>
          );
        },
      },
      {
        id: "event",
        header: "Event",
        cell: ({ row }) => {
          const event = row.original.event;
          if (!event) {
            return <span className="text-xs text-muted-foreground">-</span>;
          }
          return (
            <div className="flex flex-col max-w-[180px]">
              <span className="text-xs font-medium text-foreground truncate">
                {event.title}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground truncate">
                {event.eventNumber}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {formatINR(row.original.amount)}
            </span>
            {row.original.allocations && row.original.allocations.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {row.original.allocations.length} {row.original.allocations.length === 1 ? "invoice" : "invoices"}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "paymentMethod",
        header: "Method",
        cell: ({ row }) => <PaymentMethodBadge method={row.original.paymentMethod} />,
      },
      {
        accessorKey: "paymentType",
        header: "Type",
        cell: ({ row }) => <PaymentTypeBadge type={row.original.paymentType} />,
      },
      {
        accessorKey: "transactionReference",
        header: "Reference #",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground truncate max-w-[140px] block">
            {row.original.transactionReference || "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const payment = row.original;
          return (
            <div
              className="flex justify-end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" className="size-7" />
                  }
                >
                  <MoreHorizontal className="size-3.5" />
                  <span className="sr-only">Open payment actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 text-xs">
                  <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                    Payment Options
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => router.push(`/payments/${payment.id}`)}
                    className="cursor-pointer gap-2"
                  >
                    <Eye className="size-3.5" />
                    View Receipt
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeletingPayment(payment)}
                    className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                    Delete Payment
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ];
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Payment Transactions
            </h1>
            <Badge variant="outline" className="text-xs">
              Remittance Ledger
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Client remittances, multi-invoice allocation history, and printable payment receipts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            render={<Link href="/payments/new" />}
          >
            <Plus className="size-4" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Collected"
          value={formatINR(metrics.totalCollected)}
          icon={Landmark}
          isLoading={isLoading}
          description="Gross revenue recorded across all receipts"
        />
        <StatCard
          title="Cash Collections"
          value={formatINR(metrics.cashTotal)}
          icon={Banknote}
          isLoading={isLoading}
          description="Direct physical currency remittances"
        />
        <StatCard
          title="UPI & Bank Transfers"
          value={formatINR(metrics.upiBankTotal)}
          icon={CreditCard}
          isLoading={isLoading}
          description="Electronic digital settlements"
        />
        <StatCard
          title="Total Receipts"
          value={metrics.totalReceipts}
          icon={Receipt}
          isLoading={isLoading}
          description="Verified remittance vouchers issued"
        />
      </div>

      {/* TanStack Data Table */}
      <DataTable
        columns={columns}
        data={payments}
        isLoading={isLoading}
        searchPlaceholder="Search receipts by #, reference, client, amount..."
        defaultPageSize={10}
        onRowClick={(row) => router.push(`/payments/${row.id}`)}
        emptyTitle="No payments recorded"
        emptyDescription="Record a new payment to allocate funds across client invoices."
        extraActions={
          <div className="flex items-center gap-2">
            {/* Method Filter */}
            <select
              aria-label="Filter payments by method"
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CARD">Card</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </select>

            {/* Type Filter */}
            <select
              aria-label="Filter payments by type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">All Types</option>
              <option value="ADVANCE">Advance</option>
              <option value="PARTIAL">Partial</option>
              <option value="FULL">Full</option>
              <option value="OTHER">Other</option>
            </select>

            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 gap-1.5"
              onClick={() => refetch()}
            >
              <RotateCcw className="size-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deletingPayment)}
        onOpenChange={(open) => !open && setDeletingPayment(null)}
        title="Delete Payment Remittance"
        description={`Are you sure you want to delete payment receipt "${deletingPayment?.paymentNumber}" of ${formatINR(deletingPayment?.amount)}? This will roll back all invoice allocations and restore affected invoice balances and statuses.`}
        confirmText="Delete Payment"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
