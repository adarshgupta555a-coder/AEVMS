"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatINR } from "@/lib/formatters";
import type { RevenueDataPoint, DashboardTimeframe } from "../types";
import { useIsMounted } from "../hooks/use-is-mounted";
import { BarChart3 } from "lucide-react";

interface RevenuePerformanceChartProps {
  data: RevenueDataPoint[];
  timeframe: DashboardTimeframe;
  totalInvoiced: number;
  totalCollected: number;
  outstandingReceivables: number;
}

export function RevenuePerformanceChart({
  data,
  timeframe,
  totalInvoiced,
  totalCollected,
  outstandingReceivables,
}: RevenuePerformanceChartProps) {
  const isMounted = useIsMounted();
  const [activeMetric, setActiveMetric] = React.useState<"all" | "revenue" | "budget">("all");

  const timeframeLabel =
    timeframe === "30d"
      ? "Weekly Trend (Last 30 Days)"
      : timeframe === "90d"
      ? "Monthly Trend (Last Quarter)"
      : timeframe === "6m"
      ? "Monthly Performance (Last 6 Months)"
      : "Fiscal Year Performance (By Quarter)";

  return (
    <Card className="border-border/70 shadow-xs flex flex-col">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <BarChart3 className="size-4" />
            </div>
            <CardTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              Revenue Generation & Cash Realization
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            {timeframeLabel} • Realized collections against total billed event commitments
          </CardDescription>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveMetric("all")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
              activeMetric === "all"
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            All Streams
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric("revenue")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
              activeMetric === "revenue"
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            Cash Flow Only
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric("budget")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
              activeMetric === "budget"
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            With Budget
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 flex-1 flex flex-col justify-between">
        {/* Main Chart Canvas */}
        <div className="w-full h-[280px] sm:h-[320px]">
          {!isMounted ? (
            <div className="w-full h-full flex items-center justify-center bg-muted/20 rounded-lg animate-pulse">
              <span className="text-xs text-muted-foreground">Loading Analytics Model...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="invoicedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="collectedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.6} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  className="stroke-border/40"
                />

                <XAxis
                  dataKey="period"
                  tickLine={false}
                  axisLine={{ stroke: "currentColor", className: "stroke-border/40" }}
                  tick={{ fontSize: 11, fill: "currentColor", className: "fill-muted-foreground" }}
                />

                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => {
                    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
                    if (val >= 100000) return `₹${(val / 100000).toFixed(0)}L`;
                    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
                    return `₹${val}`;
                  }}
                  tick={{ fontSize: 11, fill: "currentColor", className: "fill-muted-foreground" }}
                />

                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0]?.payload as RevenueDataPoint;
                    if (!item) return null;

                    const gap = Math.max(0, item.invoiced - item.collected);
                    const rate =
                      item.invoiced > 0
                        ? Math.round((item.collected / item.invoiced) * 1000) / 10
                        : 0;

                    return (
                      <div className="p-3 bg-popover/95 backdrop-blur-xs border border-border rounded-lg shadow-lg text-xs space-y-2 min-w-[200px]">
                        <div className="font-semibold text-foreground border-b border-border/50 pb-1 flex items-center justify-between">
                          <span>{label}</span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">
                            {rate}% Realized
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <span className="size-2 rounded-full bg-blue-500" />
                              Billed Invoiced:
                            </span>
                            <span className="font-bold text-foreground">
                              {formatINR(item.invoiced)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <span className="size-2 rounded-full bg-emerald-500" />
                              Realized Cash:
                            </span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {formatINR(item.collected)}
                            </span>
                          </div>
                          {gap > 0 && (
                            <div className="flex items-center justify-between text-[11px] pt-0.5 border-t border-border/40">
                              <span className="text-muted-foreground">Pending Receivables:</span>
                              <span className="font-medium text-amber-600 dark:text-amber-400">
                                {formatINR(gap)}
                              </span>
                            </div>
                          )}
                          {(activeMetric === "all" || activeMetric === "budget") && (
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground flex items-center gap-1.5">
                                <span className="size-2 rounded-full bg-amber-500" />
                                Operating Budget:
                              </span>
                              <span className="font-medium text-muted-foreground">
                                {formatINR(item.budget)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />

                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingBottom: 12, fontSize: 11 }}
                  formatter={(value) => (
                    <span className="text-muted-foreground font-medium text-xs">
                      {value}
                    </span>
                  )}
                />

                {/* Invoiced Area */}
                <Area
                  name="Invoiced Revenue"
                  type="monotone"
                  dataKey="invoiced"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#invoicedGradient)"
                />

                {/* Collected Bar */}
                <Bar
                  name="Collected Cash"
                  dataKey="collected"
                  barSize={18}
                  radius={[4, 4, 0, 0]}
                  fill="#10b981"
                />

                {/* Operating Budget Line */}
                {(activeMetric === "all" || activeMetric === "budget") && (
                  <Line
                    name="Operating Budget"
                    type="monotone"
                    dataKey="budget"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Financial Executive Summary Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-4 mt-2 border-t border-border/50">
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Total Invoiced
            </span>
            <span className="text-sm sm:text-base font-bold text-foreground">
              {formatINR(totalInvoiced)}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
              Collected Realized
            </span>
            <span className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
              {formatINR(totalCollected)}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
              Pending Receivables
            </span>
            <span className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">
              {formatINR(outstandingReceivables)}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
              Operating Gross Margin
            </span>
            <span className="text-sm sm:text-base font-bold text-blue-600 dark:text-blue-400">
              36.2%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
