"use client";

import * as React from "react";
import {
  useDashboardMetrics,
  useIsMounted,
  DashboardHeader,
  KPICardGrid,
  RevenuePerformanceChart,
  EventPortfolioDonut,
  QuotationFunnelCard,
  UpcomingOperationsTimeline,
  ClientGrowthAndActivity,
} from "@/features/dashboard";

export default function AdminDashboardPage() {
  const {
    timeframe,
    setTimeframe,
    forceDemoMode,
    setForceDemoMode,
    metrics,
    isLoading,
    isRefetching,
    refetchAll,
    hasRealData,
  } = useDashboardMetrics("30d");

  const isMounted = useIsMounted();

  if (!isMounted && isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-muted/40 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-32 bg-muted/40 rounded-xl" />
          <div className="h-32 bg-muted/40 rounded-xl" />
          <div className="h-32 bg-muted/40 rounded-xl" />
          <div className="h-32 bg-muted/40 rounded-xl" />
        </div>
        <div className="h-96 bg-muted/40 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-80 bg-muted/40 rounded-xl" />
          <div className="h-80 bg-muted/40 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Executive Command Header & Global Action Bar */}
      <DashboardHeader
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        isRefetching={isRefetching}
        onRefresh={refetchAll}
        hasRealData={hasRealData}
        forceDemoMode={forceDemoMode}
        onToggleDemoMode={() => setForceDemoMode((prev) => !prev)}
      />

      {/* Tier 1: Executive KPI Cards */}
      <KPICardGrid metrics={metrics} />

      {/* Tier 2: Revenue Generation & Cash Realization (Flagship Area/Bar Chart) */}
      <RevenuePerformanceChart
        data={metrics.revenueHistory}
        timeframe={timeframe}
        totalInvoiced={metrics.summary.totalInvoiced}
        totalCollected={metrics.summary.totalCollected}
        outstandingReceivables={metrics.summary.outstandingReceivables}
      />

      {/* Tier 3: Event Portfolio Distribution & Quotation Funnel (2 Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6 flex flex-col">
          <EventPortfolioDonut
            data={metrics.categoryBreakdown}
            totalEvents={metrics.kpis.activeEvents.rawValue}
          />
        </div>

        <div className="lg:col-span-6 flex flex-col">
          <QuotationFunnelCard
            stages={metrics.quotationFunnel}
            pipelineWinRate={metrics.summary.pipelineWinRate}
            averageDealSize={metrics.summary.averageDealSize}
          />
        </div>
      </div>

      {/* Tier 4: Upcoming Premier Operations & Milestones Roster */}
      <UpcomingOperationsTimeline events={metrics.upcomingEvents} />

      {/* Tier 5: Client Portfolio Segments & Live Activity Milestones */}
      <ClientGrowthAndActivity
        clientTiers={metrics.clientTiers}
        activities={metrics.recentActivities}
        retentionRate={metrics.summary.repeatClientRetentionRate}
      />
    </div>
  );
}
