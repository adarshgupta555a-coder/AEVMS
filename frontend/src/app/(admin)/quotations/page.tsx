"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Eye,
  Trash2,
  MoreHorizontal,
  Sparkles,
  CheckCircle2,
  Clock,
  TrendingUp,
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
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatINR, formatDate } from "@/lib/formatters";

import {
  useQuotations,
  useDeleteQuotationMutation,
} from "@/features/quotations/hooks/use-quotations";
import type {
  QuotationWithRelations,
  QuotationStatusType,
} from "@/features/quotations/schemas/quotation.schema";
import { ConvertToEventDialog } from "@/features/quotations/components/convert-to-event-dialog";

type QuotationTableRow = QuotationWithRelations & Record<string, unknown>;

const STATUS_FILTER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "All Statuses", value: "ALL" },
  { label: "Draft", value: "DRAFT" },
  { label: "Sent", value: "SENT" },
  { label: "Viewed", value: "VIEWED" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default function QuotationsPage() {
  const router = useRouter();

  // State
  const [selectedStatus, setSelectedStatus] = React.useState<string>("ALL");
  const [convertingQuotation, setConvertingQuotation] =
    React.useState<QuotationWithRelations | null>(null);
  const [deletingQuotation, setDeletingQuotation] =
    React.useState<QuotationWithRelations | null>(null);

  // Queries & Mutations
  const queryParams = React.useMemo(() => {
    return selectedStatus === "ALL"
      ? { limit: 100 }
      : { status: selectedStatus as QuotationStatusType, limit: 100 };
  }, [selectedStatus]);

  const { data, isLoading, refetch } = useQuotations(queryParams);
  const deleteMutation = useDeleteQuotationMutation();

  const quotations = React.useMemo(
    () => (data?.quotations ?? []) as QuotationTableRow[],
    [data?.quotations]
  );

  // Metric computations across loaded data
  const metrics = React.useMemo(() => {
    const total = quotations.length;
    let draftCount = 0;
    let pendingCount = 0;
    let acceptedCount = 0;
    let totalValue = 0;

    quotations.forEach((q) => {
      const amt = Number(q.totalAmount) || 0;
      totalValue += amt;
      if (q.status === "DRAFT") draftCount++;
      else if (q.status === "SENT" || q.status === "VIEWED") pendingCount++;
      else if (q.status === "ACCEPTED") acceptedCount++;
    });

    return { total, draftCount, pendingCount, acceptedCount, totalValue };
  }, [quotations]);

  const handleDelete = async () => {
    if (!deletingQuotation) return;
    try {
      await deleteMutation.mutateAsync(deletingQuotation.id);
      toast.success(
        `Quotation #${deletingQuotation.quotationNumber} deleted successfully`
      );
      setDeletingQuotation(null);
      refetch();
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to delete quotation");
      } else {
        toast.error("Failed to delete quotation");
      }
    }
  };

  const columns = React.useMemo<DataTableColumnDef<QuotationTableRow, unknown>[]>(
    () => [
      {
        accessorKey: "quotationNumber",
        header: "Quotation #",
        enableSorting: true,
        cell: ({ row }) => {
          const q = row.original;
          const isConverted = Boolean(q.event && q.event.length > 0);

          return (
            <div className="flex flex-col gap-0.5">
              <span className="font-mono font-semibold text-xs text-primary hover:underline">
                {q.quotationNumber}
              </span>
              <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                {q.title}
              </span>
              {isConverted && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="size-3" />
                  Converted ({q.event?.[0]?.eventNumber})
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "client",
        header: "Client Name",
        cell: ({ row }) => {
          const client = row.original.client;
          if (!client) {
            return <span className="italic text-muted-foreground">-</span>;
          }

          return (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">
                {client.name}
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                {client.phone}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "eventType",
        header: "Event Type",
        cell: ({ row }) => {
          const q = row.original;
          return (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground capitalize">
                {q.eventType}
              </span>
              {q.venue && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                  {q.venue}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "totalAmount",
        header: "Total Amount",
        enableSorting: true,
        cell: ({ row }) => {
          const q = row.original;
          return (
            <div className="flex flex-col font-mono">
              <span className="text-xs font-bold text-foreground">
                {formatINR(q.totalAmount)}
              </span>
              {Number(q.discountValue) > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  incl. {q.discountType === "PERCENTAGE" ? `${q.discountValue}%` : formatINR(q.discountValue)} disc
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          return <StatusBadge type="quotation" status={row.original.status} />;
        },
      },
      {
        id: "date",
        header: "Valid Until / Date",
        cell: ({ row }) => {
          const q = row.original;
          const targetDate = q.validUntil || q.createdAt;

          return (
            <div className="flex flex-col text-xs">
              <span className="text-foreground">
                {formatDate(targetDate, "dd MMM yyyy")}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {q.validUntil ? "Expiry date" : "Created"}
              </span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const q = row.original;
          const isAccepted = q.status === "ACCEPTED";
          const isConverted = Boolean(q.event && q.event.length > 0);

          return (
            <div
              className="flex items-center justify-end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-7 text-muted-foreground hover:text-foreground"
                    >
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-xs">
                    Quotation #{q.quotationNumber}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    className="text-xs gap-2 cursor-pointer"
                    onClick={() => router.push(`/quotations/${q.id}`)}
                  >
                    <Eye className="size-3.5 text-muted-foreground" />
                    <span>View Details</span>
                  </DropdownMenuItem>

                  {isAccepted && !isConverted && (
                    <DropdownMenuItem
                      className="text-xs gap-2 cursor-pointer font-medium text-emerald-600 dark:text-emerald-400 focus:text-emerald-700"
                      onClick={() => setConvertingQuotation(q)}
                    >
                      <Sparkles className="size-3.5" />
                      <span>Convert to Event</span>
                    </DropdownMenuItem>
                  )}

                  {!isConverted && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-xs gap-2 cursor-pointer text-destructive focus:text-destructive"
                        onClick={() => setDeletingQuotation(q)}
                      >
                        <Trash2 className="size-3.5" />
                        <span>Delete Quotation</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [router]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Quotation Management
            </h1>
            <Badge variant="outline" className="text-xs">
              {metrics.total} Records
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Formulate itemized event estimates, track real-time client decisions, and seamlessly convert accepted proposals into active events.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5 shadow-xs"
            render={<Link href="/quotations/new" />}
          >
            <Plus className="size-4" />
            Create Quotation
          </Button>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Quotations"
          value={metrics.total}
          icon={FileText}
          description="All proposals formulated"
        />
        <StatCard
          title="Pending Client Action"
          value={metrics.pendingCount}
          icon={Clock}
          description="Sent & Viewed in portal"
        />
        <StatCard
          title="Accepted Proposals"
          value={metrics.acceptedCount}
          icon={CheckCircle2}
          description="Ready for event conversion"
        />
        <StatCard
          title="Pipeline Value"
          value={formatINR(metrics.totalValue)}
          icon={TrendingUp}
          description="Cumulative quotation value"
        />
      </div>

      {/* Main Quotations Table with Search and Status Filter */}
      <DataTable
        columns={columns}
        data={quotations}
        isLoading={isLoading}
        searchPlaceholder="Search by quote #, client, venue or event type..."
        onRowClick={(row) => router.push(`/quotations/${row.id}`)}
        extraActions={
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        }
        emptyTitle="No quotations found"
        emptyDescription={
          selectedStatus === "ALL"
            ? "Create your first quotation estimate to get started."
            : `No quotations found matching the status filter "${selectedStatus}".`
        }
      />

      {/* Convert to Event Modal Dialog */}
      <ConvertToEventDialog
        open={Boolean(convertingQuotation)}
        onOpenChange={(open) => {
          if (!open) setConvertingQuotation(null);
        }}
        quotation={convertingQuotation}
        onSuccess={(eventId) => {
          setConvertingQuotation(null);
          refetch();
          router.push(`/events/${eventId}`);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingQuotation)}
        onOpenChange={(open) => {
          if (!open) setDeletingQuotation(null);
        }}
        title={`Delete Quotation #${deletingQuotation?.quotationNumber}?`}
        description="This action cannot be undone. This estimate will be permanently purged from the system. If linked to an existing Event, deletion will be rejected by the server."
        confirmText="Delete Quotation"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
