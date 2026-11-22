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
  useRecordDamageLoss,
  useInventoryItems,
} from "../hooks/use-inventory";
import {
  damageLossMovementSchema,
  type DamageLossMovementInput,
} from "../schemas/inventory.schema";
import {
  InventoryMovementType,
  type InventoryItem,
} from "@/types/inventory.types";
import { toast } from "sonner";
import { AlertOctagon, Loader2, Package, ShieldAlert, AlertTriangle } from "lucide-react";

interface DamageLossDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedItemId?: string;
  preselectedItem?: InventoryItem | null;
  onSuccess?: () => void;
}

export function DamageLossDialog({
  open,
  onOpenChange,
  preselectedItemId,
  preselectedItem,
  onSuccess,
}: DamageLossDialogProps) {
  const recordDamageLoss = useRecordDamageLoss();
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
  } = useForm<DamageLossMovementInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(damageLossMovementSchema) as any,
    defaultValues: {
      inventoryItemId: preselectedItemId || preselectedItem?.id || "",
      movementType: InventoryMovementType.DAMAGE,
      quantity: 1,
      notes: "",
    },
  });

  const selectedItemId = useWatch({ control, name: "inventoryItemId" });
  const selectedMovementType = useWatch({ control, name: "movementType" });
  const enteredQuantity = useWatch({ control, name: "quantity" }) || 0;

  const activeItem =
    preselectedItem || items.find((i) => i.id === selectedItemId);
  const currentStock = activeItem?.currentStock ?? 0;
  const isOverdecrement = enteredQuantity > currentStock;

  React.useEffect(() => {
    if (open) {
      reset({
        inventoryItemId: preselectedItemId || preselectedItem?.id || "",
        movementType: InventoryMovementType.DAMAGE,
        quantity: 1,
        notes: "",
      });
    }
  }, [open, preselectedItemId, preselectedItem, reset]);

  const onSubmit = async (values: DamageLossMovementInput) => {
    if (isOverdecrement) {
      toast.error(
        `Cannot write off ${enteredQuantity} units. Only ${currentStock} ${
          activeItem?.unit || "units"
        } available in warehouse.`
      );
      return;
    }

    try {
      await recordDamageLoss.mutateAsync(values);
      const label = values.movementType === InventoryMovementType.DAMAGE ? "Damaged" : "Lost";
      toast.success(
        `Stock write-off recorded: ${values.quantity} ${
          activeItem?.unit || "units"
        } marked as ${label}.`
      );
      onSuccess?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record write-off.";
      toast.error(msg);
    }
  };

  const isPending = isSubmitting || recordDamageLoss.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
              <AlertOctagon className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Report Damage / Loss
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Outflows: Write off broken, destroyed, or missing warehouse gear.
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
                  Available: {preselectedItem.currentStock} {preselectedItem.unit}
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
                      <SelectValue placeholder="Select item..." />
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
            )}
            {errors.inventoryItemId && (
              <p className="text-[11px] text-destructive">
                {errors.inventoryItemId.message}
              </p>
            )}
          </div>

          {/* Movement Type: Damage or Loss */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Write-Off Classification <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="movementType"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => field.onChange(InventoryMovementType.DAMAGE)}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all ${
                      field.value === InventoryMovementType.DAMAGE
                        ? "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400 ring-1 ring-red-500"
                        : "border-border hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <ShieldAlert className="size-3.5 text-red-500" />
                    <span>Damaged / Broken</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => field.onChange(InventoryMovementType.LOSS)}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all ${
                      field.value === InventoryMovementType.LOSS
                        ? "border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-400 ring-1 ring-purple-500"
                        : "border-border hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <AlertOctagon className="size-3.5 text-purple-500" />
                    <span>Lost / Missing</span>
                  </button>
                </div>
              )}
            />
          </div>

          {/* Quantity & Impact */}
          <div className="grid grid-cols-2 gap-3 items-start">
            <div className="space-y-1.5">
              <Label htmlFor="quantity" className="text-xs font-medium">
                Quantity to Write Off <span className="text-destructive">*</span>
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
                Remaining Stock After
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
                  {Math.max(0, currentStock - enteredQuantity)} {activeItem?.unit || "units"}
                </span>
              </div>
            </div>
          </div>

          {/* Over-decrement Warning */}
          {isOverdecrement && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                Quantity ({enteredQuantity}) exceeds currently recorded warehouse stock ({currentStock}).
              </span>
            </div>
          )}

          {/* Mandatory Incident / Cause Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="notes" className="text-xs font-medium">
                Incident Description & Cause <span className="text-destructive">*</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">min 3 characters</span>
            </div>
            <Textarea
              id="notes"
              placeholder="e.g. Accidentally dropped during warehouse shelf reorganization; broken DMX board and cracked housing..."
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
              variant="destructive"
              size="sm"
              disabled={isPending || !selectedItemId || isOverdecrement}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Writing Off Stock...
                </>
              ) : (
                `Write Off ${selectedMovementType === InventoryMovementType.DAMAGE ? "Damaged" : "Lost"} Units`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
