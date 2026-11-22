"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Plus,
  Search,
  FolderTree,
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
  MoreVertical,
  Pencil,
  FileSearch,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertOctagon,
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatCard } from "@/components/shared/stat-card";
import {
  useInventoryItems,
  useInventoryCategories,
  useDeleteInventoryItem,
  ItemFormDialog,
  CategoryManagerDialog,
} from "@/features/inventory";
import {
  InventoryItemType,
  type InventoryItem,
} from "@/types/inventory.types";
import { formatINR } from "@/lib/formatters";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function InventoryPage() {
  const router = useRouter();

  // Dialog states
  const [itemFormOpen, setItemFormOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<InventoryItem | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = React.useState(false);
  const [itemToDelete, setItemToDelete] = React.useState<InventoryItem | null>(null);

  // Filters & Pagination
  const [search, setSearch] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [selectedType, setSelectedType] = React.useState<string>("all");
  const [lowStockOnly, setLowStockOnly] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const limit = 20;

  // Unfiltered items for global KPIs
  const { data: allItemsData, isLoading: isLoadingStats } = useInventoryItems({
    page: 1,
    limit: 100,
    isActive: true,
  });
  const allItems = allItemsData?.items || [];
  const totalSkus = allItemsData?.meta?.total ?? allItems.length;
  const healthyCount = allItems.filter(
    (i) => i.currentStock > i.minimumStock
  ).length;
  const lowStockCount = allItems.filter(
    (i) => i.currentStock <= i.minimumStock && i.currentStock > 0
  ).length;
  const outOfStockCount = allItems.filter((i) => i.currentStock === 0).length;

  // Filtered catalog list
  const {
    data: catalogData,
    isLoading,
    refetch,
    isRefetching,
  } = useInventoryItems({
    search: search.trim() || undefined,
    categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
    itemType:
      selectedType !== "all" ? (selectedType as InventoryItemType) : undefined,
    lowStock: lowStockOnly ? true : undefined,
    page,
    limit,
  });

  const { data: categories = [], isLoading: isLoadingCategories } =
    useInventoryCategories();
  const deleteMutation = useDeleteInventoryItem();

  const items = catalogData?.items || [];
  const meta = catalogData?.meta;
  const totalPages = meta?.totalPages ?? 1;

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setItemFormOpen(true);
  };

  const handleAddItem = () => {
    setEditingItem(null);
    setItemFormOpen(true);
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      await deleteMutation.mutateAsync(itemToDelete.id);
      toast.success(`Item "${itemToDelete.name}" deleted successfully.`);
      setItemToDelete(null);
      refetch();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to delete item. Items with recorded stock movements cannot be deleted."
      );
    }
  };

  const resetFilters = () => {
    setSearch("");
    setSelectedCategory("all");
    setSelectedType("all");
    setLowStockOnly(false);
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    selectedCategory !== "all" ||
    selectedType !== "all" ||
    lowStockOnly;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Inventory Management
            </h1>
            <Badge variant="outline" className="text-xs font-semibold">
              Warehouse Catalog
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Master SKU catalog, current stock levels, low-stock threshold alerts, and category management.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5"
            onClick={() => setCategoryManagerOpen(true)}
          >
            <FolderTree className="size-3.5" />
            Manage Categories
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5"
            render={<Link href="/inventory/movements" />}
          >
            <ArrowLeftRight className="size-3.5" />
            Stock Movements
          </Button>
          <Button
            size="sm"
            className="text-xs h-8 gap-1.5 font-medium"
            onClick={handleAddItem}
          >
            <Plus className="size-3.5" />
            Add Item
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total SKUs"
          value={totalSkus}
          icon={Boxes}
          description="Total active warehouse items"
          isLoading={isLoadingStats}
        />
        <StatCard
          title="Stock Health"
          value={healthyCount}
          icon={CheckCircle2}
          description="Items above reorder minimum"
          isLoading={isLoadingStats}
          className="border-emerald-500/20 bg-emerald-500/5"
        />
        <StatCard
          title="Low Stock Alerts"
          value={lowStockCount}
          icon={AlertTriangle}
          description="Items at or below threshold"
          isLoading={isLoadingStats}
          className={cn(
            lowStockCount > 0
              ? "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
              : ""
          )}
        />
        <StatCard
          title="Out of Stock"
          value={outOfStockCount}
          icon={AlertOctagon}
          description="Items with zero units remaining"
          isLoading={isLoadingStats}
          className={cn(
            outOfStockCount > 0
              ? "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400"
              : ""
          )}
        />
      </div>

      {/* Main Catalog Card */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Master Stock Catalog</CardTitle>
              <CardDescription className="text-xs">
                Real-time warehouse equipment inventory with live threshold alerts and audit tracking.
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
          <div className="pt-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative min-w-[200px] flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search item name or SKU..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              {/* Category Select */}
              <select
                aria-label="Filter by Category"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                disabled={isLoadingCategories}
                className="h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              {/* Type Select */}
              <select
                aria-label="Filter by Item Type"
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">All Item Types</option>
                <option value={InventoryItemType.REUSABLE}>Reusable Gear</option>
                <option value={InventoryItemType.CONSUMABLE}>Consumable Supplies</option>
              </select>

              {/* Reset Filters */}
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

            {/* Low Stock Toggle Switch */}
            <div className="flex items-center gap-2 pl-1 border-t lg:border-t-0 pt-2 lg:pt-0">
              <Switch
                id="low-stock-switch"
                checked={lowStockOnly}
                onCheckedChange={(checked) => {
                  setLowStockOnly(checked);
                  setPage(1);
                }}
              />
              <Label
                htmlFor="low-stock-switch"
                className="text-xs font-medium cursor-pointer select-none"
              >
                Low Stock Only
              </Label>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
              <RefreshCw className="size-6 animate-spin mx-auto text-primary" />
              <p>Loading inventory items...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center border-dashed rounded-lg bg-muted/5 mx-4 my-4">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                <Boxes className="size-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                {hasActiveFilters ? "No matching items found" : "No inventory items in catalog"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                {hasActiveFilters
                  ? "Try loosening your search or filter criteria to see results."
                  : "Start populating your warehouse inventory catalog with reusable gear or consumable materials."}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                {hasActiveFilters ? (
                  <Button size="sm" variant="outline" onClick={resetFilters} className="text-xs">
                    Clear Filters
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleAddItem} className="text-xs gap-1.5">
                    <Plus className="size-3.5" /> Add First Item
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[280px]">Item Name & SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Min Threshold</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-center">Stock Health</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const isOutOfStock = item.currentStock === 0;
                    const isLowStock =
                      !isOutOfStock && item.currentStock <= item.minimumStock;

                    return (
                      <TableRow
                        key={item.id}
                        className={cn(
                          "cursor-pointer transition-colors",
                          isOutOfStock && "bg-rose-500/5 hover:bg-rose-500/10",
                          isLowStock && "bg-amber-500/5 hover:bg-amber-500/10"
                        )}
                        onClick={() => router.push(`/inventory/items/${item.id}`)}
                      >
                        {/* Name & SKU */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground text-xs hover:text-primary transition-colors">
                              {item.name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {item.sku ? (
                                <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
                                  {item.sku}
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground/60 italic">
                                  No SKU
                                </span>
                              )}
                              {!item.isActive && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Category */}
                        <TableCell className="text-xs text-muted-foreground">
                          {item.category?.name || "Uncategorized"}
                        </TableCell>

                        {/* Item Type */}
                        <TableCell>
                          {item.itemType === InventoryItemType.REUSABLE ? (
                            <Badge
                              variant="outline"
                              className="text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                            >
                              Reusable
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            >
                              Consumable
                            </Badge>
                          )}
                        </TableCell>

                        {/* Current Stock */}
                        <TableCell className="text-right font-mono text-xs font-semibold">
                          <span
                            className={cn(
                              isOutOfStock
                                ? "text-rose-600 dark:text-rose-400"
                                : isLowStock
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-foreground"
                            )}
                          >
                            {item.currentStock} {item.unit}
                          </span>
                        </TableCell>

                        {/* Minimum Stock */}
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {item.minimumStock} {item.unit}
                        </TableCell>

                        {/* Purchase Price */}
                        <TableCell className="text-right font-mono text-xs">
                          {item.purchasePrice !== null && item.purchasePrice !== undefined
                            ? formatINR(item.purchasePrice)
                            : "-"}
                        </TableCell>

                        {/* Stock Health Status */}
                        <TableCell className="text-center">
                          {isOutOfStock ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                            >
                              Out of Stock
                            </Badge>
                          ) : isLowStock ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            >
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            >
                              Healthy
                            </Badge>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="size-7"
                                />
                              }
                            >
                              <MoreVertical className="size-3.5" />
                              <span className="sr-only">Actions</span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 text-xs">
                              <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">
                                SKU Operations
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => router.push(`/inventory/items/${item.id}`)}
                                className="gap-2 cursor-pointer"
                              >
                                <FileSearch className="size-3.5 text-muted-foreground" />
                                Audit & Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleEditItem(item)}
                                className="gap-2 cursor-pointer"
                              >
                                <Pencil className="size-3.5 text-muted-foreground" />
                                Edit SKU
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setItemToDelete(item)}
                                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                                Delete Item
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Footer */}
          {meta && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 text-xs text-muted-foreground">
              <div>
                Showing {(page - 1) * limit + 1} to{" "}
                {Math.min(page * limit, meta.total)} of {meta.total} items
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

      {/* Item Create / Edit Dialog */}
      <ItemFormDialog
        open={itemFormOpen}
        onOpenChange={(open) => {
          setItemFormOpen(open);
          if (!open) setEditingItem(null);
        }}
        item={editingItem}
        onSuccess={() => {
          refetch();
        }}
      />

      {/* Category Manager Sheet Dialog */}
      <CategoryManagerDialog
        open={categoryManagerOpen}
        onOpenChange={setCategoryManagerOpen}
      />

      {/* Delete Item Confirmation Prompt */}
      <ConfirmDialog
        open={Boolean(itemToDelete)}
        onOpenChange={(open) => !open && setItemToDelete(null)}
        title="Delete Inventory Item"
        description={`Are you sure you want to delete "${itemToDelete?.name}" (${itemToDelete?.sku || "No SKU"})? Note: Items with logged stock movements cannot be removed from warehouse history.`}
        confirmText="Delete Item"
        variant="destructive"
        onConfirm={handleDeleteItem}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
