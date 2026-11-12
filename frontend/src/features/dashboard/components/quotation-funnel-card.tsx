"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/formatters";
import type { QuotationFunnelStage } from "../types";
import {
  Filter,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";

interface QuotationFunnelCardProps {
  stages: QuotationFunnelStage[];
  pipelineWinRate: number;
  averageDealSize: number;
}

export function QuotationFunnelCard({
  stages,
  pipelineWinRate,
  averageDealSize,
}: QuotationFunnelCardProps) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <Card className="border-border/70 shadow-xs flex flex-col">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Filter className="size-4" />
            </div>
            <CardTitle className="text-base font-bold tracking-tight text-foreground">
              Quotation Conversion Funnel
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Stage progression from formulated quote to executed contract
          </CardDescription>
        </div>

        <Badge
          variant="outline"
          className="gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10 self-start sm:self-auto"
        >
          <TrendingUp className="size-3" />
          {pipelineWinRate}% Overall Win Rate
        </Badge>
      </CardHeader>

      <CardContent className="pt-4 flex-1 flex flex-col justify-between space-y-4">
        {/* Funnel Stages */}
        <div className="space-y-3">
          {stages.map((stage, idx) => {
            const widthPct = Math.max(15, Math.round((stage.count / maxCount) * 100));
            const isLast = idx === stages.length - 1;

            return (
              <div key={stage.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    {isLast ? (
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground size-4 rounded-full bg-muted flex items-center justify-center">
                        {idx + 1}
                      </span>
                    )}
                    {stage.stage}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[11px]">
                      {formatINR(stage.value)}
                    </span>
                    <span className="font-bold text-foreground font-mono">
                      {stage.count} {stage.count === 1 ? "quote" : "quotes"}
                    </span>
                  </div>
                </div>

                {/* Funnel Bar */}
                <div className="h-6 w-full bg-muted/40 rounded-md overflow-hidden p-0.5 flex items-center">
                  <div
                    className="h-full rounded transition-all duration-500 flex items-center justify-between px-2 text-[10px] text-white font-medium"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: stage.color,
                    }}
                  >
                    <span className="truncate">{stage.count} Units</span>
                    {stage.conversionRate < 100 && (
                      <span className="opacity-90">{stage.conversionRate}% pass</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Funnel KPI Highlights Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 border-t border-border/50 text-xs">
          <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Average Deal
            </span>
            <span className="text-sm font-bold text-foreground">
              {formatINR(averageDealSize)}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Avg Turnaround
            </span>
            <span className="text-sm font-bold text-foreground flex items-center gap-1">
              <Clock className="size-3 text-muted-foreground" />
              2.1 Days
            </span>
          </div>

          <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
              Closing Health
            </span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              Optimal (Grade A)
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
