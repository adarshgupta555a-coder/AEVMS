"use client";

import * as React from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAllocateEventItems,
  useInventoryItems,
} from "../hooks/use-inventory";
import {
  calculateRentalMetrics,
} from "../utils/rental-calculator";
import {
  InventoryUsageType,
} from "@/types/inventory.types";
import { toast } from "sonner";
import {
  Layers,
  Building2,
  Truck,
  Loader2,
  AlertTriangle,
  Clock,
} from "lucide-react";

const eventAllocationFormSchema = z
  .object({
    inventoryItemId: z.string().min(1, "Please select an inventory item"),
    usageType: z.nativeEnum(InventoryUsageType),
    requiredQuantity: z.coerce
      .number()
      .int()
      .positive("Quantity must be at least 1"),
    rentalStartDate: z.string().optional().nullable(),
    rentalEndDate: z.string().optional().nullable(),
    rentPerUnit: z.coerce
      .number()
      .min(0, "Rent per unit cannot be negative")
      .optional()
      .nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.usageType === InventoryUsageType.RENTED) {
        if (!data.rentalStartDate || !data.rentalEndDate) {
          return false;
        }
        const start = new Date(data.rentalStartDate).getTime();
        const end = new Date(data.rentalEndDate).getTime();
        return end >= start;
      }
      return true;
    },
    {
      message: "End date must be on or after start date for third-party rentals.",
      path: ["rentalEndDate"],
    }
  );

interface EventAllocationFormData {
  inventoryItemId: string;
  usageType: InventoryUsageType;
  requiredQuantity: number;
  rentalStartDate?: string | null;
  rentalEndDate?: string | null;
  rentPerUnit?: number | null;
  notes?: string | null;
}

interface EventAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  onSuccess?: () => void;
}

export function EventAllocationDialog({
  open,
  onOpenChange,
  eventId,
  onSuccess,
}: EventAllocationDialogProps) {
  const allocateItems = useAllocateEventItems();
  const { data: itemsData, isLoading: isLoadingItems } = useInventoryItems({
    page: 1,
    limit: 100,
    isActive: true,
  });
  const items = itemsData?.items || [];

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EventAllocationFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(eventAllocationFormSchema) as any,
    defaultValues: {
      inventoryItemId: "",
      usageType: InventoryUsageType.OWNED,
      requiredQuantity: 1,
      rentalStartDate: "",
      rentalEndDate: "",
      rentPerUnit: null,
      notes: "",
    },
  });

  const selectedItemId = useWatch({ control, name: "inventoryItemId" });
  const selectedUsageType = useWatch({ control, name: "usageType" });
  const requiredQuantity = useWatch({ control, name: "requiredQuantity" }) || 0;
  const rentalStartDate = useWatch({ control, name: "rentalStartDate" });
  const rentalEndDate = useWatch({ control, name: "rentalEndDate" });
  const rentPerUnit = useWatch({ control, name: "rentPerUnit" });

  const selectedItem = items.find((i) => i.id === selectedItemId);
  const currentStock = selectedItem?.currentStock ?? 0;

  // Real-time calculation of rental duration & cost
  const isRented = selectedUsageType === InventoryUsageType.RENTED;
  const rentalMetrics = React.useMemo(() => {
    if (!isRented) {
      return { rentalDays: 1, totalRent: 0 };
    }
    return calculateRentalMetrics({
      startDate: rentalStartDate,
      endDate: rentalEndDate,
      requiredQuantity,
      rentPerUnit,
    });
  }, [isRented, rentalStartDate, rentalEndDate, requiredQuantity, rentPerUnit]);

  // Reset form when opened
  React.useEffect(() => {
    if (open) {
      reset({
        inventoryItemId: "",
        usageType: InventoryUsageType.OWNED,
        requiredQuantity: 1,
        rentalStartDate: "",
        rentalEndDate: "",
        rentPerUnit: null,
        notes: "",
      });
    }
  }, [open, reset]);

  const onSubmit = async (values: EventAllocationFormData) => {
    try {
      await allocateItems.mutateAsync({
        eventId,
        data: {
          items: [
            {
              inventoryItemId: values.inventoryItemId,
              requiredQuantity: values.requiredQuantity,
              usageType: values.usageType,
              rentalStartDate: isRented ? values.rentalStartDate : null,
              rentalEndDate: isRented ? values.rentalEndDate : null,
              rentalDays: isRented ? rentalMetrics.rentalDays : null,
              rentPerUnit: isRented ? values.rentPerUnit : null,
              totalRent: isRented ? rentalMetrics.totalRent : null,
              notes: values.notes || null,
            },
          ],
        },
      });

      toast.success(
        `Allocated ${values.requiredQuantity} ${selectedItem?.unit || "unit(s)"} of "${
          selectedItem?.name
        }" to event successfully.`
      );
      onSuccess?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to allocate equipment.";
      toast.error(msg);
    }
  };

  const isPending = isSubmitting || allocateItems.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Layers className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Allocate Equipment to Event
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Assign company assets or source on-demand third-party vendor rentals.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Ownership Toggle (Company Owned vs Third-Party Rented) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Equipment Sourcing Model <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="usageType"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => field.onChange(InventoryUsageType.OWNED)}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                      field.value === InventoryUsageType.OWNED
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                        : "border-border hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <Building2 className="size-4" />
                    <span>Company Owned Gear</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => field.onChange(InventoryUsageType.RENTED)}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                      field.value === InventoryUsageType.RENTED
                        ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500"
                        : "border-border hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <Truck className="size-4" />
                    <span>Third-Party Rented</span>
                  </button>
                </div>
              )}
            />
          </div>

          {/* Equipment Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="inventoryItemId" className="text-xs font-medium">
              Select Equipment Catalog Item <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="inventoryItemId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isLoadingItems}
                >
                  <SelectTrigger id="inventoryItemId" className="h-8 w-full text-xs">
                    <SelectValue placeholder="Choose equipment to allocate..." />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.currentStock} {item.unit} available)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.inventoryItemId && (
              <p className="text-[11px] text-destructive">
                {errors.inventoryItemId.message}
              </p>
            )}

            {/* Warehouse stock indicator for owned items */}
            {selectedItem && !isRented && (
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>Warehouse Current Balance:</span>
                <span
                  className={`font-semibold font-mono ${
                    currentStock >= requiredQuantity
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {currentStock} {selectedItem.unit}
                </span>
              </div>
            )}
          </div>

          {/* Quantity Required */}
          <div className="space-y-1.5">
            <Label htmlFor="requiredQuantity" className="text-xs font-medium">
              Quantity Required <span className="text-destructive">*</span>
            </Label>
            <Input
              id="requiredQuantity"
              type="number"
              min="1"
              step="1"
              placeholder="1"
              {...register("requiredQuantity", { valueAsNumber: true })}
              className="h-8 text-xs font-medium"
            />
            {errors.requiredQuantity && (
              <p className="text-[11px] text-destructive">
                {errors.requiredQuantity.message}
              </p>
            )}

            {/* Warning if owned quantity exceeds current stock */}
            {!isRented && selectedItem && requiredQuantity > currentStock && (
              <div className="flex items-start gap-1.5 p-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>
                  Allocation quantity ({requiredQuantity}) exceeds current warehouse stock ({currentStock}). You can allocate now, but you must acquire/restock items before dispatch.
                </span>
              </div>
            )}
          </div>

          {/* Third-Party Rental Specific Section */}
          {isRented && (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 pb-1 border-b border-amber-500/20">
                <Truck className="size-3.5" />
                <span>Vendor Rental Terms & Schedule</span>
              </div>

              {/* Start & End Date Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="rentalStartDate" className="text-xs">
                    Rental Start Date & Time <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="rentalStartDate"
                    type="datetime-local"
                    {...register("rentalStartDate")}
                    className="h-8 text-xs"
                  />
                  {errors.rentalStartDate && (
                    <p className="text-[11px] text-destructive">
                      {errors.rentalStartDate.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="rentalEndDate" className="text-xs">
                    Rental End Date & Time <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="rentalEndDate"
                    type="datetime-local"
                    {...register("rentalEndDate")}
                    className="h-8 text-xs"
                  />
                  {errors.rentalEndDate && (
                    <p className="text-[11px] text-destructive">
                      {errors.rentalEndDate.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Rent Per Unit */}
              <div className="space-y-1">
                <Label htmlFor="rentPerUnit" className="text-xs">
                  Rent Per Unit / Day (₹)
                </Label>
                <Input
                  id="rentPerUnit"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 2500.00"
                  {...register("rentPerUnit", {
                    setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                  })}
                  className="h-8 text-xs"
                />
                {errors.rentPerUnit && (
                  <p className="text-[11px] text-destructive">
                    {errors.rentPerUnit.message}
                  </p>
                )}
              </div>

              {/* Real-time Calculated Metrics Display */}
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-background border border-amber-500/20 text-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Calculated Duration
                  </span>
                  <div className="flex items-center gap-1 font-semibold text-foreground">
                    <Clock className="size-3.5 text-amber-500" />
                    <span>
                      {rentalMetrics.rentalDays} {rentalMetrics.rentalDays === 1 ? "Day" : "Days"}
                    </span>
                  </div>
                </div>

                <div className="space-y-0.5 text-right">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Total Estimated Rent
                  </span>
                  <div className="font-bold text-amber-700 dark:text-amber-400 font-mono">
                    ₹ {rentalMetrics.totalRent.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes / Sourcing Vendor */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-medium">
              {isRented ? "Vendor Sourcing & Delivery Notes" : "Allocation Notes / Purpose"}
            </Label>
            <Textarea
              id="notes"
              placeholder={
                isRented
                  ? "e.g. Sourced from BrightVision Rentals Ltd; vendor delivery on-site directly..."
                  : "e.g. Reserved for Main Stage Vocalists..."
              }
              {...register("notes")}
              className="min-h-16 text-xs resize-none"
            />
            {errors.notes && (
              <p className="text-[11px] text-destructive">{errors.notes.message}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !selectedItemId}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Allocating...
                </>
              ) : (
                "Confirm Allocation"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
