"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { Badge } from "@/components/ui/badge";
import { useIssueEventItems } from "../hooks/use-inventory";
import {
  InventoryUsageType,
  type EventInventoryAllocation,
} from "@/types/inventory.types";
import { toast } from "sonner";
import {
  Truck,
  Building2,
  PackageCheck,
  AlertTriangle,
  Loader2,
  Package,
} from "lucide-react";

const eventIssueSchema = z.object({
  quantity: z.coerce.number().int().positive("Issue quantity must be at least 1"),
  notes: z.string().trim().max(500).optional().nullable(),
});

interface EventIssueFormData {
  quantity: number;
  notes?: string | null;
}

interface EventIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  allocation: EventInventoryAllocation | null;
  onSuccess?: () => void;
}

export function EventIssueDialog({
  open,
  onOpenChange,
  eventId,
  allocation,
  onSuccess,
}: EventIssueDialogProps) {
  const issueEventItems = useIssueEventItems();

  const isRented = allocation?.usageType === InventoryUsageType.RENTED;
  const currentWarehouseStock = allocation?.inventoryItem?.currentStock ?? 0;
  const requiredQuantity = allocation?.requiredQuantity ?? 0;
  const alreadyIssued = allocation?.issuedQuantity ?? 0;
  const remainingToIssue = Math.max(0, requiredQuantity - alreadyIssued);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EventIssueFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(eventIssueSchema) as any,
    defaultValues: {
      quantity: remainingToIssue || 1,
      notes: "",
    },
  });

  const enteredQuantity = useWatch({ control, name: "quantity" }) || 0;

  // For owned gear, verify stock availability
  const isInsufficientStock = !isRented && currentWarehouseStock < enteredQuantity;

  React.useEffect(() => {
    if (open && allocation) {
      const remaining = Math.max(0, allocation.requiredQuantity - allocation.issuedQuantity);
      reset({
        quantity: remaining > 0 ? remaining : 1,
        notes: "",
      });
    }
  }, [open, allocation, reset]);

  const onSubmit = async (values: EventIssueFormData) => {
    if (!allocation) return;

    if (isInsufficientStock) {
      toast.error(
        `Cannot issue gear: Requested ${values.quantity} units, but only ${currentWarehouseStock} units are available in the warehouse.`
      );
      return;
    }

    try {
      await issueEventItems.mutateAsync({
        eventId,
        data: {
          items: [
            {
              inventoryItemId: allocation.inventoryItemId,
              quantity: values.quantity,
              usageType: allocation.usageType,
              notes: values.notes || null,
            },
          ],
        },
      });

      toast.success(
        `Dispatched ${values.quantity} ${
          allocation.inventoryItem?.unit || "units"
        } of "${allocation.inventoryItem?.name}" to event.`
      );
      onSuccess?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to issue gear.";
      toast.error(msg);
    }
  };

  const isPending = isSubmitting || issueEventItems.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <PackageCheck className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Dispatch Gear to Event
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Confirm gear departure from warehouse or third-party vendor site arrival.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {allocation && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            {/* Equipment Banner */}
            <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-semibold truncate">
                    {allocation.inventoryItem?.name}
                  </span>
                </div>
                {isRented ? (
                  <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px]">
                    <Truck className="size-3 mr-1" />
                    Vendor Rented
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    <Building2 className="size-3 mr-1" />
                    Company Owned
                  </Badge>
                )}
              </div>

              {/* Status Breakdown Grid */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/60 text-center text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground">Required</span>
                  <div className="font-semibold">{requiredQuantity}</div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">Already Issued</span>
                  <div className="font-semibold text-blue-600 dark:text-blue-400">
                    {alreadyIssued}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">Unissued Balance</span>
                  <div className="font-semibold text-foreground">{remainingToIssue}</div>
                </div>
              </div>
            </div>

            {/* Warehouse Stock vs Rented Bypass Notice */}
            {isRented ? (
              <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                <Truck className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Third-party vendor asset — bypasses internal warehouse stock checks.</span>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card text-xs">
                <span className="text-muted-foreground">Warehouse Physical Stock Available:</span>
                <span
                  className={`font-semibold font-mono ${
                    currentWarehouseStock >= enteredQuantity
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  }`}
                >
                  {currentWarehouseStock} {allocation.inventoryItem?.unit || "units"}
                </span>
              </div>
            )}

            {/* Quantity to Dispatch */}
            <div className="space-y-1.5">
              <Label htmlFor="quantity" className="text-xs font-medium">
                Quantity to Dispatch / Issue <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                step="1"
                {...register("quantity", { valueAsNumber: true })}
                className="h-8 text-xs font-medium"
              />
              {errors.quantity && (
                <p className="text-[11px] text-destructive">{errors.quantity.message}</p>
              )}
            </div>

            {/* Insufficient Stock Warning */}
            {isInsufficientStock && (
              <div className="flex items-start gap-1.5 p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>
                  Cannot issue gear: Requested {enteredQuantity} units, but only {currentWarehouseStock} units are currently available in the warehouse.
                </span>
              </div>
            )}

            {/* Dispatch Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-medium">
                Dispatch / Transportation Notes
              </Label>
              <Textarea
                id="notes"
                placeholder="e.g. Dispatched in flight cases 1-4 via Logistics Van #2..."
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
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isPending || isInsufficientStock}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Dispatching...
                  </>
                ) : (
                  "Confirm Dispatch"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
