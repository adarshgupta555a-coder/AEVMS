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
import { useReturnEventItems } from "../hooks/use-inventory";
import {
  InventoryUsageType,
  type EventInventoryAllocation,
} from "@/types/inventory.types";
import { toast } from "sonner";
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Package,
  Truck,
  Building2,
} from "lucide-react";

const eventReturnSchema = z
  .object({
    returnedQuantity: z.coerce.number().int().min(0, "Returned quantity cannot be negative"),
    damagedQuantity: z.coerce.number().int().min(0, "Damaged quantity cannot be negative"),
    actualReturnDate: z.string().optional().nullable(),
    damageNotes: z.string().trim().optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .refine((data) => data.returnedQuantity + data.damagedQuantity > 0, {
    message: "Combined returned and damaged quantity must be greater than 0.",
    path: ["returnedQuantity"],
  })
  .refine(
    (data) => {
      if (data.damagedQuantity > 0) {
        return Boolean(data.damageNotes && data.damageNotes.trim().length >= 3);
      }
      return true;
    },
    {
      message: "Mandatory damage inspection report is required when damaged quantity > 0 (min 3 chars).",
      path: ["damageNotes"],
    }
  );

interface EventReturnFormData {
  returnedQuantity: number;
  damagedQuantity: number;
  actualReturnDate?: string | null;
  damageNotes?: string | null;
  notes?: string | null;
}

interface EventReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  allocation: EventInventoryAllocation | null;
  onSuccess?: () => void;
}

export function EventReturnDialog({
  open,
  onOpenChange,
  eventId,
  allocation,
  onSuccess,
}: EventReturnDialogProps) {
  const returnEventItems = useReturnEventItems();

  const isRented = allocation?.usageType === InventoryUsageType.RENTED;
  const issuedQuantity = allocation?.issuedQuantity ?? 0;
  const returnedQuantityTotal = allocation?.returnedQuantity ?? 0;
  const damagedQuantityTotal = allocation?.damagedQuantity ?? 0;
  const outstandingQuantity =
    allocation?.outstandingQuantity ??
    Math.max(0, issuedQuantity - (returnedQuantityTotal + damagedQuantityTotal));

  // Current date/time formatted for datetime-local
  const defaultCurrentDateTime = React.useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EventReturnFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(eventReturnSchema) as any,
    defaultValues: {
      returnedQuantity: outstandingQuantity,
      damagedQuantity: 0,
      actualReturnDate: defaultCurrentDateTime,
      damageNotes: "",
      notes: "",
    },
  });

  const watchedReturned = useWatch({ control, name: "returnedQuantity" }) || 0;
  const watchedDamaged = useWatch({ control, name: "damagedQuantity" }) || 0;
  const totalProcessed = watchedReturned + watchedDamaged;
  const isOverReturn = totalProcessed > outstandingQuantity;

  React.useEffect(() => {
    if (open && allocation) {
      const outstanding =
        allocation.outstandingQuantity ??
        Math.max(
          0,
          allocation.issuedQuantity -
            (allocation.returnedQuantity + allocation.damagedQuantity)
        );
      reset({
        returnedQuantity: outstanding,
        damagedQuantity: 0,
        actualReturnDate: defaultCurrentDateTime,
        damageNotes: "",
        notes: "",
      });
    }
  }, [open, allocation, defaultCurrentDateTime, reset]);

  const onSubmit = async (values: EventReturnFormData) => {
    if (!allocation) return;

    if (isOverReturn) {
      toast.error(
        `Total returned + damaged (${totalProcessed}) exceeds unreturned outstanding quantity (${outstandingQuantity}).`
      );
      return;
    }

    try {
      const combinedNotes = [
        values.notes,
        values.damagedQuantity > 0 ? `Damage Report: ${values.damageNotes}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      await returnEventItems.mutateAsync({
        eventId,
        data: {
          items: [
            {
              inventoryItemId: allocation.inventoryItemId,
              returnedQuantity: values.returnedQuantity,
              damagedQuantity: values.damagedQuantity,
              actualReturnDate: isRented ? values.actualReturnDate : null,
              notes: combinedNotes || null,
            },
          ],
        },
      });

      toast.success(
        `Return inspection processed: ${values.returnedQuantity} in good condition${
          values.damagedQuantity > 0 ? `, ${values.damagedQuantity} damaged` : ""
        }.`
      );
      onSuccess?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to process return.";
      toast.error(msg);
    }
  };

  const isPending = isSubmitting || returnEventItems.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <RotateCcw className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Event Equipment Return & Inspection
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Inspect returned gear, restock undamaged assets, and write off damages.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {allocation && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            {/* Equipment Overview Banner */}
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
                    Vendor Rental
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    <Building2 className="size-3 mr-1" />
                    Company Owned
                  </Badge>
                )}
              </div>

              {/* Outstanding Count Highlight */}
              <div className="flex items-center justify-between p-2 rounded bg-background border border-border/60 text-xs">
                <span className="text-muted-foreground">Outstanding Unreturned Units:</span>
                <span className="font-bold text-sm text-foreground font-mono">
                  {outstandingQuantity} {allocation.inventoryItem?.unit || "units"}
                </span>
              </div>
            </div>

            {/* Return Quantities Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Good Condition */}
              <div className="space-y-1.5">
                <Label htmlFor="returnedQuantity" className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" />
                  Good Condition
                </Label>
                <Input
                  id="returnedQuantity"
                  type="number"
                  min="0"
                  step="1"
                  {...register("returnedQuantity", { valueAsNumber: true })}
                  className="h-8 text-xs font-medium"
                />
                <p className="text-[10px] text-muted-foreground">
                  Restocked into warehouse (if owned).
                </p>
                {errors.returnedQuantity && (
                  <p className="text-[11px] text-destructive">
                    {errors.returnedQuantity.message}
                  </p>
                )}
              </div>

              {/* Damaged Units */}
              <div className="space-y-1.5">
                <Label htmlFor="damagedQuantity" className="text-xs font-medium text-destructive flex items-center gap-1">
                  <AlertTriangle className="size-3.5" />
                  Damaged / Destroyed
                </Label>
                <Input
                  id="damagedQuantity"
                  type="number"
                  min="0"
                  step="1"
                  {...register("damagedQuantity", { valueAsNumber: true })}
                  className="h-8 text-xs font-medium text-destructive"
                />
                <p className="text-[10px] text-muted-foreground">
                  Logged as event damage write-off.
                </p>
                {errors.damagedQuantity && (
                  <p className="text-[11px] text-destructive">
                    {errors.damagedQuantity.message}
                  </p>
                )}
              </div>
            </div>

            {/* Over-return Validation Alert */}
            {isOverReturn && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
                <AlertTriangle className="size-4 shrink-0" />
                <span>
                  Total returned + damaged ({totalProcessed}) cannot exceed outstanding unreturned quantity ({outstandingQuantity}).
                </span>
              </div>
            )}

            {/* Mandatory Damage Description when damaged > 0 */}
            {watchedDamaged > 0 && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="damageNotes" className="text-xs font-medium text-destructive">
                    Damage Report & Vendor Liability Note <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-[10px] text-muted-foreground">Required</span>
                </div>
                <Textarea
                  id="damageNotes"
                  placeholder="Describe damage details, failure cause, and vendor liability notes..."
                  {...register("damageNotes")}
                  className="min-h-16 text-xs resize-none"
                />
                {errors.damageNotes && (
                  <p className="text-[11px] text-destructive">
                    {errors.damageNotes.message}
                  </p>
                )}
              </div>
            )}

            {/* Rented Gear Actual Return Date */}
            {isRented && (
              <div className="space-y-1.5">
                <Label htmlFor="actualReturnDate" className="text-xs font-medium">
                  Actual Return Date to Vendor
                </Label>
                <Input
                  id="actualReturnDate"
                  type="datetime-local"
                  {...register("actualReturnDate")}
                  className="h-8 text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Used for rental reconciliation and duration calculations.
                </p>
              </div>
            )}

            {/* General Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-medium">
                General Return Notes
              </Label>
              <Textarea
                id="notes"
                placeholder="e.g. Returned to Bay 3 shelving; flight case latches inspected..."
                {...register("notes")}
                className="min-h-14 text-xs resize-none"
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
                className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={isPending || isOverReturn || totalProcessed === 0}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Processing Return...
                  </>
                ) : (
                  "Confirm Return Inspection"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
