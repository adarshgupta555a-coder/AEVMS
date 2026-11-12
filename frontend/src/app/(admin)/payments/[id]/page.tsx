"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Printer,
  Trash2,
  CalendarDays,
  User,
  CreditCard,
  FileCheck2,
  Receipt,
  ExternalLink,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatINR, formatDate, formatDateTime, formatIndianPhone } from "@/lib/formatters";
import {
  usePayment,
  useDeletePaymentMutation,
} from "@/features/payments/hooks/use-payments";
import {
  PaymentMethodBadge,
  PaymentTypeBadge,
} from "../page";
import { useSetBreadcrumbTitle } from "@/store/breadcrumb-store";

export default function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const router = useRouter();

  const { data: payment, isLoading, isError, error } = usePayment(id);
  useSetBreadcrumbTitle(payment ? `Receipt #${payment.paymentNumber}` : null);
  const deleteMutation = useDeletePaymentMutation();

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const handleDeletePayment = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(
        `Payment receipt "${payment?.paymentNumber}" was successfully deleted and affected invoice statuses were restored.`
      );
      router.push("/payments");
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to delete payment receipt.");
      } else {
        toast.error("Failed to delete payment receipt.");
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !payment) {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto">
        <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <Receipt className="size-6" />
        </div>
        <h2 className="text-base font-semibold text-foreground">
          Payment Receipt Not Found
        </h2>
        <p className="text-xs text-muted-foreground">
          {error?.message || "Unable to load the requested payment receipt."}
        </p>
        <Button size="sm" render={<Link href="/payments" />}>
          Back to Payments
        </Button>
      </div>
    );
  }

  // Calculate allocation totals
  const totalAllocated = (payment.allocations || []).reduce(
    (sum, a) => sum + (Number(a.amount) || 0),
    0
  );
  const paymentAmount = Number(payment.amount) || 0;
  const unallocatedAmount = Math.max(0, paymentAmount - totalAllocated);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/60 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              render={<Link href="/payments" />}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Payment Voucher
            </h1>
            <Badge variant="outline" className="text-xs font-mono">
              {payment.paymentNumber}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Remittance details, transaction audit trail, and invoice allocations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={handlePrint}
          >
            <Printer className="size-3.5" />
            Print Receipt
          </Button>

          <Button
            size="sm"
            variant="destructive"
            className="gap-1.5 text-xs"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="size-3.5" />
            Delete Payment
          </Button>
        </div>
      </div>

      {/* Formal Printable Payment Receipt Card */}
      <div
        id="payment-receipt"
        className="rounded-xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs space-y-6 print:border-none print:shadow-none print:p-0"
      >
        {/* Receipt Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-border/70">
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold text-primary">
              Event Management System
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-0.5">
              PAYMENT RECEIPT
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Official Remittance Acknowledgement Voucher
            </p>
          </div>

          <div className="text-right sm:text-right space-y-1">
            <div className="text-xs text-muted-foreground">Receipt Number</div>
            <div className="font-mono text-base font-bold text-foreground">
              {payment.paymentNumber}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-end gap-1">
              <CalendarDays className="size-3" />
              Date: {formatDate(payment.paymentDate)}
            </div>
          </div>
        </div>

        {/* Remitter & Remittance Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-lg bg-muted/20 border border-border/60">
          {/* Left: Client Details */}
          <div className="space-y-2 text-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="size-3.5" />
              Received From
            </div>
            <div className="font-semibold text-sm text-foreground">
              {payment.client?.name || "Client"}
            </div>
            <div className="text-muted-foreground space-y-0.5">
              {payment.client?.phone && (
                <div>Phone: {formatIndianPhone(payment.client.phone)}</div>
              )}
              {payment.client?.email && <div>Email: {payment.client.email}</div>}
              {payment.client?.city && (
                <div>
                  Address: {payment.client.address ? `${payment.client.address}, ` : ""}
                  {payment.client.city}
                </div>
              )}
            </div>
          </div>

          {/* Right: Payment Method & Reference */}
          <div className="space-y-2 text-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="size-3.5" />
              Remittance Details
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Mode:</span>
              <PaymentMethodBadge method={payment.paymentMethod} />
              <PaymentTypeBadge type={payment.paymentType} />
            </div>
            <div className="text-muted-foreground space-y-0.5">
              <div>
                Reference / UTR:{" "}
                <span className="font-mono text-foreground font-medium">
                  {payment.transactionReference || "N/A"}
                </span>
              </div>
              {payment.event && (
                <div>
                  Event:{" "}
                  <span className="text-foreground font-medium">
                    {payment.event.title} ({payment.event.eventNumber})
                  </span>
                </div>
              )}
              {payment.recordedBy && (
                <div>
                  Recorded by:{" "}
                  <span className="text-foreground">
                    {payment.recordedBy.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hero Amount Display */}
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              Total Amount Received
            </div>
            <div className="text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight mt-1">
              {formatINR(payment.amount)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                payment.status === "COMPLETED"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold"
              }
            >
              <FileCheck2 className="size-3.5 mr-1" />
              {payment.status}
            </Badge>
          </div>
        </div>

        {/* Invoices Allocation Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Invoice Settlements & Allocation Ledger
            </h3>
            <span className="text-xs text-muted-foreground font-mono">
              {payment.allocations?.length || 0}{" "}
              {(payment.allocations?.length || 0) === 1 ? "Invoice" : "Invoices"} Settled
            </span>
          </div>

          {(!payment.allocations || payment.allocations.length === 0) ? (
            <div className="rounded-lg border border-border/70 p-6 text-center text-xs text-muted-foreground bg-muted/10">
              No specific invoice allocations recorded. Entire remittance of{" "}
              <span className="font-mono font-semibold text-foreground">
                {formatINR(payment.amount)}
              </span>{" "}
              stands credited as client advance.
            </div>
          ) : (
            <div className="rounded-lg border border-border/70 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Invoice #</TableHead>
                    <TableHead className="text-xs text-right">Invoice Total</TableHead>
                    <TableHead className="text-xs text-center">Invoice Status</TableHead>
                    <TableHead className="text-xs text-right font-semibold">
                      Allocated from Receipt
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payment.allocations.map((alloc) => (
                    <TableRow key={alloc.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground">
                          {alloc.invoice?.invoiceNumber || alloc.invoiceId}
                          {alloc.invoice?.id && (
                            <Link
                              href={`/invoices/${alloc.invoice.id}`}
                              className="text-muted-foreground hover:text-primary print:hidden"
                              title="View Invoice"
                            >
                              <ExternalLink className="size-3" />
                            </Link>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-right text-muted-foreground">
                        {alloc.invoice?.totalAmount ? formatINR(alloc.invoice.totalAmount) : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {alloc.invoice?.status || "SETTLED"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatINR(alloc.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Allocation Totals Summary */}
          <div className="flex flex-col items-end gap-1.5 pt-2 text-xs">
            <div className="flex items-center justify-between w-64 text-muted-foreground">
              <span>Total Invoices Allocated:</span>
              <span className="font-mono font-medium text-foreground">
                {formatINR(totalAllocated)}
              </span>
            </div>
            {unallocatedAmount > 0 && (
              <div className="flex items-center justify-between w-64 text-amber-600 dark:text-amber-400">
                <span>Advance / Unallocated:</span>
                <span className="font-mono font-semibold">
                  {formatINR(unallocatedAmount)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between w-64 pt-1.5 border-t border-border/80 text-sm font-bold text-foreground">
              <span>Total Remittance:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                {formatINR(payment.amount)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {payment.notes && (
          <div className="p-3 rounded-lg bg-muted/20 border border-border/60 text-xs space-y-1">
            <div className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
              Remittance Remarks / Notes
            </div>
            <div className="text-foreground">{payment.notes}</div>
          </div>
        )}

        {/* Receipt Legal Footer */}
        <div className="pt-6 border-t border-dashed border-border/80 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] text-muted-foreground">
          <div>
            System-generated official receipt • No physical signature required.
          </div>
          <div>
            Printed / Exported on {formatDateTime(new Date())}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Payment Remittance"
        description={`Are you sure you want to delete payment receipt "${payment.paymentNumber}" of ${formatINR(payment.amount)}? This action is permanent: all allocated amounts will be rolled back, and affected invoices will revert to their prior balance and status.`}
        confirmText="Delete Payment"
        variant="destructive"
        onConfirm={handleDeletePayment}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
