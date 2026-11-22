"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  CreditCard,
  FileText,
  Send,
  Ban,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Receipt,
  Loader2,
  Layers,
  ArrowUpRight,
} from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

import {
  useInvoice,
  useInvoiceBalance,
  useUpdateInvoiceStatusMutation,
} from "@/features/invoices/hooks/use-invoices";
import { downloadInvoicePdf } from "@/features/invoices/services/invoice.service";
import { InvoicePdfModal } from "@/features/invoices/components/invoice-pdf-modal";
import {
  formatINR,
  formatDate,
  formatDateTime,
  formatIndianPhone,
} from "@/lib/formatters";
import type { InvoiceStatusType } from "@/features/invoices/schemas/invoice.schema";
import { useSetBreadcrumbTitle } from "@/store/breadcrumb-store";

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const router = useRouter();

  // Queries & Mutations
  const { data: invoice, isLoading, isError, error, refetch } = useInvoice(id);
  const { data: balanceData } = useInvoiceBalance(id);

  useSetBreadcrumbTitle(invoice ? `Invoice #${invoice.invoiceNumber}` : null);
  const updateStatusMutation = useUpdateInvoiceStatusMutation();

  // Dialog & Action States
  const [isPdfModalOpen, setIsPdfModalOpen] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [transitionState, setTransitionState] = React.useState<{
    targetStatus: InvoiceStatusType;
    title: string;
    description: string;
  } | null>(null);

  // Financial figures
  const totalAmount = Number(balanceData?.totalAmount ?? invoice?.totalAmount ?? 0);
  const paidAmount = Number(balanceData?.paidAmount ?? invoice?.paidAmount ?? 0);
  const balanceAmount = Number(
    balanceData?.balanceAmount ??
      invoice?.balanceAmount ??
      Math.max(0, totalAmount - paidAmount)
  );

  const paymentPercentage =
    totalAmount > 0
      ? Math.min(100, Math.round((paidAmount / totalAmount) * 100))
      : 0;

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setIsDownloading(true);
    try {
      await downloadInvoicePdf(invoice.id, invoice.invoiceNumber);
      toast.success(`Downloaded ${invoice.invoiceNumber}.pdf`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to download invoice PDF"
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleStatusTransition = async (reason?: string) => {
    if (!transitionState || !invoice) return;
    try {
      await updateStatusMutation.mutateAsync({
        id: invoice.id,
        data: {
          status: transitionState.targetStatus,
          notes: reason || undefined,
        },
      });
      toast.success(
        `Invoice status updated to ${transitionState.targetStatus.replace("_", " ")}`
      );
      setTransitionState(null);
      refetch();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to transition invoice status"
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 w-full pb-12">
        <div className="flex items-center gap-3 pb-2 border-b border-border/60">
          <Skeleton className="size-8 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="w-full p-12 text-center space-y-4">
        <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="size-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Failed to load invoice</h2>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error
              ? error.message
              : "The requested invoice could not be located."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/invoices")}>
          Return to Invoices Register
        </Button>
      </div>
    );
  }

  const client = invoice.client;
  const event = invoice.event;
  const items = invoice.items ?? [];
  const allocations = invoice.paymentAllocations ?? [];
  const canCancel =
    invoice.status !== "CANCELLED" &&
    invoice.status !== "PAID" &&
    allocations.length === 0;

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => router.push("/invoices")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {invoice.invoiceNumber}
              </h1>
              <StatusBadge status={invoice.status} type="invoice" />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {invoice.title}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preview PDF */}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8 text-xs"
            onClick={() => setIsPdfModalOpen(true)}
          >
            <FileText className="size-3.5" />
            Preview PDF
          </Button>

          {/* Download PDF */}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8 text-xs"
            disabled={isDownloading}
            onClick={handleDownloadPdf}
          >
            {isDownloading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Download PDF
          </Button>

          {/* Mark as Sent (if DRAFT) */}
          {invoice.status === "DRAFT" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 text-xs text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/10"
              onClick={() =>
                setTransitionState({
                  targetStatus: "SENT",
                  title: "Mark Invoice as Sent",
                  description:
                    "This marks the invoice as officially delivered to the client and activates payment tracking.",
                })
              }
            >
              <Send className="size-3.5" />
              Mark as Sent
            </Button>
          )}

          {/* Cancel Invoice */}
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() =>
                setTransitionState({
                  targetStatus: "CANCELLED",
                  title: "Cancel Invoice",
                  description:
                    "Are you sure you want to cancel this invoice? Once cancelled, no further payments can be allocated.",
                })
              }
            >
              <Ban className="size-3.5" />
              Cancel Invoice
            </Button>
          )}

          {/* Record Payment */}
          {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
            <Button
              size="sm"
              className="gap-1.5 h-8 text-xs"
              render={
                <Link
                  href={`/payments/new?clientId=${invoice.clientId}&invoiceId=${invoice.id}`}
                />
              }
            >
              <CreditCard className="size-3.5" />
              Record Payment
            </Button>
          )}
        </div>
      </div>

      {/* Financial Balance Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Invoiced */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Invoiced
            </span>
            <Receipt className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {formatINR(totalAmount)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Includes taxes and discounts
            </p>
          </CardContent>
        </Card>

        {/* Amount Paid */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Amount Paid
            </span>
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {formatINR(paidAmount)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${paymentPercentage}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                {paymentPercentage}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Balance Receivable */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-2 space-y-0 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Balance Receivable
            </span>
            <Clock className="size-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold font-mono ${
                balanceAmount <= 0
                  ? "text-muted-foreground"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {formatINR(balanceAmount)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {balanceAmount <= 0
                ? "Invoice balance is fully cleared"
                : `Payment due by ${formatDate(invoice.dueDate)}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Client & Event Context Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Client Details */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 className="size-3.5 text-primary" />
              Client Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {client ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">
                    {client.name}
                  </span>
                  <Link
                    href={`/clients/${client.id}`}
                    className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                  >
                    View Client <ArrowUpRight className="size-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-muted-foreground">
                  {client.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="size-3 text-primary shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="size-3 text-primary shrink-0" />
                      <span>{formatIndianPhone(client.phone)}</span>
                    </div>
                  )}
                  {(client.address || client.city) && (
                    <div className="flex items-center gap-1.5 sm:col-span-2">
                      <MapPin className="size-3 text-primary shrink-0" />
                      <span className="truncate">
                        {[client.address, client.city].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <span className="text-muted-foreground italic">No client assigned</span>
            )}
          </CardContent>
        </Card>

        {/* Invoice & Event Metadata */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar className="size-3.5 text-primary" />
              Invoice & Event Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground">Issue Date:</span>
                <p className="font-medium text-foreground mt-0.5">
                  {formatDate(invoice.invoiceDate)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Payment Due:</span>
                <p className="font-medium text-foreground mt-0.5">
                  {invoice.dueDate ? formatDate(invoice.dueDate) : "Immediate"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Linked Event:</span>
                {event ? (
                  <p className="font-medium text-foreground mt-0.5">
                    <Link
                      href={`/events/${event.id}`}
                      className="text-primary hover:underline"
                    >
                      {event.title} ({event.eventNumber})
                    </Link>
                  </p>
                ) : (
                  <p className="font-medium text-muted-foreground mt-0.5 italic">
                    Direct Billing
                  </p>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Created At:</span>
                <p className="font-medium text-foreground mt-0.5">
                  {formatDateTime(invoice.createdAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Itemized Line Charges Table */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Itemized Charges Breakdown
              </CardTitle>
            </div>
            <CardDescription className="text-xs mt-0.5">
              Detailed line items, billing classifications, rates, and advance adjustments.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {items.length} {items.length === 1 ? "Item" : "Items"}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/70 bg-muted/30">
                  <TableHead className="w-12 text-xs font-semibold">#</TableHead>
                  <TableHead className="text-xs font-semibold">Item & Description</TableHead>
                  <TableHead className="w-24 text-xs font-semibold">Type</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Qty</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Rate</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Advance Offset</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                      No line items recorded on this invoice.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, idx) => {
                    const qty = Number(item.quantity) || 0;
                    const price = Number(item.unitPrice) || 0;
                    const lineTotal = Number(item.totalPrice) || qty * price;
                    const advance = Number(item.advanceAdjusted) || 0;

                    return (
                      <TableRow key={item.id || idx} className="border-border/60">
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-foreground">
                              {item.itemName}
                            </span>
                            {item.description && (
                              <span className="text-[11px] text-muted-foreground">
                                {item.description}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={item.type === "PROFORMA" ? "outline" : "secondary"}
                            className="text-[10px] uppercase font-mono"
                          >
                            {item.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {qty} {item.unit && <span className="text-muted-foreground">{item.unit}</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatINR(price)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                          {advance > 0 ? `-${formatINR(advance)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                          {formatINR(lineTotal)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mathematical Totals Breakdown Box */}
          <div className="p-4 bg-muted/20 border-t border-border/70 flex justify-end">
            <div className="w-full sm:w-80 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono font-medium text-foreground">
                  {formatINR(invoice.subtotal)}
                </span>
              </div>

              {Number(invoice.discountValue) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    Discount{" "}
                    {invoice.discountType === "PERCENTAGE"
                      ? `(${invoice.discountValue}%)`
                      : "(Fixed)"}
                  </span>
                  <span className="font-mono font-medium text-rose-600 dark:text-rose-400">
                    -{formatINR(
                      invoice.discountType === "PERCENTAGE"
                        ? (Number(invoice.subtotal) * Number(invoice.discountValue)) / 100
                        : invoice.discountValue
                    )}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-muted-foreground">
                <span>GST Tax ({Number(invoice.taxRate)}%)</span>
                <span className="font-mono font-medium text-foreground">
                  +{formatINR(invoice.taxAmount)}
                </span>
              </div>

              <Separator className="my-1" />

              <div className="flex justify-between text-sm font-semibold text-foreground">
                <span>Total Amount</span>
                <span className="font-mono font-bold text-primary">
                  {formatINR(totalAmount)}
                </span>
              </div>

              <div className="flex justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span>Paid to Date</span>
                <span className="font-mono">
                  {formatINR(paidAmount)}
                </span>
              </div>

              <div className="flex justify-between text-xs font-bold text-amber-600 dark:text-amber-400 pt-1 border-t border-border/40">
                <span>Balance Receivable</span>
                <span className="font-mono">
                  {formatINR(balanceAmount)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Allocation History Table */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Payment Allocation History
              </CardTitle>
            </div>
            <CardDescription className="text-xs mt-0.5">
              Audited record of all cash, bank transfer, and UPI payments credited to this invoice.
            </CardDescription>
          </div>
          {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 text-xs"
              render={
                <Link
                  href={`/payments/new?clientId=${invoice.clientId}&invoiceId=${invoice.id}`}
                />
              }
            >
              <CreditCard className="size-3.5" />
              Record Payment
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/70 bg-muted/30">
                  <TableHead className="text-xs font-semibold">Payment #</TableHead>
                  <TableHead className="text-xs font-semibold">Payment Date</TableHead>
                  <TableHead className="text-xs font-semibold">Method</TableHead>
                  <TableHead className="text-xs font-semibold">Reference</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Allocated Amount</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-xs text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CreditCard className="size-8 text-muted-foreground/50" />
                        <p className="font-medium text-foreground">No payment allocations recorded</p>
                        <p className="text-[11px] max-w-xs text-muted-foreground">
                          Payments made toward this invoice will appear here once recorded and applied.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  allocations.map((alloc) => {
                    const pay = alloc.payment;
                    return (
                      <TableRow key={alloc.id} className="border-border/60">
                        <TableCell>
                          {pay ? (
                            <Link
                              href={`/payments/${pay.id}`}
                              className="font-mono text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                            >
                              {pay.paymentNumber}
                              <ArrowUpRight className="size-3" />
                            </Link>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">
                              {alloc.paymentId}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {pay?.paymentDate
                            ? formatDate(pay.paymentDate)
                            : formatDate(alloc.allocatedAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {pay?.paymentMethod ?? "OTHER"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {pay?.transactionReference || "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatINR(alloc.amount)}
                        </TableCell>
                        <TableCell>
                          {pay && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="size-7 p-0"
                              render={<Link href={`/payments/${pay.id}`} />}
                            >
                              <ArrowUpRight className="size-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Notes & Terms Section */}
      {(invoice.notes || invoice.terms) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {invoice.notes && (
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {invoice.notes}
                </p>
              </CardContent>
            </Card>
          )}

          {invoice.terms && (
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Terms & Conditions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {invoice.terms}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Status Transition Confirmation Dialog */}
      {transitionState && (
        <ConfirmDialog
          open={Boolean(transitionState)}
          onOpenChange={(open) => !open && setTransitionState(null)}
          title={transitionState.title}
          description={transitionState.description}
          confirmText="Confirm Status Update"
          variant={
            transitionState.targetStatus === "CANCELLED"
              ? "destructive"
              : "default"
          }
          onConfirm={handleStatusTransition}
          isLoading={updateStatusMutation.isPending}
        />
      )}

      {/* PDF Streaming & Preview Modal */}
      <InvoicePdfModal
        open={isPdfModalOpen}
        onOpenChange={setIsPdfModalOpen}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
      />
    </div>
  );
}
