"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Receipt,
  Plus,
  Eye,
  Trash2,
  MoreHorizontal,
  Download,
  DollarSign,
  AlertCircle,
  Clock,
  FileText,
  Loader2,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataTable,
  type DataTableColumnDef,
} from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatINR, formatDate } from "@/lib/formatters";

import {
  useInvoices,
  useDeleteInvoiceMutation,
} from "@/features/invoices/hooks/use-invoices";
import {
  downloadInvoicePdf,
} from "@/features/invoices/services/invoice.service";
import type {
  InvoiceWithRelations,
  InvoiceStatusType,
} from "@/features/invoices/schemas/invoice.schema";
import { InvoicePdfModal } from "@/features/invoices/components/invoice-pdf-modal";

type InvoiceTableRow = InvoiceWithRelations & Record<string, unknown>;

const STATUS_FILTER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "All Statuses", value: "ALL" },
  { label: "Draft", value: "DRAFT" },
  { label: "Sent", value: "SENT" },
  { label: "Partially Paid", value: "PARTIALLY_PAID" },
  { label: "Paid", value: "PAID" },
  { label: "Overdue", value: "OVERDUE" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default function InvoicesPage() {
  const router = useRouter();

  // State
  const [selectedStatus, setSelectedStatus] = React.useState<string>("ALL");
  const [deletingInvoice, setDeletingInvoice] =
    React.useState<InvoiceWithRelations | null>(null);
  const [previewInvoice, setPreviewInvoice] =
    React.useState<InvoiceWithRelations | null>(null);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  // Queries & Mutations
  const queryParams = React.useMemo(() => {
    return selectedStatus === "ALL"
      ? { limit: 100 }
      : { status: selectedStatus as InvoiceStatusType, limit: 100 };
  }, [selectedStatus]);

  const { data, isLoading, refetch } = useInvoices(queryParams);
  const deleteMutation = useDeleteInvoiceMutation();

  const invoices = React.useMemo(
    () => (data?.invoices ?? []) as InvoiceTableRow[],
    [data?.invoices]
  );

  // Metric summary cards: Total Invoiced, Amount Collected, Outstanding Balance, Overdue Invoices count
  const metrics = React.useMemo(() => {
    let totalInvoiced = 0;
    let amountCollected = 0;
    let outstandingBalance = 0;
    let overdueCount = 0;

    invoices.forEach((inv) => {
      const total = Number(inv.totalAmount) || 0;
      const paid = Number(inv.paidAmount) || 0;
      const balance =
        inv.balanceAmount !== undefined
          ? Number(inv.balanceAmount)
          : Math.max(0, total - paid);

      if (inv.status !== "CANCELLED") {
        totalInvoiced += total;
        amountCollected += paid;
        outstandingBalance += balance;
      }

      if (inv.status === "OVERDUE") {
        overdueCount++;
      }
    });

    return {
      totalInvoiced,
      amountCollected,
      outstandingBalance,
      overdueCount,
    };
  }, [invoices]);

  const handleDownloadPdf = async (
    e: React.MouseEvent,
    invoice: InvoiceWithRelations
  ) => {
    e.stopPropagation();
    setDownloadingId(invoice.id);
    try {
      await downloadInvoicePdf(invoice.id, invoice.invoiceNumber);
      toast.success(`Downloaded ${invoice.invoiceNumber}.pdf`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to download invoice PDF"
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingInvoice) return;
    try {
      await deleteMutation.mutateAsync(deletingInvoice.id);
      toast.success(
        `Invoice #${deletingInvoice.invoiceNumber} deleted successfully`
      );
      setDeletingInvoice(null);
      refetch();
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to delete invoice");
      } else {
        toast.error("Failed to delete invoice");
      }
    }
  };

  const columns = React.useMemo<DataTableColumnDef<InvoiceTableRow, unknown>[]>(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: "Invoice #",
        enableSorting: true,
        cell: ({ row }) => {
          const inv = row.original;
          return (
            <div className="flex flex-col gap-0.5">
              <span className="font-mono font-semibold text-xs text-primary hover:underline">
                {inv.invoiceNumber}
              </span>
              <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                {inv.title}
              </span>
            </div>
          );
        },
      },
      {
        id: "clientName",
        accessorFn: (row) => row.client?.name ?? "",
        header: "Client",
        enableSorting: true,
        cell: ({ row }) => {
          const client = row.original.client;
          if (!client) {
            return <span className="text-muted-foreground text-xs">-</span>;
          }
          return (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">
                {client.name}
              </span>
              {client.email && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[170px]">
                  {client.email}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "eventTitle",
        accessorFn: (row) => row.event?.title ?? "",
        header: "Event",
        enableSorting: true,
        cell: ({ row }) => {
          const event = row.original.event;
          if (!event) {
            return (
              <span className="text-muted-foreground text-xs italic">
                Direct Billing
              </span>
            );
          }
          return (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground truncate max-w-[160px]">
                {event.title}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {event.eventNumber}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "totalAmount",
        header: "Total Amount",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-foreground">
            {formatINR(row.original.totalAmount)}
          </span>
        ),
      },
      {
        accessorKey: "paidAmount",
        header: "Paid Amount",
        enableSorting: true,
        cell: ({ row }) => {
          const paid = Number(row.original.paidAmount) || 0;
          return (
            <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {formatINR(paid)}
            </span>
          );
        },
      },
      {
        accessorKey: "balanceAmount",
        header: "Balance",
        enableSorting: true,
        cell: ({ row }) => {
          const total = Number(row.original.totalAmount) || 0;
          const paid = Number(row.original.paidAmount) || 0;
          const balance =
            row.original.balanceAmount !== undefined
              ? Number(row.original.balanceAmount)
              : Math.max(0, total - paid);

          const isCleared = balance <= 0 && total > 0;
          return (
            <span
              className={`font-mono text-xs font-semibold ${
                isCleared
                  ? "text-muted-foreground"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {formatINR(balance)}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: true,
        cell: ({ row }) => (
          <StatusBadge status={row.original.status} type="invoice" />
        ),
      },
      {
        accessorKey: "dueDate",
        header: "Due Date",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatDate(row.original.dueDate)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const inv = row.original;
          const isDeleting = deleteMutation.isPending;
          const isDownloadingThis = downloadingId === inv.id;
          const canDelete = inv.status === "DRAFT" || inv.status === "CANCELLED";

          return (
            <div
              className="flex items-center justify-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                title="Download PDF"
                disabled={isDownloadingThis}
                onClick={(e) => handleDownloadPdf(e, inv)}
              >
                {isDownloadingThis ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                <span className="sr-only">Download PDF</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground"
                    >
                      <MoreHorizontal className="size-3.5" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                  <DropdownMenuItem
                    className="text-xs gap-2 cursor-pointer"
                    onClick={() => router.push(`/invoices/${inv.id}`)}
                  >
                    <Eye className="size-3.5" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs gap-2 cursor-pointer"
                    onClick={() => setPreviewInvoice(inv)}
                  >
                    <FileText className="size-3.5" />
                    Preview PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs gap-2 cursor-pointer"
                    disabled={isDownloadingThis}
                    onClick={(e) => handleDownloadPdf(e, inv)}
                  >
                    <Download className="size-3.5" />
                    Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {canDelete ? (
                    <DropdownMenuItem
                      className="text-xs gap-2 text-destructive focus:text-destructive cursor-pointer"
                      disabled={isDeleting}
                      onClick={() => setDeletingInvoice(inv)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete Invoice
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      disabled
                      className="text-xs gap-2 text-muted-foreground"
                    >
                      <Trash2 className="size-3.5" />
                      Cannot Delete ({inv.status.replace("_", " ")})
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [deleteMutation.isPending, downloadingId, router]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Billing & Invoicing
            </h1>
            <Badge variant="outline" className="text-xs">
              {invoices.length} {invoices.length === 1 ? "Record" : "Records"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Proforma & tax invoices, advance adjustments, payment balances, and official PDF generation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => router.push("/invoices/new")}
          >
            <Plus className="size-4" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Invoiced"
          value={formatINR(metrics.totalInvoiced)}
          icon={Receipt}
          description="Gross invoiced across active bills"
          isLoading={isLoading}
        />
        <StatCard
          title="Amount Collected"
          value={formatINR(metrics.amountCollected)}
          icon={DollarSign}
          description="Received payments allocated"
          isLoading={isLoading}
        />
        <StatCard
          title="Outstanding Balance"
          value={formatINR(metrics.outstandingBalance)}
          icon={Clock}
          description="Receivables pending collection"
          isLoading={isLoading}
        />
        <StatCard
          title="Overdue Invoices"
          value={metrics.overdueCount}
          icon={AlertCircle}
          description="Past due date payment alerts"
          isLoading={isLoading}
        />
      </div>

      {/* TanStack Table Register */}
      <DataTable
        columns={columns}
        data={invoices}
        isLoading={isLoading}
        searchPlaceholder="Search invoices by number, title, or client..."
        onRowClick={(row) => router.push(`/invoices/${row.id}`)}
        extraActions={
          <div className="flex items-center gap-2">
            <Select
              value={selectedStatus}
              onValueChange={(val) => setSelectedStatus(val || "ALL")}
            >
              <SelectTrigger className="w-[170px] h-9 text-xs">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    label={opt.label}
                    className="text-xs"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        emptyTitle="No invoices found"
        emptyDescription="Get started by creating your first tax or proforma invoice."
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingInvoice)}
        onOpenChange={(open) => !open && setDeletingInvoice(null)}
        title="Delete Invoice"
        description={`Are you sure you want to delete invoice ${deletingInvoice?.invoiceNumber}? This action cannot be undone.`}
        confirmText="Delete Invoice"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />

      {/* PDF Streaming & Preview Modal */}
      {previewInvoice && (
        <InvoicePdfModal
          open={Boolean(previewInvoice)}
          onOpenChange={(open) => !open && setPreviewInvoice(null)}
          invoiceId={previewInvoice.id}
          invoiceNumber={previewInvoice.invoiceNumber}
        />
      )}
    </div>
  );
}
