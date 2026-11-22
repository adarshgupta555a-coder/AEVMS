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
import { Switch } from "@/components/ui/switch";
import {
  useInventoryCategories,
  useCreateInventoryItem,
  useUpdateInventoryItem,
} from "../hooks/use-inventory";
import {
  InventoryItemType,
  type InventoryItem,
} from "@/types/inventory.types";
import { toast } from "sonner";
import { Loader2, Package, Sparkles } from "lucide-react";

// Unified form schema for Create/Edit
const itemFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Item name is required")
    .max(255, "Item name cannot exceed 255 characters"),
  sku: z
    .string()
    .trim()
    .max(50, "SKU cannot exceed 50 characters")
    .transform((val) => (val === "" ? null : val.toUpperCase()))
    .optional()
    .nullable(),
  categoryId: z.string().min(1, "Please select a category"),
  itemType: z.nativeEnum(InventoryItemType, {
    message: "Item type is required",
  }),
  unit: z
    .string()
    .trim()
    .min(1, "Unit of measurement is required")
    .max(50, "Unit cannot exceed 50 characters"),
  minimumStock: z.coerce.number().min(0, "Minimum stock cannot be negative").default(0),
  purchasePrice: z.coerce
    .number()
    .min(0, "Purchase price cannot be negative")
    .optional()
    .nullable(),
  initialStock: z.coerce
    .number()
    .min(0, "Initial stock cannot be negative")
    .default(0),
  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1000 characters")
    .optional()
    .nullable(),
  isActive: z.boolean().default(true),
});

interface ItemFormData {
  name: string;
  sku?: string | null;
  categoryId: string;
  itemType: InventoryItemType;
  unit: string;
  minimumStock: number;
  purchasePrice?: number | null;
  initialStock?: number;
  description?: string | null;
  isActive: boolean;
}

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: InventoryItem | null;
  onSuccess?: (item: InventoryItem) => void;
}

const COMMON_UNITS = ["pcs", "sets", "meters", "boxes", "pairs", "rolls", "kits"];

export function ItemFormDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: ItemFormDialogProps) {
  const isEditing = Boolean(item);
  const { data: categories = [], isLoading: isLoadingCategories } =
    useInventoryCategories();
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(itemFormSchema) as any,
    defaultValues: {
      name: "",
      sku: "",
      categoryId: "",
      itemType: InventoryItemType.REUSABLE,
      unit: "pcs",
      minimumStock: 0,
      purchasePrice: null,
      initialStock: 0,
      description: "",
      isActive: true,
    },
  });

  // Watch for autogenerating SKU preview or suggestions
  const watchedName = useWatch({ control, name: "name" });
  const watchedCategory = useWatch({ control, name: "categoryId" });

  // Sync form when item prop changes or modal opens
  React.useEffect(() => {
    if (open) {
      if (item) {
        reset({
          name: item.name,
          sku: item.sku || "",
          categoryId: item.categoryId,
          itemType: item.itemType,
          unit: item.unit,
          minimumStock: item.minimumStock,
          purchasePrice: item.purchasePrice ?? null,
          initialStock: item.currentStock,
          description: item.description || "",
          isActive: item.isActive,
        });
      } else {
        reset({
          name: "",
          sku: "",
          categoryId: categories[0]?.id || "",
          itemType: InventoryItemType.REUSABLE,
          unit: "pcs",
          minimumStock: 0,
          purchasePrice: null,
          initialStock: 0,
          description: "",
          isActive: true,
        });
      }
    }
  }, [open, item, reset, categories]);

  const handleSuggestSku = () => {
    if (!watchedName) {
      toast.error("Please enter an item name first to generate a SKU.");
      return;
    }
    const cat = categories.find((c) => c.id === watchedCategory);
    const catPrefix = cat ? cat.name.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() : "EQP";
    const namePrefix = watchedName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const suggested = `${catPrefix}-${namePrefix}-${randomSuffix}`;
    setValue("sku", suggested, { shouldValidate: true });
  };

  const onSubmit = async (values: ItemFormData) => {
    try {
      if (isEditing && item) {
        const updated = await updateItem.mutateAsync({
          id: item.id,
          data: {
            name: values.name,
            description: values.description || null,
            categoryId: values.categoryId,
            itemType: values.itemType,
            sku: values.sku || null,
            unit: values.unit,
            minimumStock: Number(values.minimumStock) || 0,
            purchasePrice: values.purchasePrice != null ? Number(values.purchasePrice) : null,
            isActive: Boolean(values.isActive),
          },
        });
        toast.success(`Inventory item "${updated.name}" updated successfully.`);
        onSuccess?.(updated);
      } else {
        const created = await createItem.mutateAsync({
          name: values.name,
          description: values.description || null,
          categoryId: values.categoryId,
          itemType: values.itemType,
          sku: values.sku || null,
          unit: values.unit,
          minimumStock: Number(values.minimumStock) || 0,
          purchasePrice: values.purchasePrice != null ? Number(values.purchasePrice) : null,
          initialStock: Number(values.initialStock) || 0,
          isActive: Boolean(values.isActive),
        });
        toast.success(`Inventory item "${created.name}" created successfully.`);
        onSuccess?.(created);
      }
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save inventory item.";
      toast.error(msg);
    }
  };

  const isPending = isSubmitting || createItem.isPending || updateItem.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Package className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {isEditing ? "Edit Inventory Item" : "Create New Inventory Item"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {isEditing
                  ? "Update item details, categories, minimum thresholds, or unit rates."
                  : "Add equipment or consumables into the master warehouse directory."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Item Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-medium">
              Item Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g. Shure QLXD24 Beta 58A Wireless Mic, RGBWA Par Can"
              {...register("name")}
              className="h-8 text-xs"
            />
            {errors.name && (
              <p className="text-[11px] text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Category & Item Type Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Category Select */}
            <div className="space-y-1.5">
              <Label htmlFor="categoryId" className="text-xs font-medium">
                Category <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isLoadingCategories}
                  >
                    <SelectTrigger id="categoryId" className="h-8 w-full text-xs">
                      <SelectValue placeholder="Select Category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.categoryId && (
                <p className="text-[11px] text-destructive">
                  {errors.categoryId.message}
                </p>
              )}
            </div>

            {/* Item Type */}
            <div className="space-y-1.5">
              <Label htmlFor="itemType" className="text-xs font-medium">
                Item Classification <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="itemType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="itemType" className="h-8 w-full text-xs">
                      <SelectValue placeholder="Select Classification..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={InventoryItemType.REUSABLE}>
                        REUSABLE (Durable Equipment)
                      </SelectItem>
                      <SelectItem value={InventoryItemType.CONSUMABLE}>
                        CONSUMABLE (Single-use Supplies)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.itemType && (
                <p className="text-[11px] text-destructive">
                  {errors.itemType.message}
                </p>
              )}
            </div>
          </div>

          {/* SKU & Unit Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* SKU with Autogenerate button */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="sku" className="text-xs font-medium">
                  SKU / Asset Tag
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={handleSuggestSku}
                  className="h-5 px-1.5 text-[10px] text-primary gap-1"
                >
                  <Sparkles className="size-2.5" />
                  Suggest SKU
                </Button>
              </div>
              <Input
                id="sku"
                placeholder="e.g. MIC-WIR-1001"
                {...register("sku")}
                className="h-8 text-xs font-mono uppercase"
              />
              {errors.sku && (
                <p className="text-[11px] text-destructive">{errors.sku.message}</p>
              )}
            </div>

            {/* Unit */}
            <div className="space-y-1.5">
              <Label htmlFor="unit" className="text-xs font-medium">
                Unit of Measurement <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-1.5">
                <Input
                  id="unit"
                  placeholder="e.g. pcs, sets, meters"
                  {...register("unit")}
                  className="h-8 text-xs flex-1"
                />
              </div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {COMMON_UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setValue("unit", u, { shouldValidate: true })}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {u}
                  </button>
                ))}
              </div>
              {errors.unit && (
                <p className="text-[11px] text-destructive">{errors.unit.message}</p>
              )}
            </div>
          </div>

          {/* Minimum Stock, Purchase Price & Initial Stock */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Minimum Stock */}
            <div className="space-y-1.5">
              <Label htmlFor="minimumStock" className="text-xs font-medium">
                Min Stock Alert Level
              </Label>
              <Input
                id="minimumStock"
                type="number"
                min="0"
                step="1"
                {...register("minimumStock", { valueAsNumber: true })}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Alerts when stock falls to/below this.
              </p>
              {errors.minimumStock && (
                <p className="text-[11px] text-destructive">
                  {errors.minimumStock.message}
                </p>
              )}
            </div>

            {/* Purchase Price */}
            <div className="space-y-1.5">
              <Label htmlFor="purchasePrice" className="text-xs font-medium">
                Purchase Cost (₹)
              </Label>
              <Input
                id="purchasePrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                {...register("purchasePrice", {
                  setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                })}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Per-unit procurement cost.
              </p>
              {errors.purchasePrice && (
                <p className="text-[11px] text-destructive">
                  {errors.purchasePrice.message}
                </p>
              )}
            </div>

            {/* Initial Stock (Only on Create) */}
            {!isEditing ? (
              <div className="space-y-1.5">
                <Label htmlFor="initialStock" className="text-xs font-medium">
                  Initial Stock Quantity
                </Label>
                <Input
                  id="initialStock"
                  type="number"
                  min="0"
                  step="1"
                  {...register("initialStock", { valueAsNumber: true })}
                  className="h-8 text-xs font-medium"
                />
                <p className="text-[10px] text-muted-foreground">
                  Logged as initial purchase ledger entry.
                </p>
                {errors.initialStock && (
                  <p className="text-[11px] text-destructive">
                    {errors.initialStock.message}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Current Warehouse Stock
                </Label>
                <div className="h-8 flex items-center px-2.5 rounded-lg border border-border bg-muted/40 text-xs font-semibold">
                  {item?.currentStock} {item?.unit}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Use Adjustments or Purchases to alter.
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-medium">
              Description & Specifications
            </Label>
            <Textarea
              id="description"
              placeholder="e.g. Dimensions, power draw, channel specs, storage case location..."
              {...register("description")}
              className="min-h-16 text-xs resize-none"
            />
            {errors.description && (
              <p className="text-[11px] text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Active Status (Switch) */}
          <div className="flex items-center justify-between rounded-lg border border-border/80 p-2.5 bg-muted/20">
            <div className="space-y-0.5">
              <Label htmlFor="isActive" className="text-xs font-medium">
                Active in Catalog
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Inactive items cannot be allocated to new events.
              </p>
            </div>
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Switch
                  id="isActive"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
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
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  {isEditing ? "Saving Changes..." : "Creating Item..."}
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Create Item"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
