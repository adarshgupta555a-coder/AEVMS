"use client";

import * as React from "react";
import Link from "next/link";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Receipt,
  Download,
  Eye,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Building2,
  Loader2,
  FileText,
} from "lucide-react";
import { useInvoice } from "@/features/invoices/hooks/use-invoices";
import { downloadInvoicePdf } from "@/features/invoices/services/invoice.service";
import { InvoicePdfModal } from "@/features/invoices/components/invoice-pdf-modal";
import { formatDate, formatINR } from "@/lib/formatters";
import { toast } from "sonner";
import { useSetBreadcrumbTitle } from "@/store/breadcrumb-store";

function getStatusBadge(status: string) {
  switch (status) {
    case "PAID":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
          Paid in Full
        </Badge>
      );
    case "PARTIALLY_PAID":
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
          Partially Paid
        </Badge>
      );
    case "ISSUED":
    case "SENT":
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">
          Payment Due
        </Badge>
      );
    case "OVERDUE":
      return (
        <Badge variant="destructive" className="bg-destructive/15 text-destructive border-destructive/30">
          Overdue
        </Badge>
      );
    case "CANCELLED":
      return <Badge variant="outline">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function ClientInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);

  const { data: invoice, isLoading, error } = useInvoice(id);
  useSetBreadcrumbTitle(invoice ? `Invoice #${invoice.invoiceNumber}` : null);
  const [pdfModalOpen, setPdfModalOpen] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleDownload = async () => {
    if (!invoice) return;
    try {
      setIsDownloading(true);
      await downloadInvoicePdf(id, invoice.invoiceNumber);
      toast.success(`Invoice ${invoice.invoiceNumber} downloaded successfully.`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to download invoice PDF."
      );
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-md" />
          <div className="space-y-1">
            <Skeleton className="h-6 w-60" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-96 md:col-span-2 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <Button
          size="sm"
          variant="ghost"
          className="gap-2 text-xs"
          render={<Link href="/portal/invoices" />}
        >
          <ArrowLeft className="size-4" />
          Back to Invoices
        </Button>
        <Card className="border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertCircle className="size-10 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-bold text-foreground">Invoice Statement Not Found</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {error ? error.message : "The requested invoice could not be retrieved."}
          </p>
        </Card>
      </div>
    );
  }

  const items = invoice.items ?? [];
  const allocations = invoice.paymentAllocations ?? [];
  const total = Number(invoice.totalAmount) || 0;
  const paid = Number(invoice.paidAmount) || 0;
  const balance =
    invoice.balanceAmount !== undefined
      ? Number(invoice.balanceAmount)
      : Math.max(0, total - paid);
  const discountVal = Number(invoice.discountValue) || 0;
  const isPercentageDiscount = invoice.discountType === "PERCENTAGE";
  const taxRateVal = Number(invoice.taxRate) || 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              render={<Link href="/portal/invoices" />}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {invoice.title}
            </h1>
            <Badge variant="outline" className="text-xs font-mono">
              {invoice.invoiceNumber}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Official billing statement, tax breakdown, and payment transaction history.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {getStatusBadge(invoice.status)}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPdfModalOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Eye className="size-4" />
            Preview PDF
          </Button>
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
            className="gap-1.5 text-xs"
          >
            {isDownloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Download PDF
          </Button>
        </div>
      </div>

      {/* Main Grid: Itemized Charges & Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Itemized Charges Table & Payment History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Itemized Table */}
          <Card className="border-border/70 shadow-xs overflow-hidden">
            <CardHeader className="border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Itemized Charges
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Official line items billed under this tax invoice statement.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {items.length} {items.length === 1 ? "Line Item" : "Line Items"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-10 text-center text-xs">#</TableHead>
                    <TableHead className="text-xs">Description & Scope</TableHead>
                    <TableHead className="text-right text-xs">Qty</TableHead>
                    <TableHead className="text-right text-xs">Rate</TableHead>
                    <TableHead className="text-right text-xs">Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                        No line items listed on this invoice.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, idx) => (
                      <TableRow key={item.id} className="hover:bg-muted/20">
                        <TableCell className="text-center text-xs font-mono text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-semibold text-foreground">
                            {item.itemName}
                          </div>
                          {item.description && (
                            <div className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-line">
                              {item.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {item.quantity} {item.unit ? <span className="text-[10px] text-muted-foreground">{item.unit}</span> : ""}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {formatINR(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-foreground font-mono">
                          {formatINR(item.totalPrice)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment Receipts & Transaction History */}
          <Card className="border-border/70 shadow-xs overflow-hidden">
            <CardHeader className="border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CreditCard className="size-4 text-primary" />
                    Payment History Receipts
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Recorded payment allocations and verified receipts for this statement.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {allocations.length} {allocations.length === 1 ? "Receipt" : "Receipts"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {allocations.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/10">
                  <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                    <Receipt className="size-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">No Payments Recorded Yet</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1">
                    When your payment (advance, bank transfer, UPI, cheque) is reconciled, the official receipt will be listed here.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-xs">Receipt #</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Method</TableHead>
                      <TableHead className="text-xs">Reference</TableHead>
                      <TableHead className="text-right text-xs">Allocated Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocations.map((alloc) => (
                      <TableRow key={alloc.id} className="hover:bg-muted/20">
                        <TableCell className="text-xs font-mono font-medium text-foreground">
                          {alloc.payment?.paymentNumber || "RCP-RECONCILED"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {alloc.payment?.paymentDate
                            ? formatDate(alloc.payment.paymentDate)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[10px]">
                            {alloc.payment?.paymentMethod || "RECONCILED"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-[120px]">
                          {alloc.payment?.transactionReference || "-"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatINR(alloc.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Terms & Bank Payment Instructions */}
          {invoice.terms && (
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  Billing Terms & Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line p-3.5 rounded-lg bg-muted/40 border border-border/50">
                  {invoice.terms}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Col: Financial Statement Balance Breakdown */}
        <div className="space-y-6">
          <Card className="border-border/70 shadow-xs overflow-hidden">
            <CardHeader className="bg-muted/20 border-b border-border/60 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                Balance Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium text-foreground font-mono">
                  {formatINR(invoice.subtotal)}
                </span>
              </div>

              {discountVal > 0 && (
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span>
                    Discount {isPercentageDiscount ? `(${discountVal}%)` : ""}
                  </span>
                  <span className="font-mono">
                    - {formatINR(isPercentageDiscount ? (Number(invoice.subtotal) * discountVal) / 100 : discountVal)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-muted-foreground">
                <span>Tax {taxRateVal > 0 ? `(${taxRateVal}% GST)` : ""}</span>
                <span className="font-mono">{formatINR(invoice.taxAmount)}</span>
              </div>

              <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                <span className="font-semibold text-foreground">Total Invoiced</span>
                <span className="font-bold text-foreground font-mono">
                  {formatINR(total)}
                </span>
              </div>

              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                <span>Total Amount Paid</span>
                <span className="font-bold font-mono">
                  {formatINR(paid)}
                </span>
              </div>

              <div className="pt-3 border-t-2 border-border/80 flex items-baseline justify-between">
                <div>
                  <span className="text-sm font-bold text-foreground">Balance Due</span>
                  <span className="block text-[10px] text-muted-foreground">Outstanding net payable</span>
                </div>
                <span
                  className={`text-xl font-extrabold font-mono ${
                    balance > 0.01
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {formatINR(balance)}
                </span>
              </div>

              {balance <= 0.01 && (
                <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>This invoice has been settled in full.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Statement Particulars */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-semibold">Statement Particulars</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5 text-xs">
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground">Invoice Date</span>
                <div className="font-medium text-foreground flex items-center gap-1.5">
                  <Calendar className="size-3 text-primary" />
                  {formatDate(invoice.invoiceDate, "dd MMMM yyyy")}
                </div>
              </div>

              {invoice.dueDate && (
                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground">Due Date</span>
                  <div className="font-medium text-foreground flex items-center gap-1.5">
                    <Clock className="size-3 text-primary" />
                    {formatDate(invoice.dueDate, "dd MMMM yyyy")}
                  </div>
                </div>
              )}

              {invoice.event && (
                <div className="space-y-0.5 pt-2 border-t border-border/50">
                  <span className="text-[11px] text-muted-foreground">Linked Event Production</span>
                  <div className="font-semibold text-foreground">
                    {invoice.event.title}
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {invoice.event.eventNumber}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* PDF Streaming Preview Modal */}
      <InvoicePdfModal
        open={pdfModalOpen}
        onOpenChange={setPdfModalOpen}
        invoiceId={id}
        invoiceNumber={invoice.invoiceNumber}
      />
    </div>
  );
}
