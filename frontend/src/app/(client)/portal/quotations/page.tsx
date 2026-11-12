"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Search,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { useQuotations } from "@/features/quotations/hooks/use-quotations";
import { QuotationWithRelations } from "@/features/quotations/schemas/quotation.schema";
import { formatDate, formatINR } from "@/lib/formatters";

function getStatusBadge(status: string) {
  switch (status) {
    case "SENT":
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
          Awaiting Review
        </Badge>
      );
    case "VIEWED":
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">
          Under Review
        </Badge>
      );
    case "ACCEPTED":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
          Accepted
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="destructive" className="bg-destructive/15 text-destructive border-destructive/30">
          Declined
        </Badge>
      );
    case "EXPIRED":
      return <Badge variant="secondary">Expired</Badge>;
    case "CANCELLED":
      return <Badge variant="outline">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function ClientQuotationsPage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"all" | "pending" | "decided">("all");

  const { data, isLoading, error } = useQuotations({ limit: 100 });
  const quotations = React.useMemo(() => data?.quotations ?? [], [data?.quotations]);

  const filteredQuotations = React.useMemo(() => {
    return quotations.filter((q) => {
      const matchesSearch =
        searchTerm === "" ||
        q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.eventType.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (activeTab === "pending") {
        return q.status === "SENT" || q.status === "VIEWED";
      }
      if (activeTab === "decided") {
        return q.status === "ACCEPTED" || q.status === "REJECTED";
      }
      return true;
    });
  }, [quotations, searchTerm, activeTab]);

  const pendingCount = React.useMemo(() => {
    return quotations.filter((q) => q.status === "SENT" || q.status === "VIEWED").length;
  }, [quotations]);

  const decidedCount = React.useMemo(() => {
    return quotations.filter((q) => q.status === "ACCEPTED" || q.status === "REJECTED").length;
  }, [quotations]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              render={<Link href="/portal/dashboard" />}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Review Quotations
            </h1>
            <Badge variant="outline" className="text-xs">
              Client Portal
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review proposed event estimates, itemized cost breakdowns, and approve or request revisions.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "all" | "pending" | "decided")}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-3 w-full sm:w-auto">
            <TabsTrigger value="all" className="text-xs">
              All ({quotations.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-xs">
              Pending Review ({pendingCount})
            </TabsTrigger>
            <TabsTrigger value="decided" className="text-xs">
              Completed ({decidedCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search quotations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>
      </div>

      {/* Quotations List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-border/70 p-5 space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <div className="space-y-2 pt-2">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive font-medium">
            Failed to load quotations: {error.message}
          </p>
        </Card>
      ) : filteredQuotations.length === 0 ? (
        <Card className="border-border/70 shadow-xs">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
              <FileText className="size-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {searchTerm ? "No matching quotations found" : "No quotations available"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              {searchTerm
                ? "Try searching with a different keyword or clear the search filter."
                : "When your coordinator generates an estimate or proposal, it will appear here for your review and approval."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQuotations.map((q: QuotationWithRelations) => (
            <Card
              key={q.id}
              className="border-border/70 hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between overflow-hidden group"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {q.quotationNumber}
                    </div>
                    <CardTitle className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                      {q.title}
                    </CardTitle>
                    <div className="inline-flex items-center gap-1.5 text-xs text-primary font-medium mt-0.5">
                      <Sparkles className="size-3" />
                      {q.eventType}
                    </div>
                  </div>
                  <div>{getStatusBadge(q.status)}</div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-xs text-muted-foreground">Proposal Total</span>
                  <span className="text-lg font-bold text-foreground">
                    {formatINR(q.totalAmount)}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground pt-1 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-primary" />
                      Date Generated
                    </span>
                    <span className="font-medium text-foreground">
                      {formatDate(q.createdAt)}
                    </span>
                  </div>

                  {q.validUntil && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="size-3.5 text-amber-500" />
                        Valid Until
                      </span>
                      <span className="font-medium text-foreground">
                        {formatDate(q.validUntil)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>

              <div className="border-t border-border/50 bg-muted/20 px-6 py-3 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {q.status === "SENT" || q.status === "VIEWED"
                    ? "Action required: Review & Accept"
                    : "View itemized proposal"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs font-semibold text-primary hover:text-primary p-0 h-auto"
                  render={<Link href={`/portal/quotations/${q.id}`} />}
                >
                  <span>Review Quotation</span>
                  <ArrowRight className="size-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
