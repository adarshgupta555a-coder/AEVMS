"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  Pencil,
  ShoppingCart,
  SlidersHorizontal,
  ShieldAlert,
  AlertOctagon,
  Calendar,
  DollarSign,
  TrendingDown,
  RefreshCw,
  Clock,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import {
  useInventoryItem,
  useInventoryMovements,
  StockAuditCard,
  PurchaseDialog,
  AdjustmentDialog,
  DamageLossDialog,
  ItemFormDialog,
} from "@/features/inventory";
import {
  InventoryItemType,
  InventoryMovementType,
} from "@/types/inventory.types";
import { formatDateTime, formatINR } from "@/lib/formatters";
import { useSetBreadcrumbTitle } from "@/store/breadcrumb-store";
import { cn } from "@/lib/utils";

// Movement badge styling
const MOVEMENT_CONFIG: Record<
  InventoryMovementType,
  { label: string; className: string; isPositive: boolean }
> = {
  [InventoryMovementType.PURCHASE]: {
    label: "Purchase",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    isPositive: true,
  },
  [InventoryMovementType.ADJUSTMENT_IN]: {
    label: "Adjustment In",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    isPositive: true,
  },
  [InventoryMovementType.EVENT_RETURN]: {
    label: "Event Return",
    className: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
    isPositive: true,
  },
  [InventoryMovementType.EVENT_ISSUE]: {
    label: "Event Issue",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    isPositive: false,
  },
  [InventoryMovementType.ADJUSTMENT_OUT]: {
    label: "Adjustment Out",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    isPositive: false,
  },
  [InventoryMovementType.DAMAGE]: {
    label: "Damage Write-off",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    isPositive: false,
  },
  [InventoryMovementType.LOSS]: {
    label: "Loss Write-off",
    className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    isPositive: false,
  },
};

export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);

  // Queries
  const {
    data: item,
    isLoading: isLoadingItem,
    isError: isItemError,
    error: itemError,
    refetch: refetchItem,
    isRefetching: isRefetchingItem,
  } = useInventoryItem(id);

  const {
    data: movementsData,
    isLoading: isLoadingMovements,
    refetch: refetchMovements,
  } = useInventoryMovements({
    inventoryItemId: id,
    page: 1,
    limit: 50,
  });

  // Dynamic breadcrumb
  useSetBreadcrumbTitle(
    item ? `${item.name} (${item.sku || "No SKU"})` : "Item Details"
  );

  // Quick Action Dialog States
  const [purchaseOpen, setPurchaseOpen] = React.useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = React.useState(false);
  const [damageLossOpen, setDamageLossOpen] = React.useState(false);
  const [editItemOpen, setEditItemOpen] = React.useState(false);

  const handleActionsSuccess = () => {
    refetchItem();
    refetchMovements();
  };

  if (isLoadingItem) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    );
  }

  if (isItemError || !item) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            render={<Link href="/inventory" />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Item Not Found
          </h1>
        </div>
        <Card className="border-destructive/30 bg-destructive/5 text-destructive">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3">
            <AlertOctagon className="size-8 text-destructive" />
            <p className="text-sm font-medium">
              {itemError?.message || "The requested inventory item could not be retrieved."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchItem()}
              className="text-xs"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOutOfStock = item.currentStock === 0;
  const isLowStock = !isOutOfStock && item.currentStock <= item.minimumStock;
  const movements = movementsData?.movements || [];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              render={<Link href="/inventory" />}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {item.name}
            </h1>
            {item.sku && (
              <Badge variant="outline" className="font-mono text-xs font-semibold">
                {item.sku}
              </Badge>
            )}
            {item.itemType === InventoryItemType.REUSABLE ? (
              <Badge
                variant="outline"
                className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-medium"
              >
                Reusable Gear
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium"
              >
                Consumable Supply
              </Badge>
            )}
            {!item.isActive && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Inactive
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-9">
            Category:{" "}
            <span className="font-medium text-foreground">
              {item.category?.name || "Uncategorized"}
            </span>{" "}
            • Unit:{" "}
            <span className="font-mono text-foreground">{item.unit}</span>
            {item.description && ` • ${item.description}`}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5"
            onClick={() => setEditItemOpen(true)}
          >
            <Pencil className="size-3.5" />
            Edit SKU
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5"
            onClick={() => setAdjustmentOpen(true)}
          >
            <SlidersHorizontal className="size-3.5" />
            +/- Adjust
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5"
            onClick={() => setDamageLossOpen(true)}
          >
            <ShieldAlert className="size-3.5 text-rose-500" />
            Write-off Damage/Loss
          </Button>
          <Button
            size="sm"
            className="text-xs h-8 gap-1.5 font-medium"
            onClick={() => setPurchaseOpen(true)}
          >
            <ShoppingCart className="size-3.5" />
            + Purchase
          </Button>
        </div>
      </div>

      {/* Overview Stat Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Current Warehouse Stock"
          value={`${item.currentStock} ${item.unit}`}
          icon={Boxes}
          description={
            isOutOfStock
              ? "Critical: Zero units in warehouse"
              : isLowStock
              ? "Warning: At or below reorder threshold"
              : "Healthy stock level"
          }
          className={cn(
            isOutOfStock
              ? "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400"
              : isLowStock
              ? "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
              : "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
          )}
        />
        <StatCard
          title="Reorder Threshold"
          value={`${item.minimumStock} ${item.unit}`}
          icon={TrendingDown}
          description="Minimum safety stock level"
        />
        <StatCard
          title="Currently Allocated to Events"
          value={`${item.metrics?.currentlyAllocatedToEvents ?? 0} ${item.unit}`}
          icon={Calendar}
          description="Assigned across ongoing events"
        />
        <StatCard
          title="Purchase Cost Per Unit"
          value={item.purchasePrice !== null ? formatINR(item.purchasePrice) : "-"}
          icon={DollarSign}
          description="Standard procurement cost"
        />
      </div>

      {/* Mathematical Audit Reconciliation Card */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Double-Entry Mathematical Stock Audit
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleActionsSuccess()}
            disabled={isRefetchingItem}
            className="h-7 text-xs gap-1.5"
          >
            <RefreshCw
              className={cn("size-3", isRefetchingItem && "animate-spin")}
            />
            Re-audit Stock
          </Button>
        </div>
        <StockAuditCard
          itemId={item.id}
          itemName={item.name}
          sku={item.sku}
        />
      </div>

      {/* Item-Specific Stock Movement History Table */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold">
                Transaction History Ledger
              </CardTitle>
              <CardDescription className="text-xs">
                All double-entry stock transactions recorded specifically for SKU{" "}
                <span className="font-mono font-medium">{item.sku || item.name}</span>.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs w-fit">
              {movements.length} logged movements
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingMovements ? (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
              <RefreshCw className="size-6 animate-spin mx-auto text-primary" />
              <p>Loading item transaction history...</p>
            </div>
          ) : movements.length === 0 ? (
            <div className="p-12 text-center border-dashed rounded-lg bg-muted/5 mx-4 my-4">
              <div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2 text-muted-foreground">
                <Clock className="size-5" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                No movements recorded yet
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Record a purchase or stock adjustment above to register the first ledger entry for this SKU.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[170px]">Date & Time</TableHead>
                    <TableHead>Movement Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Reference / PO#</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="min-w-[200px]">Audit Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => {
                    const cfg =
                      MOVEMENT_CONFIG[movement.movementType] || {
                        label: movement.movementType,
                        className: "bg-muted text-foreground",
                        isPositive: false,
                      };

                    return (
                      <TableRow key={movement.id} className="text-xs">
                        {/* Timestamp */}
                        <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                          {formatDateTime(movement.movementDate || movement.createdAt)}
                        </TableCell>

                        {/* Movement Type */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("text-[11px] font-semibold border", cfg.className)}
                          >
                            {cfg.label}
                          </Badge>
                        </TableCell>

                        {/* Quantity */}
                        <TableCell className="text-right font-mono font-bold">
                          <span
                            className={cn(
                              cfg.isPositive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            )}
                          >
                            {cfg.isPositive ? "+" : "-"}
                            {movement.quantity} {item.unit}
                          </span>
                        </TableCell>

                        {/* Reference Number */}
                        <TableCell>
                          {movement.referenceNumber ? (
                            <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground">
                              {movement.referenceNumber}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 italic">-</span>
                          )}
                        </TableCell>

                        {/* Unit Cost */}
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {movement.unitCost !== null && movement.unitCost !== undefined
                            ? formatINR(movement.unitCost)
                            : "-"}
                        </TableCell>

                        {/* Notes */}
                        <TableCell className="text-muted-foreground">
                          {movement.notes || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialogs */}
      <PurchaseDialog
        open={purchaseOpen}
        onOpenChange={setPurchaseOpen}
        preselectedItemId={item.id}
        preselectedItem={item}
        onSuccess={handleActionsSuccess}
      />

      <AdjustmentDialog
        open={adjustmentOpen}
        onOpenChange={setAdjustmentOpen}
        preselectedItemId={item.id}
        preselectedItem={item}
        onSuccess={handleActionsSuccess}
      />

      <DamageLossDialog
        open={damageLossOpen}
        onOpenChange={setDamageLossOpen}
        preselectedItemId={item.id}
        preselectedItem={item}
        onSuccess={handleActionsSuccess}
      />

      <ItemFormDialog
        open={editItemOpen}
        onOpenChange={setEditItemOpen}
        item={item}
        onSuccess={handleActionsSuccess}
      />
    </div>
  );
}
