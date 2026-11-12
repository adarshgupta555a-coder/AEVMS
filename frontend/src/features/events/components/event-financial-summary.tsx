"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/formatters";
import { useEventSummary } from "../hooks/use-events";
import {
  DollarSign,
  TrendingUp,
  Receipt,
  Wallet,
  Coins,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EventFinancialSummaryProps {
  eventId: string;
  className?: string;
}

export function EventFinancialSummary({
  eventId,
  className,
}: EventFinancialSummaryProps) {
  const { data, isLoading, error } = useEventSummary(eventId);

  if (isLoading) {
    return (
      <div className={cn("grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3", className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-border/70 shadow-xs">
            <CardContent className="p-3.5 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 text-destructive">
        <CardContent className="p-4 flex items-center gap-2 text-xs">
          <AlertCircle className="size-4 shrink-0" />
          <span>Failed to load financial summary for this event.</span>
        </CardContent>
      </Card>
    );
  }

  const { financials } = data;
  const isProfitable = financials.profitMargin >= 0;
  const hasReceivable = financials.balanceReceivable > 0;

  const statCards = [
    {
      label: "Planned Budget",
      value: formatINR(financials.budget),
      icon: Wallet,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/10",
      description: "Allocated production cap",
    },
    {
      label: "Total Invoiced",
      value: formatINR(financials.totalInvoiced),
      icon: Receipt,
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-500/10",
      description: "Billed across invoices",
    },
    {
      label: "Total Paid Cash",
      value: formatINR(financials.totalPaid),
      icon: CreditCard,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-500/10",
      description: "Collections settled",
    },
    {
      label: "Total Expenses",
      value: formatINR(financials.totalExpenses),
      icon: Coins,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500/10",
      description: "Vendor & op costs",
    },
    {
      label: "Balance Receivable",
      value: formatINR(financials.balanceReceivable),
      icon: DollarSign,
      color: hasReceivable
        ? "text-rose-600 dark:text-rose-400"
        : "text-muted-foreground",
      bgColor: hasReceivable ? "bg-rose-500/10" : "bg-muted",
      description: hasReceivable ? "Unsettled client balance" : "Fully settled",
    },
    {
      label: "Net Profit Margin",
      value: formatINR(financials.profitMargin),
      icon: TrendingUp,
      color: isProfitable
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-rose-600 dark:text-rose-400",
      bgColor: isProfitable ? "bg-emerald-500/10" : "bg-rose-500/10",
      description: isProfitable ? "Surplus over expenses" : "Deficit / loss",
    },
  ];

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3", className)}>
      {statCards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card
            key={idx}
            className="border-border/70 shadow-xs hover:border-border transition-colors"
          >
            <CardContent className="p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {card.label}
                </span>
                <div
                  className={cn(
                    "size-6 rounded-md flex items-center justify-center",
                    card.bgColor,
                    card.color
                  )}
                >
                  <Icon className="size-3.5" />
                </div>
              </div>
              <div className="text-base font-bold tracking-tight font-mono text-foreground">
                {card.value}
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                {card.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
