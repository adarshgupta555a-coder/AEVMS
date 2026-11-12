"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Calculator,
  Loader2,
  Receipt,
  User,
  Layers,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useClients } from "@/features/clients/hooks/use-clients";
import { useEvents } from "@/features/events/hooks/use-events";
import { useCreateInvoiceMutation } from "@/features/invoices/hooks/use-invoices";
import {
  calculateInvoiceTotals,
  calculateItemTotal,
} from "@/features/invoices/utils/math";
import type {
  CreateInvoiceInput,
  InvoiceTypeEnum,
} from "@/features/invoices/schemas/invoice.schema";
import { formatINR } from "@/lib/formatters";

interface LineItemFormItem {
  itemName: string;
  description?: string;
  type: InvoiceTypeEnum;
  quantity: number | string;
  unit?: string;
  unitPrice: number | string;
  advanceAdjusted: number | string;
}

interface InvoiceFormValues {
  clientId: string;
  eventId?: string;
  title: string;
  invoiceDate: string;
  dueDate?: string;
  discountType: "NONE" | "PERCENTAGE" | "FIXED";
  discountValue: number | string;
  taxRate: number | string;
  notes?: string;
  terms?: string;
  items: LineItemFormItem[];
}

const DEFAULT_LINE_ITEM: LineItemFormItem = {
  itemName: "",
  description: "",
  type: "FINAL",
  quantity: 1,
  unit: "nos",
  unitPrice: 0,
  advanceAdjusted: 0,
};

const COMMON_UNITS = [
  "nos",
  "hours",
  "days",
  "plates",
  "sets",
  "lump sum",
  "sq.ft",
  "units",
];

const TAX_PRESETS = [
  { label: "0% (Exempt)", value: 0 },
  { label: "5% GST", value: 5 },
  { label: "12% GST", value: 12 },
  { label: "18% GST (Standard)", value: 18 },
  { label: "28% GST", value: 28 },
];

export default function CreateInvoicePage() {
  const router = useRouter();

  // Today's date as default (YYYY-MM-DD)
  const todayStr = React.useMemo(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  }, []);

  // Due date default (14 days from today)
  const defaultDueDateStr = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  }, []);

  // React Hook Form initialization
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<InvoiceFormValues>({
    defaultValues: {
      clientId: "",
      eventId: "",
      title: "",
      invoiceDate: todayStr,
      dueDate: defaultDueDateStr,
      discountType: "NONE",
      discountValue: 0,
      taxRate: 18,
      notes:
        "Payment is due within the stipulated period. Please quote the invoice number on your bank transfer.",
      terms:
        "1. Goods and services supplied are subject to terms agreed upon.\n2. Overdue balances incur interest at 18% per annum.\n3. Make all payments in favor of EMS Events Private Limited.",
      items: [
        {
          itemName: "Event Production & Staging",
          description: "Stage setup, audio-visual system, and ambient lighting.",
          type: "FINAL",
          quantity: 1,
          unit: "set",
          unitPrice: 50000,
          advanceAdjusted: 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  // Queries & Mutations
  const { data: clientsData, isLoading: isLoadingClients } = useClients({
    limit: 100,
  });
  const clients = React.useMemo(
    () => clientsData?.clients ?? [],
    [clientsData?.clients]
  );

  const selectedClientId = useWatch({ control, name: "clientId" });
  const selectedEventId = useWatch({ control, name: "eventId" });
  const watchedItems = useWatch({ control, name: "items" });
  const watchedDiscountType = useWatch({ control, name: "discountType" });
  const watchedDiscountValue = useWatch({ control, name: "discountValue" });
  const watchedTaxRate = useWatch({ control, name: "taxRate" });

  const selectedClient = React.useMemo(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  // Filter events by selected client
  const { data: eventsData, isLoading: isLoadingEvents } = useEvents(
    selectedClientId
      ? { clientId: selectedClientId, limit: 100 }
      : { limit: 100 }
  );
  const events = React.useMemo(
    () => eventsData?.events ?? [],
    [eventsData?.events]
  );

  const selectedEvent = React.useMemo(
    () => events.find((e) => e.id === selectedEventId),
    [events, selectedEventId]
  );

  // If selectedClientId changes and previously selected event doesn't belong to client, reset eventId
  React.useEffect(() => {
    if (selectedClientId && events.length > 0) {
      const currentEventId = getValues("eventId");
      if (currentEventId) {
        const belongs = events.some((e) => e.id === currentEventId);
        if (!belongs) {
          setValue("eventId", "");
        }
      }
    }
  }, [selectedClientId, events, setValue, getValues]);

  const createMutation = useCreateInvoiceMutation();

  const totals = React.useMemo(() => {
    const discType =
      watchedDiscountType === "NONE" ? null : watchedDiscountType;
    return calculateInvoiceTotals({
      items: watchedItems || [],
      discountType: discType,
      discountValue: watchedDiscountValue,
      taxRate: watchedTaxRate,
    });
  }, [watchedItems, watchedDiscountType, watchedDiscountValue, watchedTaxRate]);

  // Submit Handler
  const onSubmit = async (values: InvoiceFormValues) => {
    if (!values.items || values.items.length === 0) {
      toast.error("Please add at least one line item to the invoice");
      return;
    }

    if (values.dueDate && values.invoiceDate) {
      if (new Date(values.dueDate) < new Date(values.invoiceDate)) {
        toast.error("Due date cannot be earlier than invoice date");
        return;
      }
    }

    try {
      const sanitizedItems = values.items.map((item, idx) => ({
        itemName: item.itemName.trim(),
        description: item.description?.trim() || null,
        type: item.type || "FINAL",
        quantity: Math.max(0.01, Number(item.quantity) || 1),
        unit: item.unit?.trim() || null,
        unitPrice: Math.max(0, Number(item.unitPrice) || 0),
        advanceAdjusted: Math.max(0, Number(item.advanceAdjusted) || 0),
        sortOrder: idx,
      }));

      const payload: CreateInvoiceInput = {
        clientId: values.clientId,
        eventId: values.eventId ? values.eventId : null,
        title: values.title.trim(),
        invoiceDate: new Date(values.invoiceDate),
        dueDate: values.dueDate ? new Date(values.dueDate) : null,
        discountType:
          values.discountType === "NONE" ? null : values.discountType,
        discountValue:
          values.discountType === "NONE"
            ? 0
            : Math.max(0, Number(values.discountValue) || 0),
        taxRate: Math.max(0, Math.min(100, Number(values.taxRate) || 0)),
        notes: values.notes?.trim() || null,
        terms: values.terms?.trim() || null,
        items: sanitizedItems,
      };

      const newInvoice = await createMutation.mutateAsync(payload);
      toast.success(
        `Invoice #${newInvoice.invoiceNumber} created successfully!`
      );
      router.push(`/invoices/${newInvoice.id}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to create invoice");
      } else {
        toast.error("Failed to create invoice");
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Breadcrumb & Header */}
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
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Create Invoice
              </h1>
              <Badge variant="outline" className="text-xs">
                New Invoice
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Draft a formal tax or proforma invoice with line-item itemization and advance adjustments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/invoices")}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            type="submit"
            form="invoice-form"
            disabled={createMutation.isPending}
            className="gap-1.5"
          >
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Receipt className="size-4" />
            )}
            Save & Generate Invoice
          </Button>
        </div>
      </div>

      <form id="invoice-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* General Information Card */}
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <User className="size-4 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    Client & Event Association
                  </CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Link this invoice to an existing registered client and optional event.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Client Selector */}
                  <div className="space-y-1.5">
                    <Label htmlFor="clientId" className="text-xs font-medium">
                      Select Client <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={selectedClientId || ""}
                      onValueChange={(val) => {
                        setValue("clientId", val || "", { shouldValidate: true });
                      }}
                      disabled={isLoadingClients}
                    >
                      <SelectTrigger id="clientId" className="h-9 text-xs">
                        <SelectValue
                          placeholder={
                            isLoadingClients
                              ? "Loading clients..."
                              : "Choose a client..."
                          }
                        >
                          {selectedClient
                            ? `${selectedClient.name}${selectedClient.city ? ` (${selectedClient.city})` : ""}`
                            : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem
                            key={client.id}
                            value={client.id}
                            label={`${client.name}${client.city ? ` (${client.city})` : ""}`}
                            className="text-xs"
                          >
                            <span className="font-medium">{client.name}</span>
                            {client.city && (
                              <span className="text-muted-foreground ml-1.5">
                                ({client.city})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.clientId && (
                      <p className="text-[11px] text-destructive">
                        {errors.clientId.message || "Client is required"}
                      </p>
                    )}
                  </div>

                  {/* Event Selector (Optional, filtered) */}
                  <div className="space-y-1.5">
                    <Label htmlFor="eventId" className="text-xs font-medium">
                      Linked Event (Optional)
                    </Label>
                    <Select
                      value={selectedEventId || "NONE"}
                      onValueChange={(val) => {
                        setValue("eventId", val === "NONE" || !val ? "" : val);
                      }}
                      disabled={isLoadingEvents}
                    >
                      <SelectTrigger id="eventId" className="h-9 text-xs">
                        <SelectValue placeholder="Direct Billing / No Event">
                          {selectedEvent
                            ? `${selectedEvent.title} (${selectedEvent.eventNumber})`
                            : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          value="NONE"
                          label="Direct Billing (No Linked Event)"
                          className="text-xs"
                        >
                          Direct Billing (No Linked Event)
                        </SelectItem>
                        {events.map((event) => (
                          <SelectItem
                            key={event.id}
                            value={event.id}
                            label={`${event.title} (${event.eventNumber})`}
                            className="text-xs"
                          >
                            <span className="font-medium">{event.title}</span>
                            <span className="text-muted-foreground ml-1.5 font-mono text-[10px]">
                              ({event.eventNumber})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Invoice Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-xs font-medium">
                    Invoice Subject / Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    placeholder="e.g. Wedding Decor & Lighting - Stage 1 Settlement"
                    className="h-9 text-xs"
                    {...register("title", {
                      required: "Invoice title is required",
                      minLength: {
                        value: 2,
                        message: "Title must be at least 2 characters",
                      },
                    })}
                  />
                  {errors.title && (
                    <p className="text-[11px] text-destructive">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                {/* Date Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="invoiceDate" className="text-xs font-medium">
                      Issue Date <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="invoiceDate"
                      type="date"
                      className="h-9 text-xs"
                      {...register("invoiceDate", {
                        required: "Issue date is required",
                      })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="dueDate" className="text-xs font-medium">
                      Payment Due Date
                    </Label>
                    <Input
                      id="dueDate"
                      type="date"
                      className="h-9 text-xs"
                      {...register("dueDate")}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items Card */}
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <div>
                  <div className="flex items-center gap-2">
                    <Layers className="size-4 text-primary" />
                    <CardTitle className="text-base font-semibold">
                      Line Items & Charges
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    Itemize products, staging services, advance deduction offsets, and rates.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-8"
                  onClick={() => append(DEFAULT_LINE_ITEM)}
                >
                  <Plus className="size-3.5" />
                  Add Line Item
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {fields.map((field, index) => {
                  const qty = Number(watchedItems?.[index]?.quantity) || 0;
                  const price = Number(watchedItems?.[index]?.unitPrice) || 0;
                  const lineTotal = calculateItemTotal(qty, price);

                  return (
                    <div
                      key={field.id}
                      className="p-3.5 border border-border/80 rounded-lg bg-card/60 space-y-3 relative group transition-colors hover:border-border"
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-border/40">
                        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                          Item #{index + 1}
                        </span>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-semibold text-foreground">
                            Total: {formatINR(lineTotal)}
                          </span>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="size-3.5" />
                              <span className="sr-only">Remove item</span>
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                        {/* Item Name */}
                        <div className="sm:col-span-5 space-y-1">
                          <Label className="text-[11px] font-medium text-muted-foreground">
                            Item / Service Name *
                          </Label>
                          <Input
                            placeholder="e.g. Staging & Stage Truss"
                            className="h-8 text-xs"
                            {...register(`items.${index}.itemName` as const, {
                              required: "Required",
                            })}
                          />
                        </div>

                        {/* Description */}
                        <div className="sm:col-span-5 space-y-1">
                          <Label className="text-[11px] font-medium text-muted-foreground">
                            Description
                          </Label>
                          <Input
                            placeholder="Optional technical specifications..."
                            className="h-8 text-xs"
                            {...register(`items.${index}.description` as const)}
                          />
                        </div>

                        {/* Item Type (PROFORMA / FINAL) */}
                        <div className="sm:col-span-2 space-y-1">
                          <Label className="text-[11px] font-medium text-muted-foreground">
                            Type
                          </Label>
                          <Select
                            value={watchedItems?.[index]?.type || "FINAL"}
                            onValueChange={(val) =>
                              setValue(`items.${index}.type` as const, val as InvoiceTypeEnum)
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PROFORMA" className="text-xs">
                                Proforma
                              </SelectItem>
                              <SelectItem value="FINAL" className="text-xs">
                                Final
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                        {/* Quantity */}
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium text-muted-foreground">
                            Qty *
                          </Label>
                          <Input
                            type="number"
                            step="any"
                            min="0.01"
                            placeholder="1"
                            className="h-8 text-xs"
                            {...register(`items.${index}.quantity` as const, {
                              required: true,
                              valueAsNumber: true,
                            })}
                          />
                        </div>

                        {/* Unit */}
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium text-muted-foreground">
                            Unit
                          </Label>
                          <Input
                            placeholder="nos / set / days"
                            list={`units-list-${index}`}
                            className="h-8 text-xs"
                            {...register(`items.${index}.unit` as const)}
                          />
                          <datalist id={`units-list-${index}`}>
                            {COMMON_UNITS.map((u) => (
                              <option key={u} value={u} />
                            ))}
                          </datalist>
                        </div>

                        {/* Unit Price */}
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium text-muted-foreground">
                            Unit Price (₹) *
                          </Label>
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0"
                            className="h-8 text-xs"
                            {...register(`items.${index}.unitPrice` as const, {
                              required: true,
                              valueAsNumber: true,
                            })}
                          />
                        </div>

                        {/* Advance Adjusted */}
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium text-muted-foreground">
                            Advance Offset (₹)
                          </Label>
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0"
                            className="h-8 text-xs"
                            {...register(
                              `items.${index}.advanceAdjusted` as const,
                              {
                                valueAsNumber: true,
                              }
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Notes & Terms */}
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  Notes & Legal Terms
                </CardTitle>
                <CardDescription className="text-xs">
                  Printed directly onto the formal PDF invoice layout.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-xs font-medium">
                    Invoice Notes
                  </Label>
                  <Textarea
                    id="notes"
                    rows={2}
                    placeholder="Add special banking instructions or delivery notes..."
                    className="text-xs resize-y"
                    {...register("notes")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="terms" className="text-xs font-medium">
                    Terms & Conditions
                  </Label>
                  <Textarea
                    id="terms"
                    rows={3}
                    placeholder="Payment terms, interest on overdue payments, tax clauses..."
                    className="text-xs resize-y"
                    {...register("terms")}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Pricing Engine & Summary (1 col) */}
          <div className="space-y-6">
            {/* Tax Engine & Adjustments Card */}
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Calculator className="size-4 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    Tax & Discount Engine
                  </CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Apply GST tax brackets and trade discounts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Discount Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Discount Type</Label>
                  <Select
                    value={watchedDiscountType}
                    onValueChange={(val) =>
                      setValue("discountType", val as "NONE" | "PERCENTAGE" | "FIXED")
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE" className="text-xs">
                        No Discount
                      </SelectItem>
                      <SelectItem value="PERCENTAGE" className="text-xs">
                        Percentage (%)
                      </SelectItem>
                      <SelectItem value="FIXED" className="text-xs">
                        Fixed Rupee (₹)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Discount Value */}
                {watchedDiscountType !== "NONE" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      {watchedDiscountType === "PERCENTAGE"
                        ? "Discount Percentage (%)"
                        : "Discount Value (₹)"}
                    </Label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      className="h-9 text-xs"
                      {...register("discountValue", { valueAsNumber: true })}
                    />
                  </div>
                )}

                {/* Tax Rate (GST Presets) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    GST Tax Bracket ({watchedTaxRate}%)
                  </Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TAX_PRESETS.map((preset) => (
                      <Button
                        key={preset.value}
                        type="button"
                        variant={
                          Number(watchedTaxRate) === preset.value
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        className="text-[11px] h-8 px-2"
                        onClick={() => setValue("taxRate", preset.value)}
                      >
                        {preset.label.split(" ")[0]}
                      </Button>
                    ))}
                  </div>
                  <div className="pt-1">
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      placeholder="Custom tax rate %"
                      className="h-8 text-xs"
                      {...register("taxRate", { valueAsNumber: true })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Live Financial Summary Card */}
            <Card className="border-border/80 shadow-sm bg-card sticky top-20">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span>Live Calculations</span>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    Real-Time
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4 text-xs">
                {/* Gross Subtotal */}
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Gross Subtotal</span>
                  <span className="font-mono font-medium text-foreground">
                    {formatINR(totals.grossSubtotal)}
                  </span>
                </div>

                {/* Advance Adjusted */}
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Advance Offset</span>
                  <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    -{formatINR(totals.advanceAdjustedTotal)}
                  </span>
                </div>

                {/* Discount */}
                {totals.discountAmount > 0 && (
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Discount</span>
                    <span className="font-mono font-medium text-rose-600 dark:text-rose-400">
                      -{formatINR(totals.discountAmount)}
                    </span>
                  </div>
                )}

                {/* Taxable Subtotal */}
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Taxable Subtotal</span>
                  <span className="font-mono font-medium text-foreground">
                    {formatINR(totals.taxableSubtotal)}
                  </span>
                </div>

                {/* Tax Amount */}
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Tax ({totals.taxRate}%)</span>
                  <span className="font-mono font-medium text-foreground">
                    +{formatINR(totals.taxAmount)}
                  </span>
                </div>

                <Separator className="my-2" />

                {/* Grand Total */}
                <div className="flex justify-between items-center text-sm font-semibold text-foreground">
                  <span>Grand Total</span>
                  <span className="font-mono text-base font-bold text-primary">
                    {formatINR(totals.grandTotal)}
                  </span>
                </div>

                {/* Net Balance Due */}
                <div className="p-3 bg-muted/40 rounded-lg border border-border/80 mt-2 space-y-1">
                  <div className="flex justify-between items-center font-semibold text-xs">
                    <span className="text-foreground">Net Balance Due</span>
                    <span className="font-mono text-sm text-amber-600 dark:text-amber-400">
                      {formatINR(totals.netBalanceDue)}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Payable amount after deducting advance adjustments.
                  </p>
                </div>

                <div className="pt-3">
                  <Button
                    type="submit"
                    className="w-full gap-1.5 h-10 text-xs font-semibold"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Receipt className="size-4" />
                    )}
                    Generate Invoice
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
