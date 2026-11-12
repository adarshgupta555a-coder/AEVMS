"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Calculator,
  Loader2,
  FileText,
  User,
  CheckCircle2,
  Receipt,
} from "lucide-react";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

import { useClients } from "@/features/clients/hooks/use-clients";
import { useCreateQuotationMutation } from "@/features/quotations/hooks/use-quotations";
import { calculateQuotationTotals, calculateItemTotal } from "@/features/quotations/utils/math";
import type { CreateQuotationInput } from "@/features/quotations/schemas/quotation.schema";
import { formatINR } from "@/lib/formatters";

interface LineItemFormItem {
  itemName: string;
  description?: string;
  quantity: number | string;
  unit?: string;
  unitPrice: number | string;
}

interface QuotationFormValues {
  clientId: string;
  title: string;
  eventType: string;
  eventDate?: string;
  venue?: string;
  guestCount?: number | string;
  validUntil?: string;
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
  quantity: 1,
  unit: "nos",
  unitPrice: 0,
};

const COMMON_EVENT_TYPES = [
  "Wedding",
  "Reception",
  "Sangeet & Mehendi",
  "Corporate Conference",
  "Product Launch",
  "Annual Gala",
  "Birthday Celebration",
  "Anniversary",
  "Music Concert",
  "Exhibition",
];

const COMMON_UNITS = ["nos", "hours", "days", "plates", "sets", "lump sum", "sq.ft"];

const TAX_PRESETS = [
  { label: "0% (Exempt)", value: 0 },
  { label: "5% GST", value: 5 },
  { label: "12% GST", value: 12 },
  { label: "18% GST (Standard)", value: 18 },
  { label: "28% GST", value: 28 },
];

export default function CreateQuotationPage() {
  const router = useRouter();

  // Queries & Mutations
  const { data: clientsData, isLoading: isLoadingClients } = useClients({ limit: 100 });
  const clients = clientsData?.clients ?? [];
  const createMutation = useCreateQuotationMutation();

  // React Hook Form initialization
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<QuotationFormValues>({
    defaultValues: {
      clientId: "",
      title: "",
      eventType: "Wedding",
      eventDate: "",
      venue: "",
      guestCount: "",
      validUntil: "",
      discountType: "NONE",
      discountValue: 0,
      taxRate: 18,
      notes: "Quotation includes basic sound, mood lighting, and on-ground management coordination.",
      terms: "1. 50% advance payment required upon contract signing.\n2. 40% balance due 7 days prior to event date.\n3. 10% post-event settlement.\n4. Cancellation within 14 days is non-refundable.",
      items: [
        {
          itemName: "Stage & Backdrop Decor",
          description: "Floral arrangements, customized photo wall, and lighting.",
          quantity: 1,
          unit: "set",
          unitPrice: 45000,
        },
        {
          itemName: "Sound & DJ System",
          description: "Line-array speakers, wireless mics, and DJ console.",
          quantity: 1,
          unit: "lump sum",
          unitPrice: 25000,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  // Real-time live watch of financial inputs
  const watchedItems = useWatch({ control, name: "items" });
  const watchedDiscountType = useWatch({ control, name: "discountType" });
  const watchedDiscountValue = useWatch({ control, name: "discountValue" });
  const watchedTaxRate = useWatch({ control, name: "taxRate" });

  const totals = React.useMemo(() => {
    const discType =
      watchedDiscountType === "NONE" ? null : watchedDiscountType;
    return calculateQuotationTotals({
      items: watchedItems || [],
      discountType: discType,
      discountValue: watchedDiscountValue,
      taxRate: watchedTaxRate,
    });
  }, [watchedItems, watchedDiscountType, watchedDiscountValue, watchedTaxRate]);

  // Submit Handler
  const onSubmit = async (values: QuotationFormValues) => {
    if (!values.items || values.items.length === 0) {
      toast.error("Please add at least one line item to the quotation");
      return;
    }

    try {
      const sanitizedItems = values.items.map((item, idx) => ({
        itemName: item.itemName.trim(),
        description: item.description?.trim() || null,
        quantity: Math.max(0.01, Number(item.quantity) || 1),
        unit: item.unit?.trim() || null,
        unitPrice: Math.max(0, Number(item.unitPrice) || 0),
        sortOrder: idx,
      }));

      const payload: CreateQuotationInput = {
        clientId: values.clientId,
        title: values.title.trim(),
        eventType: values.eventType.trim(),
        eventDate: values.eventDate ? new Date(values.eventDate) : null,
        venue: values.venue?.trim() || null,
        guestCount: values.guestCount ? Number(values.guestCount) : null,
        discountType: values.discountType === "NONE" ? null : values.discountType,
        discountValue:
          values.discountType === "NONE"
            ? 0
            : Math.max(0, Number(values.discountValue) || 0),
        taxRate: Math.max(0, Math.min(100, Number(values.taxRate) || 0)),
        validUntil: values.validUntil ? new Date(values.validUntil) : null,
        notes: values.notes?.trim() || null,
        terms: values.terms?.trim() || null,
        items: sanitizedItems,
      };

      const newQuotation = await createMutation.mutateAsync(payload);
      toast.success(`Quotation #${newQuotation.quotationNumber} created successfully!`);
      router.push(`/quotations/${newQuotation.id}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to create quotation");
      } else {
        toast.error("An unexpected error occurred while saving quotation");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Button
              size="icon-sm"
              variant="ghost"
              className="size-7"
              render={<Link href="/quotations" />}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Create Quotation
            </h1>
            <Badge variant="outline" className="text-xs">
              New Estimate
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Construct an itemized cost estimate with dynamic line items, automated zero-drift tax calculations, and real-time margin visibility.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Form Section (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Card 1: Client & Basic Event Info */}
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="size-4 text-primary" />
                  Client & Event Overview
                </CardTitle>
                <CardDescription className="text-xs">
                  Associate quotation with a registered client and define core event parameters.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                {/* Client Selector */}
                <div className="space-y-1.5">
                  <Label htmlFor="client-select" className="text-xs font-medium">
                    Client <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="client-select"
                    {...register("clientId", { required: "Please select a client" })}
                    disabled={isLoadingClients}
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <option value="">
                      {isLoadingClients ? "Loading clients..." : "-- Select a Client --"}
                    </option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ""} {c.city ? `• ${c.city}` : ""}
                      </option>
                    ))}
                  </select>
                  {errors.clientId && (
                    <p className="text-[11px] text-destructive">
                      {errors.clientId.message}
                    </p>
                  )}
                </div>

                {/* Quotation Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-xs font-medium">
                    Quotation Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    {...register("title", {
                      required: "Quotation title is required",
                      minLength: { value: 2, message: "Title must be at least 2 characters" },
                    })}
                    placeholder="e.g. Royal Wedding Reception — 2-Day Comprehensive Package"
                    className="h-8 text-xs"
                  />
                  {errors.title && (
                    <p className="text-[11px] text-destructive">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                {/* Event Type & Event Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="eventType" className="text-xs font-medium">
                      Event Type <span className="text-destructive">*</span>
                    </Label>
                    <div className="space-y-1">
                      <Input
                        id="eventType"
                        {...register("eventType", { required: "Event type is required" })}
                        placeholder="e.g. Wedding, Corporate, Birthday"
                        className="h-8 text-xs"
                      />
                      {/* Presets Pills */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {COMMON_EVENT_TYPES.slice(0, 5).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setValue("eventType", type)}
                            className="text-[10px] bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md border border-border/50 transition-colors"
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    {errors.eventType && (
                      <p className="text-[11px] text-destructive">
                        {errors.eventType.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="eventDate" className="text-xs font-medium text-muted-foreground">
                      Planned Event Date
                    </Label>
                    <Input
                      id="eventDate"
                      type="date"
                      {...register("eventDate")}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Venue, Guest Count, Valid Until */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="venue" className="text-xs font-medium text-muted-foreground">
                      Venue / Destination
                    </Label>
                    <Input
                      id="venue"
                      {...register("venue")}
                      placeholder="e.g. The Oberoi Grand"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="guestCount" className="text-xs font-medium text-muted-foreground">
                      Expected Guest Count
                    </Label>
                    <Input
                      id="guestCount"
                      type="number"
                      min="1"
                      {...register("guestCount")}
                      placeholder="e.g. 350"
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="validUntil" className="text-xs font-medium text-muted-foreground">
                      Quotation Valid Until
                    </Label>
                    <Input
                      id="validUntil"
                      type="date"
                      {...register("validUntil")}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Dynamic Line Items Builder */}
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Calculator className="size-4 text-primary" />
                    Itemized Line Items
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Define services, materials, rentals, and custom decor charges.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => append(DEFAULT_LINE_ITEM)}
                >
                  <Plus className="size-3.5" />
                  Add Line Item
                </Button>
              </CardHeader>

              <CardContent className="space-y-3 pt-1">
                {fields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg border-border/70 text-center">
                    <p className="text-xs text-muted-foreground mb-2">
                      No line items added yet. At least one line item is required.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => append(DEFAULT_LINE_ITEM)}
                      className="gap-1.5 text-xs"
                    >
                      <Plus className="size-3.5" /> Add First Item
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {fields.map((field, index) => {
                      const itemQuantity = watchedItems?.[index]?.quantity ?? 1;
                      const itemUnitPrice = watchedItems?.[index]?.unitPrice ?? 0;
                      const lineTotal = calculateItemTotal(itemQuantity, itemUnitPrice);

                      return (
                        <div
                          key={field.id}
                          className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-1.5">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                              Item #{index + 1}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono font-semibold text-foreground">
                                Line Total: {formatINR(lineTotal)}
                              </span>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                className="size-6 text-muted-foreground hover:text-destructive"
                                disabled={fields.length === 1}
                                onClick={() => remove(index)}
                                title={fields.length === 1 ? "At least 1 item required" : "Remove item"}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                            {/* Item Name */}
                            <div className="sm:col-span-7 space-y-1">
                              <Input
                                {...register(`items.${index}.itemName`, {
                                  required: "Item name is required",
                                })}
                                placeholder="Item / Service Name (e.g. Premium Stage Truss)"
                                className="h-8 text-xs font-medium"
                              />
                              {errors.items?.[index]?.itemName && (
                                <p className="text-[10px] text-destructive">
                                  {errors.items[index]?.itemName?.message}
                                </p>
                              )}
                            </div>

                            {/* Quantity */}
                            <div className="sm:col-span-2 space-y-1">
                              <Input
                                type="number"
                                step="any"
                                min="0.01"
                                {...register(`items.${index}.quantity`, {
                                  required: "Qty required",
                                  min: 0.01,
                                })}
                                placeholder="Qty"
                                className="h-8 text-xs font-mono"
                              />
                            </div>

                            {/* Unit */}
                            <div className="sm:col-span-3 space-y-1">
                              <Input
                                {...register(`items.${index}.unit`)}
                                placeholder="Unit (nos, days, set)"
                                className="h-8 text-xs"
                                list="unit-options"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                            {/* Description */}
                            <div className="sm:col-span-8 space-y-1">
                              <Input
                                {...register(`items.${index}.description`)}
                                placeholder="Detailed specs, inclusions, or remarks (optional)..."
                                className="h-7 text-xs text-muted-foreground"
                              />
                            </div>

                            {/* Unit Price */}
                            <div className="sm:col-span-4 space-y-1">
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                                  ₹
                                </span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  {...register(`items.${index}.unitPrice`, {
                                    required: "Rate required",
                                    min: 0,
                                  })}
                                  placeholder="Unit Price"
                                  className="h-7 pl-6 text-xs font-mono font-medium text-right"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <datalist id="unit-options">
                      {COMMON_UNITS.map((u) => (
                        <option key={u} value={u} />
                      ))}
                    </datalist>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs border-dashed gap-1.5 text-muted-foreground hover:text-foreground"
                      onClick={() => append(DEFAULT_LINE_ITEM)}
                    >
                      <Plus className="size-3.5" />
                      Add Another Line Item
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card 3: Notes & Terms */}
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  Notes & Commercial Terms
                </CardTitle>
                <CardDescription className="text-xs">
                  Provide custom handover notes, scope inclusions, and payment milestone conditions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-xs font-medium">
                    Notes & Scope Inclusions
                  </Label>
                  <Textarea
                    id="notes"
                    {...register("notes")}
                    rows={2}
                    placeholder="Specific inclusions, client reminders, setup dates..."
                    className="text-xs resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="terms" className="text-xs font-medium">
                    Standard Terms & Conditions
                  </Label>
                  <Textarea
                    id="terms"
                    {...register("terms")}
                    rows={3}
                    placeholder="Cancellation rules, payment schedules, taxes applicable..."
                    className="text-xs resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sticky Financial Calculation Summary Sidebar (4 Cols) */}
          <div className="lg:col-span-4 sticky top-4 space-y-4">
            <Card className="border-border/70 shadow-sm bg-card overflow-hidden">
              <CardHeader className="bg-muted/40 pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Receipt className="size-4 text-primary" />
                  Financial Summary
                </CardTitle>
                <CardDescription className="text-xs">
                  Zero-drift decimal calculation engine updated in real time.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-4 text-xs">
                {/* Subtotal */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Subtotal</span>
                  <span className="font-mono font-semibold text-sm text-foreground">
                    {formatINR(totals.subtotal)}
                  </span>
                </div>

                <Separator />

                {/* Discount Control */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Discount
                    </Label>
                    <span className="font-mono text-xs text-rose-600 dark:text-rose-400 font-semibold">
                      - {formatINR(totals.discountAmount)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      {...register("discountType")}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none"
                    >
                      <option value="NONE">None</option>
                      <option value="PERCENTAGE">Percent (%)</option>
                      <option value="FIXED">Fixed (₹)</option>
                    </select>

                    <Input
                      type="number"
                      step="any"
                      min="0"
                      disabled={watchedDiscountType === "NONE"}
                      {...register("discountValue")}
                      placeholder="Value"
                      className="h-8 text-xs font-mono text-right"
                    />
                  </div>
                </div>

                {/* Taxable Amount */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-muted-foreground">Taxable Subtotal</span>
                  <span className="font-mono text-foreground font-medium">
                    {formatINR(totals.taxableAmount)}
                  </span>
                </div>

                <Separator />

                {/* Tax (GST) Control */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">
                      GST Tax Rate
                    </Label>
                    <span className="font-mono text-xs text-foreground font-semibold">
                      + {formatINR(totals.taxAmount)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={watchedTaxRate}
                      onChange={(e) => setValue("taxRate", Number(e.target.value))}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none"
                    >
                      {TAX_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>

                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        {...register("taxRate")}
                        placeholder="Rate %"
                        className="h-8 pr-6 text-xs font-mono text-right"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Grand Total Big Display */}
                <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 space-y-1 text-center">
                  <span className="text-[11px] font-medium text-primary uppercase tracking-wider">
                    Grand Total Payable
                  </span>
                  <div className="text-2xl font-bold font-mono text-primary tracking-tight">
                    {formatINR(totals.grandTotal)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Includes all line charges, applicable discounts, and GST.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <Button
                    type="submit"
                    className="w-full gap-2 shadow-sm font-semibold"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Saving Quotation...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-4" />
                        Create & Save Quotation
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-xs"
                    render={<Link href="/quotations" />}
                  >
                    Cancel & Return
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
