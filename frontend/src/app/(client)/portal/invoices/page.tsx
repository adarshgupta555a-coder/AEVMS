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
  Receipt,
  Download,
  Search,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Clock,
  Loader2,
} from "lucide-react";
import { useInvoices } from "@/features/invoices/hooks/use-invoices";
import { downloadInvoicePdf } from "@/features/invoices/services/invoice.service";
import { InvoiceWithRelations } from "@/features/invoices/schemas/invoice.schema";
import { formatDate, formatINR } from "@/lib/formatters";
import { toast } from "sonner";

function getStatusBadge(status: string) {
  switch (status) {
    case "PAID":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
          Paid in Full
        </Badge>
      );
    case "PARTIALLY_PAID":
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
          Partially Paid
        </Badge>
      );
    case "ISSUED":
    case "SENT":
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">
          Payment Due
        </Badge>
      );
    case "OVERDUE":
      return (
        <Badge variant="destructive" className="bg-destructive/15 text-destructive border-destructive/30">
          Overdue
        </Badge>
      );
    case "CANCELLED":
      return <Badge variant="outline">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function ClientInvoicesPage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"all" | "unpaid" | "paid">("all");
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const { data, isLoading, error } = useInvoices({ limit: 100 });
  const invoices = React.useMemo(() => data?.invoices ?? [], [data?.invoices]);

  const handleDownload = async (
    e: React.MouseEvent,
    id: string,
    invoiceNumber: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setDownloadingId(id);
      await downloadInvoicePdf(id, invoiceNumber);
      toast.success(`Invoice ${invoiceNumber} downloaded successfully.`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to download invoice PDF."
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredInvoices = React.useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        searchTerm === "" ||
        inv.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      const total = Number(inv.totalAmount) || 0;
      const paid = Number(inv.paidAmount) || 0;
      const isUnpaid = inv.status !== "PAID" && inv.status !== "CANCELLED" && total - paid > 0.01;

      if (activeTab === "unpaid") return isUnpaid;
      if (activeTab === "paid") return inv.status === "PAID";
      return true;
    });
  }, [invoices, searchTerm, activeTab]);

  const unpaidCount = React.useMemo(() => {
    return invoices.filter((inv) => {
      const total = Number(inv.totalAmount) || 0;
      const paid = Number(inv.paidAmount) || 0;
      return inv.status !== "PAID" && inv.status !== "CANCELLED" && total - paid > 0.01;
    }).length;
  }, [invoices]);

  const paidCount = React.useMemo(() => {
    return invoices.filter((inv) => inv.status === "PAID").length;
  }, [invoices]);

  return (
    <div className="space-y-6">
      {/* Header */}
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
              My Invoices & Receipts
            </h1>
            <Badge variant="outline" className="text-xs">
              Client Portal
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Download official tax invoices, check outstanding balances, and track payment receipts.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "all" | "unpaid" | "paid")}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-3 w-full sm:w-auto">
            <TabsTrigger value="all" className="text-xs">
              All ({invoices.length})
            </TabsTrigger>
            <TabsTrigger value="unpaid" className="text-xs">
              Outstanding ({unpaidCount})
            </TabsTrigger>
            <TabsTrigger value="paid" className="text-xs">
              Paid ({paidCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>
      </div>

      {/* Invoices List */}
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
            Failed to load invoices: {error.message}
          </p>
        </Card>
      ) : filteredInvoices.length === 0 ? (
        <Card className="border-border/70 shadow-xs">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Receipt className="size-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {searchTerm ? "No matching invoices found" : "No invoices available"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              {searchTerm
                ? "Try searching with a different keyword or clear the search filter."
                : "Official tax invoices generated for your events will appear here with live balance tracking."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredInvoices.map((inv: InvoiceWithRelations) => {
            const total = Number(inv.totalAmount) || 0;
            const paid = Number(inv.paidAmount) || 0;
            const balance =
              inv.balanceAmount !== undefined
                ? Number(inv.balanceAmount)
                : Math.max(0, total - paid);
            const isDownloading = downloadingId === inv.id;

            return (
              <Card
                key={inv.id}
                className="border-border/70 hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between overflow-hidden group"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {inv.invoiceNumber}
                      </div>
                      <CardTitle className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                        {inv.title}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Calendar className="size-3 text-primary" />
                        <span>Issued: {formatDate(inv.invoiceDate)}</span>
                      </div>
                    </div>
                    <div>{getStatusBadge(inv.status)}</div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Financial Metrics */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-muted/30 border border-border/50 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        Total Amount
                      </span>
                      <span className="font-semibold text-foreground font-mono">
                        {formatINR(total)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        Paid Amount
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatINR(paid)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">
                        Balance Due
                      </span>
                      <span
                        className={`font-bold font-mono ${
                          balance > 0.01
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        {formatINR(balance)}
                      </span>
                    </div>
                  </div>

                  {inv.dueDate && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-primary" />
                        Payment Due Date
                      </span>
                      <span className="font-medium text-foreground">
                        {formatDate(inv.dueDate)}
                      </span>
                    </div>
                  )}
                </CardContent>

                <div className="border-t border-border/50 bg-muted/20 px-6 py-3 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleDownload(e, inv.id, inv.invoiceNumber)}
                    disabled={isDownloading}
                    className="text-xs h-7 gap-1.5"
                  >
                    {isDownloading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                    <span>Download PDF</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs font-semibold text-primary hover:text-primary p-0 h-auto"
                    render={<Link href={`/portal/invoices/${inv.id}`} />}
                  >
                    <span>View Statement</span>
                    <ArrowRight className="size-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
