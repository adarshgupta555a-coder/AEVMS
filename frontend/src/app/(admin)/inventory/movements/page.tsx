"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  SlidersHorizontal,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Search,
  ShoppingCart,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
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
  useInventoryMovements,
  useInventoryItems,
  PurchaseDialog,
  AdjustmentDialog,
  DamageLossDialog,
} from "@/features/inventory";
import {
  InventoryMovementType,
} from "@/types/inventory.types";
import { formatDateTime, formatINR } from "@/lib/formatters";
import { cn } from "@/lib/utils";

// Movement badge configuration matching docs/inventory-frontend-guide.md
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

export default function StockMovementsPage() {
  // Action Dialog States
  const [purchaseOpen, setPurchaseOpen] = React.useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = React.useState(false);
  const [damageLossOpen, setDamageLossOpen] = React.useState(false);

  // Filters
  const [selectedType, setSelectedType] = React.useState<string>("ALL");
  const [selectedItemId, setSelectedItemId] = React.useState<string>("ALL");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const limit = 25;

  // Inventory items for filter dropdown
  const { data: itemsData, isLoading: isLoadingItems } = useInventoryItems({
    page: 1,
    limit: 100,
  });
  const itemsList = itemsData?.items || [];

  // Query Movements
  const {
    data: movementsData,
    isLoading,
    refetch,
    isRefetching,
  } = useInventoryMovements({
    movementType:
      selectedType !== "ALL"
        ? (selectedType as InventoryMovementType)
        : undefined,
    inventoryItemId: selectedItemId !== "ALL" ? selectedItemId : undefined,
    page,
    limit,
  });

  const movements = React.useMemo(
    () => movementsData?.movements || [],
    [movementsData]
  );
  const meta = movementsData?.meta;
  const totalPages = meta?.totalPages ?? 1;

  // Filter client-side search across notes / reference numbers / item names
  const filteredMovements = React.useMemo(() => {
    if (!search.trim()) return movements;
    const q = search.toLowerCase();
    return movements.filter(
      (m) =>
        m.inventoryItem?.name.toLowerCase().includes(q) ||
        m.inventoryItem?.sku?.toLowerCase().includes(q) ||
        m.referenceNumber?.toLowerCase().includes(q) ||
        m.notes?.toLowerCase().includes(q)
    );
  }, [movements, search]);

  // Statistics calculation for the current query view
  const inflowCount = filteredMovements.filter((m) =>
    [
      InventoryMovementType.PURCHASE,
      InventoryMovementType.ADJUSTMENT_IN,
      InventoryMovementType.EVENT_RETURN,
    ].includes(m.movementType)
  ).length;

  const outflowCount = filteredMovements.filter((m) =>
    [
      InventoryMovementType.EVENT_ISSUE,
      InventoryMovementType.ADJUSTMENT_OUT,
    ].includes(m.movementType)
  ).length;

  const damageLossCount = filteredMovements.filter((m) =>
    [InventoryMovementType.DAMAGE, InventoryMovementType.LOSS].includes(
      m.movementType
    )
  ).length;

  const resetFilters = () => {
    setSelectedType("ALL");
    setSelectedItemId("ALL");
    setSearch("");
    setPage(1);
  };

  const hasActiveFilters =
    selectedType !== "ALL" || selectedItemId !== "ALL" || Boolean(search.trim());

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
              Stock Movements Ledger
            </h1>
            <Badge variant="outline" className="text-xs font-semibold">
              Double-Entry Audit Log
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 ml-9">
            Immutable transaction ledger logging stock purchases, event disbursements, returns, and write-offs.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5"
            onClick={() => setDamageLossOpen(true)}
          >
            <ShieldAlert className="size-3.5 text-rose-500" />
            Report Damage/Loss
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5"
            onClick={() => setAdjustmentOpen(true)}
          >
            <SlidersHorizontal className="size-3.5" />
            +/- Manual Adjustment
          </Button>
          <Button
            size="sm"
            className="text-xs h-8 gap-1.5 font-medium"
            onClick={() => setPurchaseOpen(true)}
          >
            <ShoppingCart className="size-3.5" />
            + Record Purchase
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Ledger Entries"
          value={meta?.total ?? filteredMovements.length}
          icon={ArrowLeftRight}
          description="Logged warehouse transactions"
          isLoading={isLoading}
        />
        <StatCard
          title="Stock Inflows"
          value={inflowCount}
          icon={ArrowDownLeft}
          description="Purchases, adjustments, returns"
          isLoading={isLoading}
          className="border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          title="Stock Outflows"
          value={outflowCount}
          icon={ArrowUpRight}
          description="Dispatches to events, adjustments"
          isLoading={isLoading}
          className="border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title="Damage & Loss Entries"
          value={damageLossCount}
          icon={AlertTriangle}
          description="Written-off assets"
          isLoading={isLoading}
          className={cn(
            damageLossCount > 0 ? "border-rose-500/20 bg-rose-500/5" : ""
          )}
        />
      </div>

      {/* Main Ledger Card */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Audit Ledger</CardTitle>
              <CardDescription className="text-xs">
                Complete chronological record of all stock increments and decrements with reference codes.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="h-8 text-xs gap-1.5"
              >
                <RefreshCw
                  className={cn("size-3.5", isRefetching && "animate-spin")}
                />
                Refresh
              </Button>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="pt-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {/* Search text */}
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter by ref#, SKU, notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              {/* Movement Type Filter */}
              <select
                aria-label="Filter by Movement Type"
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">All Movement Types</option>
                <option value={InventoryMovementType.PURCHASE}>Purchases (Inflow)</option>
                <option value={InventoryMovementType.EVENT_ISSUE}>Event Issues (Outflow)</option>
                <option value={InventoryMovementType.EVENT_RETURN}>Event Returns (Inflow)</option>
                <option value={InventoryMovementType.ADJUSTMENT_IN}>Manual Adjust In (+)</option>
                <option value={InventoryMovementType.ADJUSTMENT_OUT}>Manual Adjust Out (-)</option>
                <option value={InventoryMovementType.DAMAGE}>Damage Write-off</option>
                <option value={InventoryMovementType.LOSS}>Loss Write-off</option>
              </select>

              {/* Item Filter */}
              <select
                aria-label="Filter by Item"
                value={selectedItemId}
                onChange={(e) => {
                  setSelectedItemId(e.target.value);
                  setPage(1);
                }}
                disabled={isLoadingItems}
                className="h-8 max-w-[220px] truncate rounded-lg border border-input bg-background px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">All Inventory Items</option>
                {itemsList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} {item.sku ? `(${item.sku})` : ""}
                  </option>
                ))}
              </select>

              {/* Clear button */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
              <RefreshCw className="size-6 animate-spin mx-auto text-primary" />
              <p>Loading stock movements ledger...</p>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="p-12 text-center border-dashed rounded-lg bg-muted/5 mx-4 my-4">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                <ArrowLeftRight className="size-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                {hasActiveFilters
                  ? "No movements match your filter"
                  : "No stock movements recorded yet"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                {hasActiveFilters
                  ? "Reset your search criteria or choose another movement type."
                  : "Record your first inventory purchase, adjustment, or issue gear to an event to begin building the immutable ledger."}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                {hasActiveFilters ? (
                  <Button size="sm" variant="outline" onClick={resetFilters} className="text-xs">
                    Clear Filters
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setPurchaseOpen(true)} className="text-xs gap-1.5">
                    <Plus className="size-3.5" /> Record Purchase
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[170px]">Date & Time</TableHead>
                    <TableHead className="w-[240px]">Item & SKU</TableHead>
                    <TableHead>Movement Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Reference / PO#</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="min-w-[200px]">Audit Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.map((movement) => {
                    const cfg =
                      MOVEMENT_CONFIG[movement.movementType] || {
                        label: movement.movementType,
                        className: "bg-muted text-foreground",
                        isPositive: false,
                      };
                    const unit = movement.inventoryItem?.unit || "units";

                    return (
                      <TableRow key={movement.id} className="text-xs">
                        {/* Timestamp */}
                        <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                          {formatDateTime(movement.movementDate || movement.createdAt)}
                        </TableCell>

                        {/* Item Name & SKU Link */}
                        <TableCell>
                          <div className="flex flex-col">
                            <Link
                              href={`/inventory/items/${movement.inventoryItemId}`}
                              className="font-medium text-foreground hover:text-primary transition-colors underline-offset-2 hover:underline line-clamp-1"
                            >
                              {movement.inventoryItem?.name || "Unknown Item"}
                            </Link>
                            {movement.inventoryItem?.sku && (
                              <span className="font-mono text-[10px] text-muted-foreground mt-0.5">
                                {movement.inventoryItem.sku}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Movement Type Badge */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("text-[11px] font-semibold border", cfg.className)}
                          >
                            {cfg.label}
                          </Badge>
                        </TableCell>

                        {/* Quantity with +/- prefix */}
                        <TableCell className="text-right font-mono font-bold">
                          <span
                            className={cn(
                              cfg.isPositive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            )}
                          >
                            {cfg.isPositive ? "+" : "-"}
                            {movement.quantity} {unit}
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
                          <span className="line-clamp-2" title={movement.notes || undefined}>
                            {movement.notes || "-"}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {meta && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 text-xs text-muted-foreground">
              <div>
                Showing {(page - 1) * limit + 1} to{" "}
                {Math.min(page * limit, meta.total)} of {meta.total} movements
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-3.5 mr-1" />
                  Previous
                </Button>
                <span className="px-2 font-mono">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="size-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purchase Modal */}
      <PurchaseDialog
        open={purchaseOpen}
        onOpenChange={setPurchaseOpen}
        onSuccess={() => refetch()}
      />

      {/* Manual Adjustment Modal */}
      <AdjustmentDialog
        open={adjustmentOpen}
        onOpenChange={setAdjustmentOpen}
        onSuccess={() => refetch()}
      />

      {/* Damage & Loss Modal */}
      <DamageLossDialog
        open={damageLossOpen}
        onOpenChange={setDamageLossOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
