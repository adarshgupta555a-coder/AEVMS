"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarPlus,
  FileSpreadsheet,
  ReceiptText,
  UserPlus,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import type { DashboardTimeframe } from "../types";

interface DashboardHeaderProps {
  timeframe: DashboardTimeframe;
  onTimeframeChange: (tf: DashboardTimeframe) => void;
  isRefetching: boolean;
  onRefresh: () => void;
  hasRealData: boolean;
  forceDemoMode: boolean;
  onToggleDemoMode: () => void;
}

const TIMEFRAME_OPTIONS: { label: string; value: DashboardTimeframe }[] = [
  { label: "Last 30 Days", value: "30d" },
  { label: "Quarter (90D)", value: "90d" },
  { label: "Last 6 Months", value: "6m" },
  { label: "Full Year (1Y)", value: "1y" },
];

export function DashboardHeader({
  timeframe,
  onTimeframeChange,
  isRefetching,
  onRefresh,
  hasRealData,
  forceDemoMode,
  onToggleDemoMode,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-5 pb-2 border-b border-border/60">
      {/* Top Banner Row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Executive Command Center
            </h1>
            <Badge
              variant="outline"
              className="gap-1.5 px-2.5 py-0.5 text-xs font-medium border-primary/20 bg-primary/5 text-primary"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {hasRealData && !forceDemoMode ? "Live System Sync" : "Executive Intelligence"}
            </Badge>

            <button
              type="button"
              onClick={onToggleDemoMode}
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
              title="Toggle between enterprise benchmark model and live connected feeds"
            >
              {forceDemoMode ? "Switch to Live Feed" : "Preview Enterprise Model"}
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Real-time executive performance analytics across event portfolios, quotation conversion pipelines, and cash flow realization.
          </p>
        </div>

        {/* Quick Actions Group */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={isRefetching}
            className="gap-1.5 text-xs h-9 cursor-pointer shadow-xs"
            title="Refresh analytics feeds"
          >
            <RefreshCw
              className={`size-3.5 text-muted-foreground ${
                isRefetching ? "animate-spin text-primary" : ""
              }`}
            />
            <span className="hidden sm:inline">Sync</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-9"
            render={<Link href="/clients/create" />}
          >
            <UserPlus className="size-3.5 text-muted-foreground" />
            <span>New Client</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-9"
            render={<Link href="/quotations/new" />}
          >
            <FileSpreadsheet className="size-3.5 text-muted-foreground" />
            <span>New Quote</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-9"
            render={<Link href="/invoices/new" />}
          >
            <ReceiptText className="size-3.5 text-muted-foreground" />
            <span>New Invoice</span>
          </Button>

          <Button
            size="sm"
            className="gap-1.5 text-xs h-9 shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            render={<Link href="/events/new" />}
          >
            <CalendarPlus className="size-4" />
            <span>Create Event</span>
          </Button>
        </div>
      </div>

      {/* Control Strip: Timeframe Switcher & Executive Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        {/* Timeframe pill selector */}
        <div className="inline-flex items-center p-1 rounded-lg bg-muted/60 border border-border/70 self-start sm:self-auto">
          {TIMEFRAME_OPTIONS.map((opt) => {
            const isActive = timeframe === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onTimeframeChange(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  isActive
                    ? "bg-background text-foreground shadow-xs border border-border/40 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Growth badge / ticker */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground self-start sm:self-auto">
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-md">
            <TrendingUp className="size-3.5" />
            <span>+19.2% Overall Portfolio Growth</span>
          </div>
          <span className="hidden md:inline text-muted-foreground/60">•</span>
          <span className="hidden md:inline text-[11px]">Audit Period Active</span>
        </div>
      </div>
    </div>
  );
}
