export type DashboardTimeframe = "30d" | "90d" | "6m" | "1y";

export interface KPICardMetric {
  id: string;
  title: string;
  value: string;
  rawValue: number;
  previousValue?: string;
  changePercent: number;
  trend: "up" | "down" | "neutral";
  subtext: string;
  badgeLabel?: string;
  iconName: "revenue" | "events" | "pipeline" | "collections" | "clients";
}

export interface RevenueDataPoint {
  period: string;
  invoiced: number;
  collected: number;
  budget: number;
  margin: number;
}

export interface EventCategoryDataPoint {
  category: string;
  count: number;
  revenue: number;
  percentage: number;
  color: string;
}

export interface QuotationFunnelStage {
  stage: string;
  key: string;
  count: number;
  value: number;
  conversionRate: number;
  color: string;
}

export interface UpcomingEventSummary {
  id: string;
  title: string;
  clientName: string;
  clientCompany?: string;
  eventType: string;
  eventDate: string;
  daysUntilText: string;
  venueName: string;
  guestCount?: number;
  budget: number;
  status: "CONFIRMED" | "PLANNING" | "IN_PROGRESS";
  financialStatus: "FULLY_PAID" | "ADVANCE_PAID" | "PENDING_INVOICE";
}

export interface RecentBusinessActivity {
  id: string;
  type: "PAYMENT" | "QUOTATION" | "EVENT" | "CLIENT" | "INVOICE";
  title: string;
  description: string;
  amount?: number;
  timestamp: string;
  relativeTime: string;
  statusBadge: string;
  statusVariant: "success" | "warning" | "info" | "default";
}

export interface ClientTierDistribution {
  tier: string;
  clientsCount: number;
  percentage: number;
  revenueShare: number;
  color: string;
}

export interface DashboardMetricsData {
  timeframe: DashboardTimeframe;
  kpis: {
    revenue: KPICardMetric;
    activeEvents: KPICardMetric;
    quotationPipeline: KPICardMetric;
    collectionRate: KPICardMetric;
  };
  revenueHistory: RevenueDataPoint[];
  categoryBreakdown: EventCategoryDataPoint[];
  quotationFunnel: QuotationFunnelStage[];
  upcomingEvents: UpcomingEventSummary[];
  recentActivities: RecentBusinessActivity[];
  clientTiers: ClientTierDistribution[];
  summary: {
    totalInvoiced: number;
    totalCollected: number;
    outstandingReceivables: number;
    collectionEfficiencyRate: number;
    averageDealSize: number;
    pipelineWinRate: number;
    repeatClientRetentionRate: number;
  };
}
