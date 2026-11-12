"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/formatters";
import type { ClientTierDistribution, RecentBusinessActivity } from "../types";
import {
  Users2,
  Activity,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FileCheck2,
  Receipt,
  UserCheck,
} from "lucide-react";

interface ClientGrowthAndActivityProps {
  clientTiers: ClientTierDistribution[];
  activities: RecentBusinessActivity[];
  retentionRate: number;
}

export function ClientGrowthAndActivity({
  clientTiers,
  activities,
  retentionRate,
}: ClientGrowthAndActivityProps) {
  const totalClients = React.useMemo(() => {
    return clientTiers.reduce((acc, t) => acc + t.clientsCount, 0);
  }, [clientTiers]);

  const getActivityIcon = (type: RecentBusinessActivity["type"]) => {
    switch (type) {
      case "PAYMENT":
        return <Receipt className="size-3.5 text-emerald-600 dark:text-emerald-400" />;
      case "QUOTATION":
        return <FileCheck2 className="size-3.5 text-purple-600 dark:text-purple-400" />;
      case "EVENT":
        return <CheckCircle2 className="size-3.5 text-blue-600 dark:text-blue-400" />;
      case "CLIENT":
        return <UserCheck className="size-3.5 text-cyan-600 dark:text-cyan-400" />;
      case "INVOICE":
        return <Receipt className="size-3.5 text-amber-600 dark:text-amber-400" />;
      default:
        return <Activity className="size-3.5 text-primary" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Client Accounts & Tier Segmentation */}
      <Card className="lg:col-span-6 border-border/70 shadow-xs flex flex-col">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-border/50">
          <div>
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Users2 className="size-4" />
              </div>
              <CardTitle className="text-base font-bold tracking-tight text-foreground">
                Client Portfolio & Account Segments
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Enterprise customer tier distribution and repeat contract retention
            </CardDescription>
          </div>

          <Badge
            variant="outline"
            className="gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border-indigo-500/20 bg-indigo-500/10 self-start sm:self-auto"
          >
            <ShieldCheck className="size-3.5" />
            {retentionRate}% Repeat Retention
          </Badge>
        </CardHeader>

        <CardContent className="pt-4 flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            {clientTiers.map((tier) => (
              <div
                key={tier.tier}
                className="p-3 rounded-xl border border-border/50 bg-muted/20 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: tier.color }}
                    />
                    <span className="font-semibold text-foreground">
                      {tier.tier}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-[11px]">
                      {tier.clientsCount} Accounts
                    </span>
                    <span className="font-bold text-foreground font-mono">
                      {tier.percentage}% Share
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${tier.percentage}%`,
                      backgroundColor: tier.color,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                  <span>Revenue Contribution</span>
                  <span className="font-semibold text-foreground">
                    {tier.revenueShare}% of Gross Billings
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Total Active Accounts: <strong className="text-foreground">{totalClients}</strong>
            </span>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 gap-1.5"
              render={<Link href="/clients" />}
            >
              <span>Client Directory</span>
              <ArrowRight className="size-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live Business Activities Stream */}
      <Card className="lg:col-span-6 border-border/70 shadow-xs flex flex-col">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-border/50">
          <div>
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Activity className="size-4" />
              </div>
              <CardTitle className="text-base font-bold tracking-tight text-foreground">
                Executive Milestones & Activity Feed
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Live operational audit log of proposals, invoices, and payments
            </CardDescription>
          </div>

          <Badge variant="secondary" className="text-[11px] self-start sm:self-auto font-medium">
            Live Stream
          </Badge>
        </CardHeader>

        <CardContent className="pt-4 flex-1 flex flex-col justify-between space-y-3">
          <div className="space-y-2.5">
            {activities.slice(0, 5).map((act) => (
              <div
                key={act.id}
                className="p-2.5 rounded-lg border border-border/40 bg-card hover:bg-muted/40 transition-colors flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="size-6 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    {getActivityIcon(act.type)}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-semibold text-foreground truncate block">
                      {act.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground line-clamp-1">
                      {act.description}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 block">
                      {act.relativeTime}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-1">
                  {act.amount && (
                    <div className="font-bold text-foreground font-mono">
                      {formatINR(act.amount)}
                    </div>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 font-medium ${
                      act.statusVariant === "success"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : act.statusVariant === "warning"
                        ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : act.statusVariant === "info"
                        ? "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {act.statusBadge}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Automated financial verification active
            </span>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 gap-1.5"
              render={<Link href="/invoices" />}
            >
              <span>Ledger & Billings</span>
              <ArrowRight className="size-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
