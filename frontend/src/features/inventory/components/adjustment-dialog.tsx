"use client";

import * as React from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Badge } from "@/components/ui/badge";
import {
  useRecordAdjustment,
  useInventoryItems,
} from "../hooks/use-inventory";
import {
  adjustmentMovementSchema,
  type AdjustmentMovementInput,
} from "../schemas/inventory.schema";
import {
  InventoryMovementType,
  type InventoryItem,
} from "@/types/inventory.types";
import { toast } from "sonner";
import { SlidersHorizontal, Loader2, ArrowUpRight, ArrowDownRight, Package, AlertTriangle } from "lucide-react";

interface AdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedItemId?: string;
  preselectedItem?: InventoryItem | null;
  onSuccess?: () => void;
}

export function AdjustmentDialog({
  open,
  onOpenChange,
  preselectedItemId,
  preselectedItem,
  onSuccess,
}: AdjustmentDialogProps) {
  const recordAdjustment = useRecordAdjustment();
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
  } = useForm<AdjustmentMovementInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(adjustmentMovementSchema) as any,
    defaultValues: {
      inventoryItemId: preselectedItemId || preselectedItem?.id || "",
      movementType: InventoryMovementType.ADJUSTMENT_IN,
      quantity: 1,
      referenceNumber: "",
      notes: "",
    },
  });

  const selectedItemId = useWatch({ control, name: "inventoryItemId" });
  const selectedMovementType = useWatch({ control, name: "movementType" });
  const enteredQuantity = useWatch({ control, name: "quantity" }) || 0;

  const activeItem =
    preselectedItem || items.find((i) => i.id === selectedItemId);
  const currentStock = activeItem?.currentStock ?? 0;

  // Stock preview calculation
  const isIncrement = selectedMovementType === InventoryMovementType.ADJUSTMENT_IN;
  const resultingStock = isIncrement
    ? currentStock + enteredQuantity
    : currentStock - enteredQuantity;
  const isOverdecrement = !isIncrement && enteredQuantity > currentStock;

  React.useEffect(() => {
    if (open) {
      reset({
        inventoryItemId: preselectedItemId || preselectedItem?.id || "",
        movementType: InventoryMovementType.ADJUSTMENT_IN,
        quantity: 1,
        referenceNumber: "",
        notes: "",
      });
    }
  }, [open, preselectedItemId, preselectedItem, reset]);

  const onSubmit = async (values: AdjustmentMovementInput) => {
    if (isOverdecrement) {
      toast.error(
        `Cannot reduce stock by ${enteredQuantity}. Only ${currentStock} ${
          activeItem?.unit || "units"
        } currently available.`
      );
      return;
    }

    try {
      await recordAdjustment.mutateAsync(values);
      toast.success(
        `Stock adjustment recorded: ${isIncrement ? "+" : "-"}${values.quantity} ${
          activeItem?.unit || "units"
        }. New balance: ${resultingStock} ${activeItem?.unit || "units"}.`
      );
      onSuccess?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record adjustment.";
      toast.error(msg);
    }
  };

  const isPending = isSubmitting || recordAdjustment.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <SlidersHorizontal className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Manual Stock Adjustment
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Reconcile physical warehouse stock counts with ledger records.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Item Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="inventoryItemId" className="text-xs font-medium">
              Equipment / Item <span className="text-destructive">*</span>
            </Label>
            {preselectedItem ? (
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-muted-foreground" />
                  <div>
                    <span className="text-xs font-semibold">{preselectedItem.name}</span>
                    {preselectedItem.sku && (
                      <span className="ml-1.5 text-[10px] font-mono text-muted-foreground">
                        [{preselectedItem.sku}]
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  Current: {preselectedItem.currentStock} {preselectedItem.unit}
                </Badge>
              </div>
            ) : (
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
                      <SelectValue placeholder="Select item to adjust..." />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.currentStock} {item.unit} in stock)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
            {errors.inventoryItemId && (
              <p className="text-[11px] text-destructive">
                {errors.inventoryItemId.message}
              </p>
            )}
          </div>

          {/* Movement Direction Toggle */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Adjustment Type <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="movementType"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => field.onChange(InventoryMovementType.ADJUSTMENT_IN)}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all ${
                      field.value === InventoryMovementType.ADJUSTMENT_IN
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500"
                        : "border-border hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <ArrowUpRight className="size-3.5 text-emerald-500" />
                    <span>Stock Increment (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => field.onChange(InventoryMovementType.ADJUSTMENT_OUT)}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all ${
                      field.value === InventoryMovementType.ADJUSTMENT_OUT
                        ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500"
                        : "border-border hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <ArrowDownRight className="size-3.5 text-amber-500" />
                    <span>Stock Decrement (-)</span>
                  </button>
                </div>
              )}
            />
          </div>

          {/* Quantity & Stock Impact Preview */}
          <div className="grid grid-cols-2 gap-3 items-start">
            <div className="space-y-1.5">
              <Label htmlFor="quantity" className="text-xs font-medium">
                Quantity to Adjust <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                step="1"
                placeholder="1"
                {...register("quantity", { valueAsNumber: true })}
                className="h-8 text-xs font-medium"
              />
              {errors.quantity && (
                <p className="text-[11px] text-destructive">{errors.quantity.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Projected New Balance
              </Label>
              <div
                className={`h-8 flex items-center justify-between px-2.5 rounded-lg border text-xs font-semibold ${
                  isOverdecrement
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-border bg-muted/40 text-foreground"
                }`}
              >
                <span>{currentStock}</span>
                <span className="text-muted-foreground">→</span>
                <span>
                  {resultingStock} {activeItem?.unit || "units"}
                </span>
              </div>
            </div>
          </div>

          {/* Over-decrement Warning Alert */}
          {isOverdecrement && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                Requested decrement ({enteredQuantity}) exceeds warehouse stock ({currentStock}).
              </span>
            </div>
          )}

          {/* Reference Number */}
          <div className="space-y-1.5">
            <Label htmlFor="referenceNumber" className="text-xs font-medium">
              Audit Ref / Internal Ticket
            </Label>
            <Input
              id="referenceNumber"
              placeholder="e.g. AUDIT-2026-Q1, RECON-042"
              {...register("referenceNumber")}
              className="h-8 text-xs font-mono"
            />
            {errors.referenceNumber && (
              <p className="text-[11px] text-destructive">
                {errors.referenceNumber.message}
              </p>
            )}
          </div>

          {/* Mandatory Audit Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="notes" className="text-xs font-medium">
                Mandatory Audit Reason <span className="text-destructive">*</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">min 3 characters</span>
            </div>
            <Textarea
              id="notes"
              placeholder="Explain why adjustment occurred (e.g. Quarterly warehouse physical count reconciliation, found extra units in repair bay)..."
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
              disabled={isPending || !selectedItemId || isOverdecrement}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Recording Adjustment...
                </>
              ) : (
                "Save Adjustment"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
