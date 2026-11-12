"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  CalendarCheck,
  Receipt,
  FileSpreadsheet,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import type { DashboardMetricsData } from "../types";

interface KPICardGridProps {
  metrics: DashboardMetricsData;
}

export function KPICardGrid({ metrics }: KPICardGridProps) {
  const { kpis, summary } = metrics;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Gross Invoiced Revenue */}
      <Card className="relative overflow-hidden border-border/70 shadow-xs hover:shadow-sm transition-shadow">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {kpis.revenue.title}
          </CardTitle>
          <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Receipt className="size-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {kpis.revenue.value}
            </div>
            <Badge
              variant="outline"
              className="gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
            >
              <TrendingUp className="size-3" />
              {kpis.revenue.badgeLabel || `+${kpis.revenue.changePercent}%`}
            </Badge>
          </div>

          {/* Micro Progress Bar for Collection Realization */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Collection Realization</span>
              <span className="font-semibold text-foreground">
                {summary.collectionEfficiencyRate}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, summary.collectionEfficiencyRate)}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-0.5">
            <span>{kpis.revenue.subtext}</span>
            <span className="font-medium text-foreground">
              Realized: ₹{(summary.totalCollected / 100000).toFixed(1)}L
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Active Event Operations */}
      <Card className="relative overflow-hidden border-border/70 shadow-xs hover:shadow-sm transition-shadow">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {kpis.activeEvents.title}
          </CardTitle>
          <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CalendarCheck className="size-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {kpis.activeEvents.value}
            </div>
            <Badge
              variant="outline"
              className="gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
            >
              <ArrowUpRight className="size-3" />
              {kpis.activeEvents.badgeLabel || "Active"}
            </Badge>
          </div>

          {/* Execution Adherence metric */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>On-Schedule Adherence</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">98.2%</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: "98.2%" }}
              />
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-0.5">
            <span>{kpis.activeEvents.subtext}</span>
            <span className="font-medium text-foreground">
              Avg Deal: ₹{(summary.averageDealSize / 100000).toFixed(1)}L
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Quotation Pipeline Value */}
      <Card className="relative overflow-hidden border-border/70 shadow-xs hover:shadow-sm transition-shadow">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {kpis.quotationPipeline.title}
          </CardTitle>
          <div className="size-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <FileSpreadsheet className="size-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate max-w-[65%]">
              {kpis.quotationPipeline.value}
            </div>
            <Badge
              variant="outline"
              className="gap-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400 border-purple-500/20 bg-purple-500/10 shrink-0"
            >
              <TrendingUp className="size-3" />
              {kpis.quotationPipeline.badgeLabel || `${summary.pipelineWinRate}% Win`}
            </Badge>
          </div>

          {/* Proposal Win Rate */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Proposal Win Rate</span>
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                {summary.pipelineWinRate}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, summary.pipelineWinRate)}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-0.5">
            <span>{kpis.quotationPipeline.subtext}</span>
            <span className="font-medium text-foreground">Turnaround: 2.1d</span>
          </div>
        </CardContent>
      </Card>

      {/* 4. Cash Collection Efficiency */}
      <Card className="relative overflow-hidden border-border/70 shadow-xs hover:shadow-sm transition-shadow">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {kpis.collectionRate.title}
          </CardTitle>
          <div className="size-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Wallet className="size-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {kpis.collectionRate.value}
            </div>
            <Badge
              variant="outline"
              className="gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/10"
            >
              {kpis.collectionRate.badgeLabel || "High Flow"}
            </Badge>
          </div>

          {/* Outstanding Receivables */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Outstanding Balance</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                ₹{(summary.outstandingReceivables / 100000).toFixed(2)}L
              </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(
                    5,
                    Math.min(
                      100,
                      summary.totalInvoiced > 0
                        ? (summary.outstandingReceivables / summary.totalInvoiced) * 100
                        : 10
                    )
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-0.5">
            <span>{kpis.collectionRate.subtext}</span>
            <span className="font-medium text-foreground">Settlement: &lt; 4.5d</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
