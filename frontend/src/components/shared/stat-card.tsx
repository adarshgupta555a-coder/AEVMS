"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowDownRight, Minus, type LucideIcon } from "lucide-react";

export interface StatCardTrend {
  value: number | string;
  label?: string;
  isPositive?: boolean;
}

export interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  description?: string;
  trend?: StatCardTrend;
  isLoading?: boolean;
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  isLoading = false,
  className,
  onClick,
}: StatCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "relative overflow-hidden border-border/80 bg-card shadow-xs transition-all hover:border-border hover:shadow-sm",
        onClick && "cursor-pointer hover:bg-muted/30",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {isLoading ? <Skeleton className="h-4 w-24" /> : title}
        </CardTitle>
        {Icon && (
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Icon className="size-4" />
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-1.5 pt-0">
        {/* Big Value Display */}
        <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
          {isLoading ? <Skeleton className="h-8 w-32 my-1" /> : value}
        </div>

        {/* Description & Optional Trend Badge */}
        {(description || trend || isLoading) && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {isLoading ? (
              <Skeleton className="h-3.5 w-40 mt-1" />
            ) : (
              <>
                {trend && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium text-[11px]",
                      trend.isPositive === true
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : trend.isPositive === false
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {trend.isPositive === true ? (
                      <ArrowUpRight className="size-3" />
                    ) : trend.isPositive === false ? (
                      <ArrowDownRight className="size-3" />
                    ) : (
                      <Minus className="size-3" />
                    )}
                    <span>{trend.value}</span>
                  </span>
                )}
                {trend?.label && <span>{trend.label}</span>}
                {description && !trend?.label && <span>{description}</span>}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
