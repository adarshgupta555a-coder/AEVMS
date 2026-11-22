"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Truck,
  Building2,
  RotateCcw,
  RefreshCw,
  Layers,
  DollarSign,
  AlertCircle,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  useEventInventory,
  EventAllocationDialog,
  EventIssueDialog,
  EventReturnDialog,
} from "@/features/inventory";
import {
  InventoryUsageType,
  type EventInventoryAllocation,
} from "@/types/inventory.types";
import { formatDate, formatINR } from "@/lib/formatters";
import { useSetBreadcrumbTitle } from "@/store/breadcrumb-store";
import { cn } from "@/lib/utils";

// Event status badge styling helper
const statusBadgeConfig: Record<string, { label: string; className: string }> = {
  DRAFT: {
    label: "Draft",
    className: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
  },
  CONFIRMED: {
    label: "Confirmed",
    className: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
  },
  PLANNING: {
    label: "Planning",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  },
};

export default function EventInventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = React.use(params);

  // Queries
  const {
    data: eventInventoryData,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useEventInventory(eventId);

  const event = eventInventoryData?.event;
  const summary = eventInventoryData?.summary;
  const allocations = React.useMemo(
    () => eventInventoryData?.allocations || [],
    [eventInventoryData]
  );

  // Breadcrumb hook
  useSetBreadcrumbTitle(
    event ? `${event.title} - Equipment Logistics` : "Equipment Logistics"
  );

  // Dialog states
  const [allocationDialogOpen, setAllocationDialogOpen] = React.useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = React.useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = React.useState(false);
  const [selectedAllocation, setSelectedAllocation] =
    React.useState<EventInventoryAllocation | null>(null);

  // Filter allocations by usage type
  const ownedAllocations = React.useMemo(
    () => allocations.filter((a) => a.usageType === InventoryUsageType.OWNED),
    [allocations]
  );

  const rentedAllocations = React.useMemo(
    () => allocations.filter((a) => a.usageType === InventoryUsageType.RENTED),
    [allocations]
  );

  const handleOpenIssue = (allocation: EventInventoryAllocation) => {
    setSelectedAllocation(allocation);
    setIssueDialogOpen(true);
  };

  const handleOpenReturn = (allocation: EventInventoryAllocation) => {
    setSelectedAllocation(allocation);
    setReturnDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !eventInventoryData || !event) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            render={<Link href={`/events/${eventId}`} />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Event Logistics Unavailable
          </h1>
        </div>
        <Card className="border-destructive/30 bg-destructive/5 text-destructive">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm font-medium">
              {error?.message || "Failed to load event equipment logistics details."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="text-xs"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStatus = event.status || "DRAFT";
  const statusCfg = statusBadgeConfig[currentStatus] || {
    label: currentStatus,
    className: "bg-muted text-foreground",
  };

  return (
    <div className="space-y-6">
      {/* Event Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              render={<Link href={`/events/${eventId}`} />}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {event.title}
            </h1>
            <Badge
              variant="outline"
              className={cn("text-xs font-semibold", statusCfg.className)}
            >
              {statusCfg.label}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1 ml-9">
            <span className="font-mono font-medium text-foreground">
              {event.eventNumber}
            </span>
            <span>•</span>
            <span>Date: {formatDate(event.eventDate)}</span>
            <span>•</span>
            <Link
              href={`/events/${eventId}`}
              className="text-primary hover:underline font-medium"
            >
              View Main Event Hub &rarr;
            </Link>
          </div>
        </div>

        {/* Header Actions */}
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
          <Button
            size="sm"
            className="text-xs h-8 gap-1.5 font-medium"
            onClick={() => setAllocationDialogOpen(true)}
          >
            <Plus className="size-3.5" />
            Allocate Equipment
          </Button>
        </div>
      </div>

      {/* Summary Metrics Banner (5 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          title="Total Allocations"
          value={`${summary?.totalAllocatedItems ?? 0} Items`}
          icon={Layers}
          description="Total planned equipment lines"
        />
        <StatCard
          title="Owned Warehouse Gear"
          value={`${summary?.ownedItemsCount ?? 0} Assets`}
          icon={Building2}
          description="Sourced from internal warehouse"
        />
        <StatCard
          title="Rented Equipment"
          value={`${summary?.rentedItemsCount ?? 0} Rentals`}
          icon={Truck}
          description="Third-party vendor rentals"
        />
        <StatCard
          title="Total Rental Cost"
          value={formatINR(summary?.totalRentalCost ?? 0)}
          icon={DollarSign}
          description="External supplier expense"
          className="text-foreground"
        />
        <StatCard
          title="Outstanding Units"
          value={`${summary?.totalOutstandingQuantity ?? 0} Pending`}
          icon={RotateCcw}
          description="Issued but unreturned units"
          className={cn(
            (summary?.totalOutstandingQuantity ?? 0) > 0
              ? "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
              : "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
          )}
        />
      </div>

      {/* Dual-Tab Allocation Interface */}
      <Tabs defaultValue="owned" className="w-full space-y-4">
        <TabsList className="bg-muted/70 p-1">
          <TabsTrigger value="owned" className="gap-2 text-xs">
            <Building2 className="size-3.5" />
            Owned Warehouse Gear ({ownedAllocations.length})
          </TabsTrigger>
          <TabsTrigger value="rented" className="gap-2 text-xs">
            <Truck className="size-3.5" />
            Third-Party Vendor Rentals ({rentedAllocations.length})
          </TabsTrigger>
        </TabsList>

        {/* ============================================================== */}
        {/* TAB 1: OWNED WAREHOUSE GEAR */}
        {/* ============================================================== */}
        <TabsContent value="owned" className="space-y-4">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Company-Owned Warehouse Inventory
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Dispatched from central warehouse. Undamaged returns replenish warehouse stock counts.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs w-fit">
                  {ownedAllocations.length} items allocated
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {ownedAllocations.length === 0 ? (
                <div className="p-12 text-center border-dashed rounded-lg bg-muted/5 mx-4 my-4">
                  <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                    <Building2 className="size-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    No warehouse gear allocated yet
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                    Allocate lighting fixtures, sound equipment, cables, or stage elements from internal inventory.
                  </p>
                  <div className="mt-4">
                    <Button
                      size="sm"
                      onClick={() => setAllocationDialogOpen(true)}
                      className="text-xs gap-1.5"
                    >
                      <Plus className="size-3.5" /> Allocate Gear
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-[260px]">Equipment Name & SKU</TableHead>
                        <TableHead className="text-right">Required</TableHead>
                        <TableHead className="text-right">Issued</TableHead>
                        <TableHead className="text-right">Returned</TableHead>
                        <TableHead className="text-right">Damaged</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead className="text-right">Warehouse Available</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Logistics Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ownedAllocations.map((alloc) => {
                        const item = alloc.inventoryItem;
                        const unit = item?.unit || "units";
                        const isFullyReturned =
                          alloc.issuedQuantity > 0 &&
                          alloc.outstandingQuantity === 0;
                        const isNotIssued = alloc.issuedQuantity === 0;

                        return (
                          <TableRow key={alloc.id} className="text-xs">
                            {/* Equipment Name & SKU */}
                            <TableCell>
                              <div className="flex flex-col">
                                <Link
                                  href={`/inventory/items/${alloc.inventoryItemId}`}
                                  className="font-medium text-foreground hover:text-primary transition-colors hover:underline"
                                >
                                  {item?.name || "Unknown Item"}
                                </Link>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {item?.sku ? (
                                    <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
                                      {item.sku}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground/60 italic">
                                      No SKU
                                    </span>
                                  )}
                                  <span className="text-[10px] text-muted-foreground">
                                    • {item?.category?.name || "General"}
                                  </span>
                                </div>
                              </div>
                            </TableCell>

                            {/* Required */}
                            <TableCell className="text-right font-mono font-medium">
                              {alloc.requiredQuantity} {unit}
                            </TableCell>

                            {/* Issued */}
                            <TableCell className="text-right font-mono font-medium text-blue-600 dark:text-blue-400">
                              {alloc.issuedQuantity} {unit}
                            </TableCell>

                            {/* Returned */}
                            <TableCell className="text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                              {alloc.returnedQuantity} {unit}
                            </TableCell>

                            {/* Damaged */}
                            <TableCell className="text-right font-mono font-medium">
                              {alloc.damagedQuantity > 0 ? (
                                <span className="text-rose-600 dark:text-rose-400 font-bold">
                                  {alloc.damagedQuantity} {unit}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/60">0</span>
                              )}
                            </TableCell>

                            {/* Outstanding */}
                            <TableCell className="text-right font-mono font-bold">
                              {alloc.outstandingQuantity > 0 ? (
                                <span className="text-amber-600 dark:text-amber-400">
                                  {alloc.outstandingQuantity} {unit}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/60">0</span>
                              )}
                            </TableCell>

                            {/* Warehouse Available Stock */}
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {item?.currentStock ?? "-"} {unit}
                            </TableCell>

                            {/* Logistics Status Badge */}
                            <TableCell className="text-center">
                              {isFullyReturned ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                >
                                  Fully Returned
                                </Badge>
                              ) : alloc.outstandingQuantity > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                >
                                  On-Site / Dispatched
                                </Badge>
                              ) : isNotIssued ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
                                >
                                  Pending Dispatch
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                >
                                  Partial
                                </Badge>
                              )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="xs"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => handleOpenIssue(alloc)}
                                >
                                  <Truck className="size-3 text-blue-500" />
                                  Dispatch / Issue
                                </Button>
                                {alloc.outstandingQuantity > 0 && (
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => handleOpenReturn(alloc)}
                                  >
                                    <RotateCcw className="size-3 text-emerald-500" />
                                    Process Return
                                  </Button>
                                )}
                              </div>
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
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 2: THIRD-PARTY VENDOR RENTALS */}
        {/* ============================================================== */}
        <TabsContent value="rented" className="space-y-4">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Third-Party Vendor Rental Services
                  </CardTitle>
                  <CardDescription className="text-xs">
                    External vendor equipment sourced directly for this event. Bypasses internal warehouse stock checks.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 font-medium"
                  >
                    Total Rent: {formatINR(summary?.totalRentalCost ?? 0)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {rentedAllocations.length === 0 ? (
                <div className="p-12 text-center border-dashed rounded-lg bg-muted/5 mx-4 my-4">
                  <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                    <Truck className="size-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    No vendor rentals contracted for this event
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                    Track external video walls, diesel generators, staging, or specialty props sourced on rent from suppliers.
                  </p>
                  <div className="mt-4">
                    <Button
                      size="sm"
                      onClick={() => setAllocationDialogOpen(true)}
                      className="text-xs gap-1.5"
                    >
                      <Plus className="size-3.5" /> Contract Rental Gear
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-[240px]">Equipment & Notes</TableHead>
                        <TableHead>Rental Period</TableHead>
                        <TableHead className="text-right">Duration</TableHead>
                        <TableHead className="text-right">Rent / Unit</TableHead>
                        <TableHead className="text-right">Total Rent</TableHead>
                        <TableHead className="text-right">Issued Units</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead>Actual Return</TableHead>
                        <TableHead className="text-right">Rental Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rentedAllocations.map((alloc) => {
                        const item = alloc.inventoryItem;
                        const unit = item?.unit || "units";

                        return (
                          <TableRow key={alloc.id} className="text-xs">
                            {/* Name & Sourcing Notes */}
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">
                                  {item?.name || "Rental Asset"}
                                </span>
                                {alloc.notes ? (
                                  <span className="text-[11px] text-muted-foreground italic mt-0.5 line-clamp-1" title={alloc.notes}>
                                    {alloc.notes}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground/60 italic">
                                    No vendor notes
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            {/* Rental Period */}
                            <TableCell className="text-muted-foreground font-mono">
                              {alloc.rentalStartDate ? formatDate(alloc.rentalStartDate) : "-"}
                              {" → "}
                              {alloc.rentalEndDate ? formatDate(alloc.rentalEndDate) : "-"}
                            </TableCell>

                            {/* Duration */}
                            <TableCell className="text-right font-mono">
                              {alloc.rentalDays !== null && alloc.rentalDays !== undefined
                                ? `${alloc.rentalDays} Days`
                                : "-"}
                            </TableCell>

                            {/* Rent / Unit */}
                            <TableCell className="text-right font-mono">
                              {alloc.rentPerUnit !== null && alloc.rentPerUnit !== undefined
                                ? formatINR(alloc.rentPerUnit)
                                : "-"}
                            </TableCell>

                            {/* Total Rent */}
                            <TableCell className="text-right font-mono font-bold text-foreground">
                              {alloc.totalRent !== null && alloc.totalRent !== undefined
                                ? formatINR(alloc.totalRent)
                                : "-"}
                            </TableCell>

                            {/* Issued Units */}
                            <TableCell className="text-right font-mono font-medium text-blue-600 dark:text-blue-400">
                              {alloc.issuedQuantity} / {alloc.requiredQuantity} {unit}
                            </TableCell>

                            {/* Outstanding */}
                            <TableCell className="text-right font-mono font-bold">
                              {alloc.outstandingQuantity > 0 ? (
                                <span className="text-amber-600 dark:text-amber-400">
                                  {alloc.outstandingQuantity} {unit}
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-normal">
                                  0 {unit}
                                </span>
                              )}
                            </TableCell>

                            {/* Actual Return Date */}
                            <TableCell className="font-mono text-muted-foreground">
                              {alloc.actualReturnDate ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  {formatDate(alloc.actualReturnDate)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/60 italic">
                                  Pending Return
                                </span>
                              )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="xs"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => handleOpenIssue(alloc)}
                                >
                                  <Truck className="size-3 text-purple-500" />
                                  Arrival / Dispatch
                                </Button>
                                {alloc.outstandingQuantity > 0 && (
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => handleOpenReturn(alloc)}
                                  >
                                    <RotateCcw className="size-3 text-emerald-500" />
                                    Return to Vendor
                                  </Button>
                                )}
                              </div>
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
        </TabsContent>
      </Tabs>

      {/* Allocate Equipment Modal */}
      <EventAllocationDialog
        open={allocationDialogOpen}
        onOpenChange={setAllocationDialogOpen}
        eventId={eventId}
        onSuccess={() => refetch()}
      />

      {/* Dispatch / Issue Dialog */}
      <EventIssueDialog
        open={issueDialogOpen}
        onOpenChange={setIssueDialogOpen}
        eventId={eventId}
        allocation={selectedAllocation}
        onSuccess={() => refetch()}
      />

      {/* Return to Warehouse / Vendor Dialog */}
      <EventReturnDialog
        open={returnDialogOpen}
        onOpenChange={setReturnDialogOpen}
        eventId={eventId}
        allocation={selectedAllocation}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
