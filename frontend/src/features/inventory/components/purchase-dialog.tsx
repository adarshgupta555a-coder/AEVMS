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
  useRecordPurchase,
  useInventoryItems,
} from "../hooks/use-inventory";
import {
  purchaseMovementSchema,
  type PurchaseMovementInput,
} from "../schemas/inventory.schema";
import type { InventoryItem } from "@/types/inventory.types";
import { toast } from "sonner";
import { ShoppingCart, Loader2, DollarSign, Package } from "lucide-react";

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedItemId?: string;
  preselectedItem?: InventoryItem | null;
  onSuccess?: () => void;
}

export function PurchaseDialog({
  open,
  onOpenChange,
  preselectedItemId,
  preselectedItem,
  onSuccess,
}: PurchaseDialogProps) {
  const recordPurchase = useRecordPurchase();
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
  } = useForm<PurchaseMovementInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(purchaseMovementSchema) as any,
    defaultValues: {
      inventoryItemId: preselectedItemId || preselectedItem?.id || "",
      quantity: 1,
      unitCost: preselectedItem?.purchasePrice ?? null,
      referenceNumber: "",
      notes: "",
    },
  });

  const selectedItemId = useWatch({ control, name: "inventoryItemId" });
  const selectedItem =
    preselectedItem || items.find((i) => i.id === selectedItemId);

  const watchedQuantity = useWatch({ control, name: "quantity" }) || 0;
  const watchedUnitCost = useWatch({ control, name: "unitCost" }) || 0;
  const estimatedTotalCost = watchedQuantity * watchedUnitCost;

  React.useEffect(() => {
    if (open) {
      const activeId = preselectedItemId || preselectedItem?.id || "";
      reset({
        inventoryItemId: activeId,
        quantity: 1,
        unitCost: preselectedItem?.purchasePrice ?? null,
        referenceNumber: "",
        notes: "",
      });
    }
  }, [open, preselectedItemId, preselectedItem, reset]);

  const onSubmit = async (values: PurchaseMovementInput) => {
    try {
      await recordPurchase.mutateAsync(values);
      toast.success(
        `Successfully recorded incoming purchase of ${values.quantity} ${
          selectedItem?.unit || "unit(s)"
        }. Warehouse stock updated.`
      );
      onSuccess?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record purchase.";
      toast.error(msg);
    }
  };

  const isPending = isSubmitting || recordPurchase.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShoppingCart className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Record Stock Purchase
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Inflows: Add incoming inventory procured from vendors into the warehouse.
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
                  Current Stock: {preselectedItem.currentStock} {preselectedItem.unit}
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
                      <SelectValue placeholder="Choose inventory item..." />
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

          {/* Quantity & Unit Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quantity" className="text-xs font-medium">
                Purchased Quantity <span className="text-destructive">*</span>
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
              <Label htmlFor="unitCost" className="text-xs font-medium">
                Unit Cost (₹)
              </Label>
              <Input
                id="unitCost"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                {...register("unitCost", {
                  setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                })}
                className="h-8 text-xs"
              />
              {errors.unitCost && (
                <p className="text-[11px] text-destructive">{errors.unitCost.message}</p>
              )}
            </div>
          </div>

          {/* Estimated Total Card */}
          {estimatedTotalCost > 0 && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                <DollarSign className="size-3.5" />
                <span>Total Procurement Outlay:</span>
              </div>
              <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                ₹ {estimatedTotalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* PO / Reference Number */}
          <div className="space-y-1.5">
            <Label htmlFor="referenceNumber" className="text-xs font-medium">
              PO # / Invoice Reference
            </Label>
            <Input
              id="referenceNumber"
              placeholder="e.g. PO-2026-0089, INV-SHURE-99"
              {...register("referenceNumber")}
              className="h-8 text-xs font-mono"
            />
            {errors.referenceNumber && (
              <p className="text-[11px] text-destructive">
                {errors.referenceNumber.message}
              </p>
            )}
          </div>

          {/* Audit Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-medium">
              Vendor / Distributor Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="e.g. Sourced from authorized distributor with 2-year manufacturer warranty..."
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isPending || !selectedItemId}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Recording Purchase...
                </>
              ) : (
                "Confirm Purchase"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
