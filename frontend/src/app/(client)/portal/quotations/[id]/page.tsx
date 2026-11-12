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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  CheckCircle2,
  XCircle,
  Calendar,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Receipt,
  FileCheck,
  MessageSquare,
  Loader2,
} from "lucide-react";
import {
  useQuotation,
  useUpdateQuotationStatusMutation,
} from "@/features/quotations/hooks/use-quotations";
import { formatDate, formatINR } from "@/lib/formatters";
import { toast } from "sonner";
import { useSetBreadcrumbTitle } from "@/store/breadcrumb-store";

function getStatusBadge(status: string) {
  switch (status) {
    case "SENT":
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
          Awaiting Your Review
        </Badge>
      );
    case "VIEWED":
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">
          Under Review
        </Badge>
      );
    case "ACCEPTED":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
          Accepted
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="destructive" className="bg-destructive/15 text-destructive border-destructive/30">
          Declined
        </Badge>
      );
    case "EXPIRED":
      return <Badge variant="secondary">Expired</Badge>;
    case "CANCELLED":
      return <Badge variant="outline">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function ClientQuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);

  const { data: quotation, isLoading, error } = useQuotation(id);
  useSetBreadcrumbTitle(quotation ? `Quotation #${quotation.quotationNumber}` : null);
  const updateStatusMutation = useUpdateQuotationStatusMutation();

  const [acceptDialogOpen, setAcceptDialogOpen] = React.useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState("");

  const isActionable =
    quotation &&
    (quotation.status === "SENT" || quotation.status === "VIEWED");

  const handleAccept = () => {
    if (!quotation) return;
    updateStatusMutation.mutate(
      { id, data: { status: "ACCEPTED" } },
      {
        onSuccess: () => {
          toast.success("Quotation officially accepted! Your coordinator has been notified.");
          setAcceptDialogOpen(false);
        },
        onError: (err) => {
          toast.error(err.message || "Failed to accept quotation");
        },
      }
    );
  };

  const handleReject = () => {
    if (!quotation) return;
    updateStatusMutation.mutate(
      {
        id,
        data: {
          status: "REJECTED",
          notes: feedback.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Quotation declined. Your feedback was sent to the coordinator.");
          setRejectDialogOpen(false);
        },
        onError: (err) => {
          toast.error(err.message || "Failed to submit decision");
        },
      }
    );
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

  if (error || !quotation) {
    return (
      <div className="space-y-6">
        <Button
          size="sm"
          variant="ghost"
          className="gap-2 text-xs"
          render={<Link href="/portal/quotations" />}
        >
          <ArrowLeft className="size-4" />
          Back to Quotations
        </Button>
        <Card className="border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertCircle className="size-10 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-bold text-foreground">Quotation Not Found</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {error ? error.message : "The requested quotation could not be loaded."}
          </p>
        </Card>
      </div>
    );
  }

  const items = quotation.items ?? [];
  const discountVal = Number(quotation.discountValue) || 0;
  const isPercentageDiscount = quotation.discountType === "PERCENTAGE";
  const taxRateVal = Number(quotation.taxRate) || 0;

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
              render={<Link href="/portal/quotations" />}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {quotation.title}
            </h1>
            <Badge variant="outline" className="text-xs font-mono">
              {quotation.quotationNumber}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review itemized pricing, discounts, and terms before accepting this proposal.
          </p>
        </div>

        {/* Action Controls for Client Decision */}
        <div className="flex items-center gap-2">
          {isActionable ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRejectDialogOpen(true)}
                disabled={updateStatusMutation.isPending}
                className="gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30"
              >
                <XCircle className="size-4" />
                Decline Proposal
              </Button>
              <Button
                size="sm"
                onClick={() => setAcceptDialogOpen(true)}
                disabled={updateStatusMutation.isPending}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                <CheckCircle2 className="size-4" />
                Accept Quotation
              </Button>
            </>
          ) : (
            <div>{getStatusBadge(quotation.status)}</div>
          )}
        </div>
      </div>

      {/* Decision Status Notification Banner */}
      {quotation.status === "ACCEPTED" && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="text-xs">
            <span className="font-bold">Quotation Accepted! </span>
            {quotation.acceptedAt
              ? `You officially accepted this proposal on ${formatDate(quotation.acceptedAt, "dd MMM yyyy, hh:mm a")}.`
              : "This proposal was approved and scheduled for production."}
          </div>
        </div>
      )}

      {quotation.status === "REJECTED" && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center gap-3 text-destructive">
          <XCircle className="size-5 shrink-0" />
          <div className="text-xs">
            <span className="font-bold">Proposal Declined. </span>
            {quotation.rejectedAt
              ? `Declined on ${formatDate(quotation.rejectedAt, "dd MMM yyyy, hh:mm a")}.`
              : "This proposal was declined."}
          </div>
        </div>
      )}

      {/* Main Grid: Breakdown & Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Itemized Breakdown Table & Scope */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/70 shadow-xs overflow-hidden">
            <CardHeader className="border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Itemized Cost Breakdown
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Clear quantities, unit measurements, and rates as quoted by your producer.
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
                    <TableHead className="text-right text-xs">Unit Rate</TableHead>
                    <TableHead className="text-right text-xs">Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                        No line items listed in this quotation.
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

          {/* Terms & Notes */}
          {(quotation.terms || quotation.notes) && (
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  Terms & Conditions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
                {quotation.terms && (
                  <div>
                    <h4 className="font-semibold text-foreground text-[11px] uppercase tracking-wider mb-1">
                      Commercial Terms
                    </h4>
                    <p className="whitespace-pre-line p-3 rounded-lg bg-muted/40 border border-border/50">
                      {quotation.terms}
                    </p>
                  </div>
                )}
                {quotation.notes && (
                  <div>
                    <h4 className="font-semibold text-foreground text-[11px] uppercase tracking-wider mb-1">
                      Production Notes
                    </h4>
                    <p className="whitespace-pre-line p-3 rounded-lg bg-muted/40 border border-border/50">
                      {quotation.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Col: Financial Summary Card & Quotation Details */}
        <div className="space-y-6">
          <Card className="border-border/70 shadow-xs overflow-hidden">
            <CardHeader className="bg-muted/20 border-b border-border/60 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="size-4 text-primary" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium text-foreground font-mono">
                  {formatINR(quotation.subtotal)}
                </span>
              </div>

              {discountVal > 0 && (
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span>
                    Discount {isPercentageDiscount ? `(${discountVal}%)` : ""}
                  </span>
                  <span className="font-mono">
                    - {formatINR(isPercentageDiscount ? (Number(quotation.subtotal) * discountVal) / 100 : discountVal)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-muted-foreground">
                <span>Tax {taxRateVal > 0 ? `(${taxRateVal}% GST)` : ""}</span>
                <span className="font-mono">{formatINR(quotation.taxAmount)}</span>
              </div>

              <div className="pt-3 border-t-2 border-border/80 flex items-baseline justify-between">
                <div>
                  <span className="text-sm font-bold text-foreground">Grand Total</span>
                  <span className="block text-[10px] text-muted-foreground">Inclusive of applicable taxes</span>
                </div>
                <span className="text-xl font-extrabold text-foreground font-mono">
                  {formatINR(quotation.totalAmount)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Quotation Metadata Card */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-semibold">Proposal Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5 text-xs">
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground">Event Classification</span>
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3 text-primary" />
                  {quotation.eventType}
                </div>
              </div>

              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground">Proposal Date</span>
                <div className="font-medium text-foreground">
                  {formatDate(quotation.createdAt, "dd MMMM yyyy")}
                </div>
              </div>

              {quotation.validUntil && (
                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground">Valid Until</span>
                  <div className="font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Calendar className="size-3" />
                    {formatDate(quotation.validUntil, "dd MMMM yyyy")}
                  </div>
                </div>
              )}

              {quotation.venue && (
                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground">Proposed Venue</span>
                  <div className="font-medium text-foreground">
                    {quotation.venue}
                  </div>
                </div>
              )}

              {quotation.guestCount && (
                <div className="space-y-0.5">
                  <span className="text-[11px] text-muted-foreground">Expected Guests</span>
                  <div className="font-medium text-foreground">
                    {quotation.guestCount} guests
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal: Accept Quotation */}
      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="size-10 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center mb-2">
              <FileCheck className="size-5" />
            </div>
            <DialogTitle>Accept Event Quotation</DialogTitle>
            <DialogDescription className="text-xs">
              You are about to accept proposal <span className="font-mono font-semibold text-foreground">{quotation.quotationNumber}</span> for a total of <span className="font-bold text-foreground font-mono">{formatINR(quotation.totalAmount)}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3.5 rounded-lg bg-muted/40 border border-border/60 text-xs text-muted-foreground leading-relaxed">
            By accepting, you agree to the quoted line items and terms. Your coordinator will be notified immediately to prepare your event booking agreement.
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAcceptDialogOpen(false)}
              disabled={updateStatusMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAccept}
              disabled={updateStatusMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Confirm Acceptance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Modal: Reject Quotation */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="size-10 rounded-full bg-destructive/15 text-destructive flex items-center justify-center mb-2">
              <MessageSquare className="size-5" />
            </div>
            <DialogTitle>Decline Quotation Proposal</DialogTitle>
            <DialogDescription className="text-xs">
              Please share any feedback or changes needed (budget, items, timings) so your coordinator can submit a revised quote.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-medium text-foreground">
              Feedback / Revision Requests (Optional)
            </label>
            <Textarea
              placeholder="e.g. Budget is slightly high, can we modify lighting or adjust guest count?"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="text-xs min-h-[90px]"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectDialogOpen(false)}
              disabled={updateStatusMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleReject}
              disabled={updateStatusMutation.isPending}
              className="gap-1.5"
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <XCircle className="size-4" />
              )}
              Submit & Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
