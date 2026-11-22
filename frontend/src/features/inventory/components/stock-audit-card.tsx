"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useItemAudit } from "../hooks/use-inventory";
import {
  CheckCircle2,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Calculator,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

interface StockAuditCardProps {
  itemId: string;
  itemName?: string;
  sku?: string | null;
  className?: string;
}

export function StockAuditCard({
  itemId,
  itemName,
  sku,
  className,
}: StockAuditCardProps) {
  const { data, isLoading, isError, refetch, isRefetching } = useItemAudit(itemId);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className={`border-destructive/20 bg-destructive/5 ${className || ""}`}>
        <CardContent className="flex flex-col items-center justify-center py-6 text-center space-y-2">
          <AlertTriangle className="size-8 text-destructive" />
          <p className="text-sm font-semibold text-destructive">
            Failed to load stock audit ledger
          </p>
          <p className="text-xs text-muted-foreground">
            Could not verify transaction movements against current inventory.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="text-xs mt-2"
          >
            <RefreshCw className="size-3.5 mr-1" />
            Retry Audit
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { audit, item } = data;
  const isReconciled = audit.isReconciled;
  const discrepancy = audit.discrepancy;
  const currentStock = audit.currentStock;
  const expectedStock = audit.expectedStock;
  const breakdown = audit.breakdown;

  const displayName = itemName || item.name;
  const displaySku = sku ?? item.sku;
  const unit = item.unit || "units";

  const inflows = breakdown.inflows;
  const outflows = breakdown.outflows;

  return (
    <Card className={`overflow-hidden ${className || ""}`}>
      {/* Header with Title and Reconciled Badge */}
      <CardHeader className="border-b border-border/60 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold tracking-tight">
                Stock Reconciliation & Mathematical Audit
              </CardTitle>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => refetch()}
                disabled={isRefetching}
                title="Refresh Audit"
              >
                <RefreshCw
                  className={`size-3 text-muted-foreground ${
                    isRefetching ? "animate-spin" : ""
                  }`}
                />
              </Button>
            </div>
            <CardDescription className="text-xs">
              {displayName}
              {displaySku && (
                <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                  [{displaySku}]
                </span>
              )}
            </CardDescription>
          </div>

          {/* Compliance Status Badge */}
          {isReconciled ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="size-3.5 shrink-0" />
              <span>RECONCILED: 100% AUDIT COMPLIANT</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/15 border border-destructive/30 text-destructive text-xs font-semibold">
              <ShieldAlert className="size-3.5 shrink-0" />
              <span>
                DISCREPANCY DETECTED: {discrepancy > 0 ? `+${discrepancy}` : discrepancy}{" "}
                {unit.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Status Message Callout */}
        <div
          className={`mt-2 p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
            isReconciled
              ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          {isReconciled ? (
            <>
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <span>
                Current warehouse physical stock matches the double-entry ledger movement history perfectly. Zero discrepancy.
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
              <span>
                Discrepancy of{" "}
                <strong>
                  {discrepancy > 0 ? `+${discrepancy}` : discrepancy} {unit}
                </strong>{" "}
                detected! Recorded warehouse stock ({currentStock}) differs from expected balance ({expectedStock}) derived from movements. Please perform a physical inventory audit.
              </span>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Quick Numbers Bar */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-muted/40 border border-border/60 text-center">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Expected Stock
            </span>
            <div className="text-base font-bold text-foreground">
              {expectedStock} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
            </div>
          </div>
          <div className="border-x border-border/60">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Recorded Stock
            </span>
            <div className="text-base font-bold text-foreground">
              {currentStock} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
            </div>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Audit Variance
            </span>
            <div
              className={`text-base font-bold ${
                isReconciled
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              }`}
            >
              {discrepancy === 0 ? "0" : discrepancy > 0 ? `+${discrepancy}` : discrepancy}{" "}
              <span className="text-xs font-normal text-muted-foreground">{unit}</span>
            </div>
          </div>
        </div>

        {/* Double-Entry Inflows vs Outflows Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Column 1: Inflows */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
            <div className="flex items-center gap-1.5 pb-1 border-b border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
              <ArrowDownLeft className="size-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Total Inflows (Stock Increments)
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Direct Warehouse Purchases:</span>
                <span className="font-semibold text-foreground font-mono">
                  +{inflows.totalPurchased} {unit}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Positive Adjustments (In):</span>
                <span className="font-semibold text-foreground font-mono">
                  +{inflows.totalAdjustedIn} {unit}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Event Restocked Returns:</span>
                <span className="font-semibold text-foreground font-mono">
                  +{inflows.totalEventReturned} {unit}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <span>Total Increments (+):</span>
              <span className="font-mono text-sm">+{inflows.totalIncrements} {unit}</span>
            </div>
          </div>

          {/* Column 2: Outflows */}
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
            <div className="flex items-center gap-1.5 pb-1 border-b border-red-500/20 text-red-700 dark:text-red-400">
              <ArrowUpRight className="size-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Total Outflows (Stock Decrements)
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Event Dispatches (Issues):</span>
                <span className="font-semibold text-foreground font-mono">
                  -{outflows.totalEventIssued} {unit}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Warehouse Damages:</span>
                <span className="font-semibold text-foreground font-mono">
                  -{outflows.totalWarehouseDamaged} {unit}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Event Damages:</span>
                <span className="font-semibold text-foreground font-mono">
                  -{outflows.totalEventDamaged} {unit}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Warehouse Losses:</span>
                <span className="font-semibold text-foreground font-mono">
                  -{outflows.totalWarehouseLost} {unit}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Negative Adjustments (Out):</span>
                <span className="font-semibold text-foreground font-mono">
                  -{outflows.totalAdjustedOut} {unit}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-red-500/20 flex items-center justify-between text-xs font-bold text-red-800 dark:text-red-300">
              <span>Total Decrements (-):</span>
              <span className="font-mono text-sm">-{outflows.totalDecrements} {unit}</span>
            </div>
          </div>
        </div>

        {/* Net Mathematical Formula Display */}
        <div className="p-3 rounded-lg border border-border/80 bg-muted/30 space-y-1 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Calculator className="size-3.5" />
            <span>Double-Entry Reconciliation Proof:</span>
          </div>
          <div className="text-xs font-mono font-bold text-foreground">
            Current Stock = Total Increments ({inflows.totalIncrements}) - Total Decrements ({outflows.totalDecrements})
          </div>
          <div className="text-sm font-mono font-bold text-primary">
            {expectedStock} {unit} = {inflows.totalIncrements} - {outflows.totalDecrements}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
