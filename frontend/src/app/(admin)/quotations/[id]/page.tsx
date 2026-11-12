"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Printer,
  Sparkles,
  Send,
  CheckCircle2,
  XCircle,
  Ban,
  Trash2,
  Phone,
  Mail,
  MapPin,
  FileText,
  ArrowRight,
  Loader2,
  RotateCcw,
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import {
  useQuotation,
  useUpdateQuotationStatusMutation,
  useDeleteQuotationMutation,
} from "@/features/quotations/hooks/use-quotations";
import { ConvertToEventDialog } from "@/features/quotations/components/convert-to-event-dialog";
import { formatINR, formatDate, formatIndianPhone } from "@/lib/formatters";
import type { QuotationStatusType } from "@/features/quotations/schemas/quotation.schema";
import { useSetBreadcrumbTitle } from "@/store/breadcrumb-store";

export default function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const router = useRouter();

  // Queries & Mutations
  const { data: quotation, isLoading, isError, error, refetch } = useQuotation(id);
  useSetBreadcrumbTitle(quotation ? `Quotation #${quotation.quotationNumber}` : null);
  const statusMutation = useUpdateQuotationStatusMutation();
  const deleteMutation = useDeleteQuotationMutation();

  // Dialog States
  const [convertDialogOpen, setConvertDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [transitionState, setTransitionState] = React.useState<{
    targetStatus: QuotationStatusType;
    title: string;
    description: string;
    requireNote?: boolean;
  } | null>(null);
  const [statusNote, setStatusNote] = React.useState("");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 pb-2 border-b border-border/60">
          <Skeleton className="size-8 rounded-md" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <div className="lg:col-span-4 space-y-4">
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !quotation) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-xl border-border/80 bg-muted/10 space-y-3">
        <div className="size-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <Ban className="size-5" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          Quotation Not Found
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          {error?.message || "The requested quotation could not be retrieved from the server."}
        </p>
        <Button size="sm" variant="outline" render={<Link href="/quotations" />}>
          <ArrowLeft className="size-4 mr-1.5" /> Back to Quotations
        </Button>
      </div>
    );
  }

  const isConverted = Boolean(quotation.event && quotation.event.length > 0);
  const linkedEvent = quotation.event?.[0];

  // Status transition execution
  const executeStatusTransition = async (targetStatus: QuotationStatusType, notes?: string) => {
    try {
      await statusMutation.mutateAsync({
        id: quotation.id,
        data: {
          status: targetStatus,
          notes: notes?.trim() || null,
        },
      });
      toast.success(`Quotation transitioned to status "${targetStatus}"`);
      setTransitionState(null);
      setStatusNote("");
      refetch();
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to update quotation status");
      } else {
        toast.error("Failed to update quotation status");
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(quotation.id);
      toast.success(`Quotation #${quotation.quotationNumber} deleted successfully`);
      router.push("/quotations");
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to delete quotation");
      } else {
        toast.error("Failed to delete quotation");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div className="flex items-center gap-3">
          <Button
            size="icon-sm"
            variant="ghost"
            className="size-8"
            render={<Link href="/quotations" />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
                #{quotation.quotationNumber}
              </h1>
              <StatusBadge type="quotation" status={quotation.status} />
              {isConverted && (
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[11px] gap-1">
                  <CheckCircle2 className="size-3" />
                  Event Created
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {quotation.title} • Created {formatDate(quotation.createdAt, "dd MMM yyyy, hh:mm a")}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Print Button */}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-8"
            onClick={() => window.print()}
          >
            <Printer className="size-3.5" />
            Print
          </Button>

          {/* DRAFT -> SENT */}
          {quotation.status === "DRAFT" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-8 text-sky-600 border-sky-500/30 hover:bg-sky-500/10"
              disabled={statusMutation.isPending}
              onClick={() =>
                setTransitionState({
                  targetStatus: "SENT",
                  title: "Mark Quotation as Sent?",
                  description:
                    "This will transition the quotation to SENT and make it visible to the client in their self-service portal.",
                })
              }
            >
              <Send className="size-3.5" />
              Mark as Sent
            </Button>
          )}

          {/* SENT or VIEWED -> ACCEPT or REJECT */}
          {(quotation.status === "SENT" || quotation.status === "VIEWED") && (
            <>
              <Button
                size="sm"
                className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={statusMutation.isPending}
                onClick={() =>
                  setTransitionState({
                    targetStatus: "ACCEPTED",
                    title: "Accept Quotation?",
                    description:
                      "Record that the client has formally approved this quotation and agreed to the pricing and commercial terms.",
                  })
                }
              >
                <CheckCircle2 className="size-3.5" />
                Accept
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-8 text-rose-600 border-rose-500/30 hover:bg-rose-500/10"
                disabled={statusMutation.isPending}
                onClick={() =>
                  setTransitionState({
                    targetStatus: "REJECTED",
                    title: "Reject Quotation?",
                    description:
                      "Record that this quotation was declined. You can supply feedback or rejection reasons in the notes.",
                    requireNote: true,
                  })
                }
              >
                <XCircle className="size-3.5" />
                Reject
              </Button>
            </>
          )}

          {/* ACCEPTED -> CONVERT TO EVENT */}
          {quotation.status === "ACCEPTED" && !isConverted && (
            <Button
              size="sm"
              className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold"
              onClick={() => setConvertDialogOpen(true)}
            >
              <Sparkles className="size-3.5" />
              + Convert to Event
            </Button>
          )}

          {/* REJECTED or EXPIRED -> REOPEN TO DRAFT */}
          {(quotation.status === "REJECTED" || quotation.status === "EXPIRED") && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-8"
              disabled={statusMutation.isPending}
              onClick={() =>
                setTransitionState({
                  targetStatus: "DRAFT",
                  title: "Reopen Quotation as Draft?",
                  description:
                    "This returns the quotation to DRAFT status so you can adjust line items and send an updated version to the client.",
                })
              }
            >
              <RotateCcw className="size-3.5" />
              Reopen as Draft
            </Button>
          )}

          {/* CANCEL ACTION (allowed unless ACCEPTED or CANCELLED) */}
          {quotation.status !== "CANCELLED" && quotation.status !== "ACCEPTED" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-destructive"
              disabled={statusMutation.isPending}
              onClick={() =>
                setTransitionState({
                  targetStatus: "CANCELLED",
                  title: "Cancel Quotation?",
                  description:
                    "Mark this estimate as cancelled. This is a terminal state.",
                  requireNote: true,
                })
              }
            >
              <Ban className="size-3.5" />
              Cancel
            </Button>
          )}

          {/* DELETE BUTTON (only if not converted) */}
          {!isConverted && (
            <Button
              size="sm"
              variant="ghost"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
              title="Delete Quotation"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Linked Event Banner */}
      {isConverted && linkedEvent && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-950 dark:text-emerald-200">
                Converted to Confirmed Event #{linkedEvent.eventNumber}
              </p>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                {linkedEvent.title} • Status: {linkedEvent.status}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 self-start sm:self-auto"
            render={<Link href={`/events/${linkedEvent.id}`} />}
          >
            Go to Event Operations
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Main Grid: Details + Line Items (Left 8 Cols) and Financial Breakdown (Right 4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Client & Event Info Card */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Quotation Particulars
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              {/* Client Details Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold block">
                    Client Details
                  </span>
                  {quotation.client ? (
                    <div className="space-y-0.5">
                      <Link
                        href={`/clients/${quotation.client.id}`}
                        className="font-semibold text-foreground hover:text-primary transition-colors text-sm"
                      >
                        {quotation.client.name}
                      </Link>
                      <div className="flex items-center gap-1.5 text-muted-foreground font-mono">
                        <Phone className="size-3" />
                        <span>{formatIndianPhone(quotation.client.phone)}</span>
                      </div>
                      {quotation.client.email && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="size-3" />
                          <span>{quotation.client.email}</span>
                        </div>
                      )}
                      {(quotation.client.city || quotation.client.address) && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="size-3" />
                          <span>
                            {[quotation.client.address, quotation.client.city]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="italic text-muted-foreground">No client record</span>
                  )}
                </div>

                {/* Event Schedule & Logistics Section */}
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold block">
                    Event Logistics
                  </span>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Event Type:</span>
                      <span className="font-medium text-foreground capitalize">
                        {quotation.eventType}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Planned Date:</span>
                      <span className="font-medium text-foreground">
                        {formatDate(quotation.eventDate, "dd MMM yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Venue:</span>
                      <span className="font-medium text-foreground">
                        {quotation.venue || "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Guest Count:</span>
                      <span className="font-mono font-medium text-foreground">
                        {quotation.guestCount ? `${quotation.guestCount} guests` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Valid Until:</span>
                      <span className="font-medium text-foreground">
                        {formatDate(quotation.validUntil, "dd MMM yyyy")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Itemized Line Items Table */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Itemized Cost Breakdown
                  </CardTitle>
                  <CardDescription className="text-xs">
                    List of billable supplies, stage decor, audio-visual rentals, and event services.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {quotation.items?.length ?? 0} Items
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-2.5 px-3 w-10">#</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-center">Unit</th>
                      <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                      <th className="py-2.5 px-4 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {(quotation.items ?? []).map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 text-muted-foreground font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-foreground">
                            {item.itemName}
                          </div>
                          {item.description && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-foreground">
                          {Number(item.quantity)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground">
                          {item.unit || "nos"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground">
                          {formatINR(item.unitPrice)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-foreground">
                          {formatINR(item.totalPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Notes & Terms */}
          {(quotation.notes || quotation.terms) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {quotation.notes && (
                <Card className="border-border/70 shadow-xs">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Scope & Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                      {quotation.notes}
                    </p>
                  </CardContent>
                </Card>
              )}

              {quotation.terms && (
                <Card className="border-border/70 shadow-xs">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Commercial Terms & Milestones
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                      {quotation.terms}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Financial Card (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-border/70 shadow-sm bg-card overflow-hidden">
            <CardHeader className="bg-muted/40 pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-semibold">
                Financial Summary
              </CardTitle>
              <CardDescription className="text-xs">
                Line charges, applied discount, and GST tax computation.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3.5 pt-4 text-xs">
              {/* Subtotal */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono font-semibold text-foreground">
                  {formatINR(quotation.subtotal)}
                </span>
              </div>

              {/* Discount */}
              {Number(quotation.discountValue) > 0 && (
                <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                  <span>
                    Discount (
                    {quotation.discountType === "PERCENTAGE"
                      ? `${quotation.discountValue}%`
                      : "Fixed"}
                    )
                  </span>
                  <span className="font-mono font-semibold">
                    - {formatINR(
                      quotation.discountType === "PERCENTAGE"
                        ? (Number(quotation.subtotal) * Number(quotation.discountValue)) / 100
                        : quotation.discountValue
                    )}
                  </span>
                </div>
              )}

              <Separator />

              {/* Tax Rate & Amount */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  GST Tax ({Number(quotation.taxRate)}%)
                </span>
                <span className="font-mono font-semibold text-foreground">
                  + {formatINR(quotation.taxAmount)}
                </span>
              </div>

              <Separator />

              {/* Grand Total */}
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 space-y-1 text-center">
                <span className="text-[11px] font-medium text-primary uppercase tracking-wider">
                  Grand Total
                </span>
                <div className="text-2xl font-bold font-mono text-primary tracking-tight">
                  {formatINR(quotation.totalAmount)}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Net total payable by client
                </p>
              </div>

              {/* Prominent Action Button: Convert to Event */}
              {quotation.status === "ACCEPTED" && !isConverted && (
                <Button
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                  onClick={() => setConvertDialogOpen(true)}
                >
                  <Sparkles className="size-4" />
                  Convert to Event Now
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Convert to Event Dialog */}
      <ConvertToEventDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        quotation={quotation}
        onSuccess={(eventId) => {
          setConvertDialogOpen(false);
          refetch();
          router.push(`/events/${eventId}`);
        }}
      />

      {/* Status Transition Reason Dialog */}
      <Dialog
        open={Boolean(transitionState)}
        onOpenChange={(open) => {
          if (!open) {
            setTransitionState(null);
            setStatusNote("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {transitionState?.title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {transitionState?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="status-note" className="text-xs font-medium">
              Reason / Status Audit Note{" "}
              {transitionState?.requireNote ? (
                <span className="text-destructive">*</span>
              ) : (
                <span className="text-muted-foreground">(Optional)</span>
              )}
            </Label>
            <Textarea
              id="status-note"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="Provide context or notes regarding this decision..."
              rows={3}
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTransitionState(null);
                setStatusNote("");
              }}
              disabled={statusMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={
                statusMutation.isPending ||
                (transitionState?.requireNote && !statusNote.trim())
              }
              onClick={() => {
                if (transitionState) {
                  executeStatusTransition(transitionState.targetStatus, statusNote);
                }
              }}
            >
              {statusMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Updating...
                </>
              ) : (
                "Confirm Transition"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete Quotation #${quotation.quotationNumber}?`}
        description="This will permanently delete the quotation record. If it has been converted to an event, deletion will be rejected by the server."
        confirmText="Delete Quotation"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
