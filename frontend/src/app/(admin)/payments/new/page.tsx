"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RotateCcw,
  User,
  CreditCard,
  FileText,
  Loader2,
  Info,
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatINR, formatDate, formatIndianPhone } from "@/lib/formatters";
import { useClients, useClient } from "@/features/clients/hooks/use-clients";
import {
  useClientPendingInvoices,
  useRecordPaymentMutation,
} from "@/features/payments/hooks/use-payments";
import type {
  PaymentMethod,
  PaymentType,
} from "@/types/models";
import type { ClientPendingInvoice } from "@/features/payments/schemas/payment.schema";
import { cn } from "@/lib/utils";

function PaymentWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryClientId = searchParams.get("clientId") || "";
  const queryInvoiceId = searchParams.get("invoiceId") || "";

  // Form State
  const [clientId, setClientId] = React.useState<string>(queryClientId);
  const [eventId, setEventId] = React.useState<string>("");
  const [amount, setAmount] = React.useState<string>("");
  const [paymentDate, setPaymentDate] = React.useState<string>(
    () => new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("UPI");
  const [paymentType, setPaymentType] = React.useState<PaymentType>("PARTIAL");
  const [transactionReference, setTransactionReference] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");

  // Map of invoiceId -> allocated amount string
  const [allocations, setAllocations] = React.useState<Record<string, string>>({});
  const prefillDoneRef = React.useRef(false);

  // Queries
  const { data: clientsData, isLoading: isLoadingClients } = useClients({ limit: 100 });
  const clients = clientsData?.clients ?? [];

  const { data: selectedClientDetail } = useClient(clientId);
  const clientEvents = selectedClientDetail?.event ?? [];

  const {
    data: pendingInvoices = [],
    isLoading: isLoadingInvoices,
  } = useClientPendingInvoices(clientId);

  const recordPaymentMutation = useRecordPaymentMutation();

  // Handle client selection change
  const handleClientChange = (newClientId: string) => {
    setClientId(newClientId);
    setEventId("");
    setAllocations({});
    prefillDoneRef.current = false;
  };

  // Pre-fill when query params match
  React.useEffect(() => {
    if (!prefillDoneRef.current && pendingInvoices.length > 0 && queryInvoiceId) {
      const targetInvoice = pendingInvoices.find((inv) => inv.id === queryInvoiceId);
      if (targetInvoice) {
        prefillDoneRef.current = true;
        const balanceNum = Number(targetInvoice.balanceAmount) || 0;
        setTimeout(() => {
          setAmount((prev) => (prev ? prev : balanceNum.toFixed(2)));
          setAllocations({ [targetInvoice.id]: balanceNum.toFixed(2) });
          if (targetInvoice.eventId) {
            setEventId(targetInvoice.eventId);
          }
        }, 0);
      }
    }
  }, [pendingInvoices, queryInvoiceId]);

  // Derived Calculations
  const numericAmount = parseFloat(amount) || 0;

  const totalAllocated = React.useMemo(() => {
    return Object.values(allocations).reduce((sum, val) => {
      const num = parseFloat(val) || 0;
      return sum + num;
    }, 0);
  }, [allocations]);

  const unallocatedAmount = React.useMemo(() => {
    const diff = numericAmount - totalAllocated;
    return Math.round(diff * 100) / 100;
  }, [numericAmount, totalAllocated]);

  const isOverAllocated = unallocatedAmount < -0.001;

  // Check individual invoice balance limits
  const rowErrors = React.useMemo(() => {
    const errors: Record<string, string> = {};
    for (const inv of pendingInvoices) {
      const allocatedNum = parseFloat(allocations[inv.id] || "0") || 0;
      const balanceNum = Number(inv.balanceAmount) || 0;
      if (allocatedNum > balanceNum + 0.001) {
        errors[inv.id] = `Exceeds balance due (${formatINR(balanceNum)})`;
      }
    }
    return errors;
  }, [allocations, pendingInvoices]);

  const hasRowErrors = Object.keys(rowErrors).length > 0;

  // Auto-Allocate: Cascades total payment amount to oldest invoices first
  const handleAutoAllocate = () => {
    if (numericAmount <= 0) {
      toast.error("Please enter a payment total amount greater than ₹0 first.");
      return;
    }

    // Sort invoices oldest first (by invoiceDate)
    const sortedInvoices = [...pendingInvoices].sort((a, b) => {
      return new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime();
    });

    let remaining = numericAmount;
    const newAllocations: Record<string, string> = {};

    for (const inv of sortedInvoices) {
      const balance = Number(inv.balanceAmount) || 0;
      if (remaining <= 0) {
        newAllocations[inv.id] = "0";
      } else {
        const canAllocate = Math.min(remaining, balance);
        newAllocations[inv.id] = canAllocate.toFixed(2);
        remaining = Math.max(0, remaining - canAllocate);
      }
    }

    setAllocations(newAllocations);
    toast.success("Payment automatically allocated across oldest invoices first.");
  };

  // Clear all allocations
  const handleClearAllocations = () => {
    const cleared: Record<string, string> = {};
    pendingInvoices.forEach((inv) => {
      cleared[inv.id] = "0";
    });
    setAllocations(cleared);
  };

  // Update allocation for a single row
  const handleAllocationChange = (invId: string, val: string) => {
    setAllocations((prev) => ({
      ...prev,
      [invId]: val,
    }));
  };

  // Quick Max Button for a row: Allocates either the remaining invoice balance or remaining unallocated funds
  const handleSetMax = (inv: ClientPendingInvoice) => {
    const balance = Number(inv.balanceAmount) || 0;
    const currentAlloc = parseFloat(allocations[inv.id] || "0") || 0;
    const availableTotal = unallocatedAmount + currentAlloc;
    const targetAlloc = Math.max(0, Math.min(balance, availableTotal));

    handleAllocationChange(inv.id, targetAlloc.toFixed(2));
  };

  // Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId) {
      toast.error("Please select a client account.");
      return;
    }

    if (numericAmount <= 0) {
      toast.error("Payment total amount must be greater than ₹0.");
      return;
    }

    if (isOverAllocated) {
      toast.error(
        `Total allocated amount (${formatINR(totalAllocated)}) exceeds payment total (${formatINR(numericAmount)}).`
      );
      return;
    }

    if (hasRowErrors) {
      toast.error("One or more allocations exceed the invoice balance due.");
      return;
    }

    // Prepare allocations payload (only positive allocations)
    const validAllocations = Object.entries(allocations)
      .map(([invoiceId, amtStr]) => ({
        invoiceId,
        amount: parseFloat(amtStr) || 0,
      }))
      .filter((item) => item.amount > 0);

    try {
      const result = await recordPaymentMutation.mutateAsync({
        clientId,
        eventId: eventId || null,
        amount: numericAmount,
        paymentDate: new Date(paymentDate),
        paymentMethod,
        paymentType,
        transactionReference: transactionReference.trim() || null,
        notes: notes.trim() || null,
        allocations: validAllocations,
      });

      toast.success(
        `Payment ${result.paymentNumber} of ${formatINR(result.amount)} recorded successfully.`
      );
      router.push(`/payments/${result.id}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to record payment.");
      } else {
        toast.error("Failed to record payment.");
      }
    }
  };

  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      {/* Top Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
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
              Record Client Payment
            </h1>
            <Badge variant="outline" className="text-xs">
              Remittance Wizard
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Capture remittance funds, update client ledger, and allocate across unpaid invoices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            render={<Link href="/payments" />}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={
              !clientId ||
              numericAmount <= 0 ||
              isOverAllocated ||
              hasRowErrors ||
              recordPaymentMutation.isPending
            }
            className="gap-1.5"
          >
            {recordPaymentMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Record Payment {numericAmount > 0 ? `(${formatINR(numericAmount)})` : ""}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Step 1: Client Selection */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
              1
            </div>
            <CardTitle className="text-sm font-semibold">Client Account</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Select the paying client to load pending balances and invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="space-y-1.5">
              <Label htmlFor="client-select" className="text-xs font-medium">
                Client Profile <span className="text-destructive">*</span>
              </Label>
              <select
                id="client-select"
                value={clientId}
                onChange={(e) => handleClientChange(e.target.value)}
                disabled={isLoadingClients}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">-- Choose a client account --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ""} {c.city ? `• ${c.city}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Client Card Details */}
            {selectedClient && (
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3 flex items-start gap-3 text-xs">
                <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <User className="size-4" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="font-semibold text-foreground truncate">
                    {selectedClient.name}
                  </div>
                  <div className="text-muted-foreground truncate">
                    {selectedClient.phone ? formatIndianPhone(selectedClient.phone) : "No phone"}
                    {selectedClient.email ? ` • ${selectedClient.email}` : ""}
                  </div>
                  {selectedClient.city && (
                    <div className="text-muted-foreground text-[11px] truncate">
                      {selectedClient.city}
                      {selectedClient.address ? `, ${selectedClient.address}` : ""}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Payment Details */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
              2
            </div>
            <CardTitle className="text-sm font-semibold">Payment Details</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Transaction amount, remittance channel, and reference voucher details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Total Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount" className="text-xs font-medium">
                Total Payment Amount (₹) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7 font-mono text-sm"
                  required
                />
              </div>
            </div>

            {/* Payment Date */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-date" className="text-xs font-medium">
                Payment Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-method" className="text-xs font-medium">
                Payment Method <span className="text-destructive">*</span>
              </Label>
              <select
                id="payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS / IMPS)</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Debit / Credit Card</option>
                <option value="CHEQUE">Cheque</option>
                <option value="OTHER">Other Remittance</option>
              </select>
            </div>

            {/* Payment Type */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-type" className="text-xs font-medium">
                Payment Classification
              </Label>
              <select
                id="payment-type"
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="PARTIAL">Partial Payment</option>
                <option value="FULL">Full Payment</option>
                <option value="ADVANCE">Advance Remittance</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Reference Number */}
            <div className="space-y-1.5">
              <Label htmlFor="transaction-reference" className="text-xs font-medium">
                Transaction Reference # / UTR
              </Label>
              <Input
                id="transaction-reference"
                type="text"
                placeholder="e.g. UTR12345678, UPI Ref #..."
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            {/* Associated Event */}
            <div className="space-y-1.5">
              <Label htmlFor="event-select" className="text-xs font-medium">
                Associated Event (Optional)
              </Label>
              <select
                id="event-select"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">-- No specific event --</option>
                {clientEvents.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.eventNumber} - {evt.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="payment-notes" className="text-xs font-medium">
              Internal Remittance Notes
            </Label>
            <Textarea
              id="payment-notes"
              rows={2}
              placeholder="e.g. Received via ICICI Current Account, client verified..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Multi-Invoice Payment Allocation */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  3
                </div>
                <CardTitle className="text-sm font-semibold">
                  Invoice Allocation Ledger
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Distribute remittance across client invoices with strict balance guardrails.
              </CardDescription>
            </div>

            {/* Allocation Quick Actions */}
            {clientId && pendingInvoices.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoAllocate}
                  className="text-xs h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                >
                  <Sparkles className="size-3.5" />
                  Auto-Allocate
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAllocations}
                  className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3.5" />
                  Clear
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!clientId ? (
            <div className="rounded-lg border border-dashed border-border/80 p-8 text-center bg-muted/10">
              <FileText className="size-8 text-muted-foreground mx-auto mb-2" />
              <div className="text-xs font-medium text-foreground">No Client Selected</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Select a client account in Step 1 to load unpaid invoices.
              </p>
            </div>
          ) : isLoadingInvoices ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : pendingInvoices.length === 0 ? (
            <div className="rounded-lg border border-border/70 bg-muted/20 p-6 text-center space-y-2">
              <Info className="size-6 text-primary mx-auto" />
              <div className="text-xs font-semibold text-foreground">
                No Pending Invoices for this Client
              </div>
              <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                All previous invoices for this client are settled or none exist yet. This payment will be recorded as an unallocated advance credit on their account.
              </p>
            </div>
          ) : (
            <>
              {/* Allocation Guardrail Live Banner */}
              <div
                className={cn(
                  "rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors",
                  isOverAllocated
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : totalAllocated === numericAmount && numericAmount > 0
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                    : "border-border/70 bg-muted/30 text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  {isOverAllocated ? (
                    <AlertCircle className="size-4 shrink-0 text-destructive" />
                  ) : totalAllocated === numericAmount && numericAmount > 0 ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <CreditCard className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div>
                    <span className="font-semibold">
                      Total Allocated: {formatINR(totalAllocated)}
                    </span>
                    <span className="mx-1.5 opacity-60">/</span>
                    <span>Payment: {formatINR(numericAmount)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono">
                  {isOverAllocated ? (
                    <Badge variant="destructive" className="text-[11px]">
                      Over-allocated by {formatINR(Math.abs(unallocatedAmount))}
                    </Badge>
                  ) : unallocatedAmount > 0 ? (
                    <Badge
                      variant="outline"
                      className="text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-medium"
                    >
                      Unallocated: {formatINR(unallocatedAmount)} (Advance Credit)
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[11px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-medium"
                    >
                      100% Fully Allocated
                    </Badge>
                  )}
                </div>
              </div>

              {/* Invoices Allocation Table */}
              <div className="rounded-lg border border-border/70 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs">Invoice #</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs text-right">Total (₹)</TableHead>
                      <TableHead className="text-xs text-right">Paid (₹)</TableHead>
                      <TableHead className="text-xs text-right font-semibold">Balance Due</TableHead>
                      <TableHead className="text-xs text-right min-w-[180px]">
                        Allocated Amount (₹)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvoices.map((inv) => {
                      const totalNum = Number(inv.totalAmount) || 0;
                      const paidNum = Number(inv.paidAmount) || 0;
                      const balanceNum = Number(inv.balanceAmount) || 0;
                      const currentAlloc = allocations[inv.id] || "";
                      const rowError = rowErrors[inv.id];

                      return (
                        <TableRow key={inv.id} className="hover:bg-muted/20">
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-mono text-xs font-semibold text-foreground">
                                {inv.invoiceNumber}
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                                {inv.title}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(inv.invoiceDate)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-right text-foreground">
                            {formatINR(totalNum)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-right text-muted-foreground">
                            {formatINR(paidNum)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-right font-semibold text-amber-600 dark:text-amber-400">
                            {formatINR(balanceNum)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="relative w-32">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-mono text-muted-foreground">
                                  ₹
                                </span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={balanceNum}
                                  placeholder="0.00"
                                  value={currentAlloc}
                                  onChange={(e) =>
                                    handleAllocationChange(inv.id, e.target.value)
                                  }
                                  className={cn(
                                    "h-8 pl-5 pr-1 text-right font-mono text-xs",
                                    rowError && "border-destructive focus-visible:ring-destructive"
                                  )}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={() => handleSetMax(inv)}
                                className="text-[10px] h-8 px-2 font-mono shrink-0"
                                title="Allocate full balance or remaining payment"
                              >
                                Max
                              </Button>
                            </div>
                            {rowError && (
                              <div className="text-[10px] text-destructive mt-1 text-right font-medium">
                                {rowError}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Bottom Sticky Action Bar */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-border/70 bg-card shadow-xs">
        <div className="text-xs text-muted-foreground">
          {numericAmount > 0 ? (
            <>
              Recording remittance voucher of{" "}
              <span className="font-mono font-semibold text-foreground">
                {formatINR(numericAmount)}
              </span>{" "}
              for{" "}
              <span className="font-medium text-foreground">
                {selectedClient?.name || "selected client"}
              </span>
            </>
          ) : (
            "Enter total payment amount and allocations above to proceed."
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            render={<Link href="/payments" />}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={
              !clientId ||
              numericAmount <= 0 ||
              isOverAllocated ||
              hasRowErrors ||
              recordPaymentMutation.isPending
            }
            className="gap-1.5"
          >
            {recordPaymentMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Recording Payment...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Record Payment
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

export default function RecordPaymentPage() {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-6 max-w-5xl">
          <div className="h-10 w-64 bg-muted rounded animate-pulse" />
          <div className="h-40 w-full bg-muted rounded animate-pulse" />
          <div className="h-64 w-full bg-muted rounded animate-pulse" />
        </div>
      }
    >
      <PaymentWizardContent />
    </React.Suspense>
  );
}
