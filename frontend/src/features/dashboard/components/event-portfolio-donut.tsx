"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { formatINR } from "@/lib/formatters";
import type { EventCategoryDataPoint } from "../types";
import { useIsMounted } from "../hooks/use-is-mounted";
import { PieChart as PieChartIcon } from "lucide-react";

interface EventPortfolioDonutProps {
  data: EventCategoryDataPoint[];
  totalEvents: number;
}

export function EventPortfolioDonut({ data, totalEvents }: EventPortfolioDonutProps) {
  const isMounted = useIsMounted();
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  const totalPortfolioRevenue = React.useMemo(() => {
    return data.reduce((acc, item) => acc + item.revenue, 0);
  }, [data]);

  return (
    <Card className="border-border/70 shadow-xs flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <PieChartIcon className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold tracking-tight text-foreground">
              Event Portfolio & Category Mix
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Portfolio revenue distribution across distinct event disciplines
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 flex-1 flex flex-col justify-between">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Donut Chart Canvas with Center Metric */}
          <div className="lg:col-span-6 relative flex items-center justify-center">
            <div className="w-full h-[220px]">
              {!isMounted ? (
                <div className="w-full h-full flex items-center justify-center bg-muted/20 rounded-lg animate-pulse">
                  <span className="text-xs text-muted-foreground">Loading Portfolio...</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const item = payload[0]?.payload as EventCategoryDataPoint;
                        if (!item) return null;

                        return (
                          <div className="p-2.5 bg-popover/95 backdrop-blur-xs border border-border rounded-lg shadow-md text-xs space-y-1">
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                              {item.category}
                            </div>
                            <div className="text-muted-foreground flex items-center justify-between gap-4">
                              <span>Volume:</span>
                              <span className="font-medium text-foreground">
                                {item.count} Events ({item.percentage}%)
                              </span>
                            </div>
                            <div className="text-muted-foreground flex items-center justify-between gap-4">
                              <span>Revenue:</span>
                              <span className="font-bold text-foreground">
                                {formatINR(item.revenue)}
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Pie
                      data={data}
                      dataKey="revenue"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={3}
                      stroke="none"
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                    >
                      {data.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.category}`}
                          fill={entry.color}
                          opacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
                          className="transition-opacity duration-200 cursor-pointer"
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Centered KPI in Donut Hole */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                {totalEvents}
              </span>
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Total Events
              </span>
            </div>
          </div>

          {/* Category Breakdown Table / Rows */}
          <div className="lg:col-span-6 space-y-2">
            {data.map((cat, idx) => (
              <div
                key={cat.category}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                className={`p-2 rounded-lg border transition-all cursor-pointer ${
                  activeIndex === idx
                    ? "bg-muted/70 border-primary/30 shadow-2xs"
                    : "bg-muted/30 border-border/40 hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-semibold text-foreground truncate">
                      {cat.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-muted-foreground text-[11px]">
                      {cat.count} {cat.count === 1 ? "evt" : "evts"}
                    </span>
                    <span className="font-bold text-foreground font-mono">
                      {cat.percentage}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-1.5 h-1 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${cat.percentage}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total Portfolio Value Footer */}
        <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Portfolio Gross Commitment:</span>
          <span className="font-bold text-foreground">
            {formatINR(totalPortfolioRevenue)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
