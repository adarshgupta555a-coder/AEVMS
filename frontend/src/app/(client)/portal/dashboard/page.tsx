"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarCheck,
  FileText,
  Receipt,
  ArrowRight,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Phone,
  Mail,
  UserCheck,
  Calendar,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useEvents } from "@/features/events/hooks/use-events";
import { useQuotations } from "@/features/quotations/hooks/use-quotations";
import { useInvoices } from "@/features/invoices/hooks/use-invoices";
import { formatDate, formatINR } from "@/lib/formatters";
import { differenceInCalendarDays, startOfDay } from "date-fns";

export default function ClientDashboardPage() {
  const { user } = useAuth();

  // Queries for client data (automatically scoped to authenticated client by backend)
  const { data: eventsData, isLoading: isLoadingEvents } = useEvents({
    limit: 50,
  });
  const { data: quotationsData, isLoading: isLoadingQuotations } =
    useQuotations({ limit: 50 });
  const { data: invoicesData, isLoading: isLoadingInvoices } = useInvoices({
    limit: 50,
  });

  const events = React.useMemo(() => eventsData?.events ?? [], [eventsData?.events]);
  const quotations = React.useMemo(() => quotationsData?.quotations ?? [], [quotationsData?.quotations]);
  const invoices = React.useMemo(() => invoicesData?.invoices ?? [], [invoicesData?.invoices]);

  // Find next upcoming event
  const upcomingEvents = React.useMemo(() => {
    const today = startOfDay(new Date());
    return events
      .filter((e) => {
        const d = startOfDay(new Date(e.eventDate));
        return (
          d >= today && e.status !== "CANCELLED" && e.status !== "COMPLETED"
        );
      })
      .sort(
        (a, b) =>
          new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
      );
  }, [events]);

  const nextEvent = upcomingEvents[0];

  const countdownText = React.useMemo(() => {
    if (!nextEvent) return null;
    const today = startOfDay(new Date());
    const eventDay = startOfDay(new Date(nextEvent.eventDate));
    const days = differenceInCalendarDays(eventDay, today);
    if (days === 0) return "Today!";
    if (days === 1) return "Tomorrow";
    if (days > 1) return `${days} days remaining`;
    return "In progress";
  }, [nextEvent]);

  // Quotations awaiting review (SENT or VIEWED)
  const pendingQuotations = React.useMemo(() => {
    return quotations.filter(
      (q) => q.status === "SENT" || q.status === "VIEWED"
    );
  }, [quotations]);

  // Pending invoices with unpaid balances
  const pendingInvoices = React.useMemo(() => {
    return invoices.filter((inv) => {
      if (inv.status === "PAID" || inv.status === "CANCELLED") return false;
      const total = Number(inv.totalAmount) || 0;
      const paid = Number(inv.paidAmount) || 0;
      return total - paid > 0.01;
    });
  }, [invoices]);

  const totalOutstandingBalance = React.useMemo(() => {
    return pendingInvoices.reduce((sum, inv) => {
      const total = Number(inv.totalAmount) || 0;
      const paid = Number(inv.paidAmount) || 0;
      const bal = inv.balanceAmount !== undefined ? Number(inv.balanceAmount) : total - paid;
      return sum + Math.max(0, bal);
    }, 0);
  }, [pendingInvoices]);

  const clientDisplayName = user?.client?.name || user?.name || "Client";

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-background border border-border/70 p-6 md:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="size-3" />
              <span>Client Self-Service Portal</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Welcome back, {clientDisplayName}!
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Track your event production timeline, approve estimates, download
              tax invoices, and stay in touch with your event coordinator.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-background/80 backdrop-blur-xs text-xs px-3 py-1 font-semibold text-emerald-600 border-emerald-500/30">
              <span className="size-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Account Active
            </Badge>
          </div>
        </div>
      </div>

      {/* Primary KPI & Alert Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Next Upcoming Event with Countdown */}
        <Card className="border-border/70 shadow-xs flex flex-col justify-between overflow-hidden relative">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="size-3.5 text-primary" />
                Next Upcoming Event
              </CardTitle>
              {nextEvent && (
                <Badge variant="secondary" className="text-[11px] font-semibold bg-primary/10 text-primary border-primary/20">
                  {countdownText}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingEvents ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : nextEvent ? (
              <div>
                <h3 className="text-lg font-bold text-foreground leading-tight">
                  {nextEvent.title}
                </h3>
                <div className="text-xs font-medium text-primary mt-0.5">
                  {nextEvent.eventType}
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-primary shrink-0" />
                    <span>{formatDate(nextEvent.eventDate, "EEEE, dd MMMM yyyy")}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-primary shrink-0" />
                    <span className="truncate">
                      {nextEvent.venueName || "Venue address pending"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-2">
                <p className="text-sm text-muted-foreground">
                  No upcoming events scheduled right now.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Once your coordinator plans an event, its schedule and countdown will appear here.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-0 border-t border-border/50 bg-muted/20 px-6 py-3">
            {nextEvent ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-xs font-medium text-primary hover:text-primary p-0 h-auto"
                render={<Link href={`/portal/events/${nextEvent.id}`} />}
              >
                <span>View Event Program</span>
                <ArrowRight className="size-3.5 ml-1" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-xs font-medium text-muted-foreground p-0 h-auto"
                render={<Link href="/portal/events" />}
              >
                <span>Browse Past Events</span>
                <ArrowRight className="size-3.5 ml-1" />
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Card 2: Quotations Awaiting Approval */}
        <Card className="border-border/70 shadow-xs flex flex-col justify-between overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="size-3.5 text-amber-500" />
                Quotations For Review
              </CardTitle>
              {pendingQuotations.length > 0 && (
                <Badge variant="outline" className="text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                  Action Required
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingQuotations ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div>
                <div className="text-3xl font-extrabold tracking-tight text-foreground">
                  {pendingQuotations.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingQuotations.length === 1
                    ? "1 quotation proposal awaiting your approval"
                    : `${pendingQuotations.length} quotations awaiting your approval`}
                </p>
                {pendingQuotations.length > 0 && (
                  <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                    Review pricing, line items, and terms to approve your event production.
                  </div>
                )}
                {pendingQuotations.length === 0 && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>All quotations up to date!</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-0 border-t border-border/50 bg-muted/20 px-6 py-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 p-0 h-auto"
              render={<Link href="/portal/quotations" />}
            >
              <span>Review Quotations</span>
              <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </CardFooter>
        </Card>

        {/* Card 3: Pending Invoices Alert Card */}
        <Card className="border-border/70 shadow-xs flex flex-col justify-between overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Receipt className="size-3.5 text-indigo-500" />
                Pending Invoices
              </CardTitle>
              {pendingInvoices.length > 0 ? (
                <Badge variant="outline" className="text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30">
                  {pendingInvoices.length} Unpaid
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  Settled
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingInvoices ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div>
                <div className="text-2xl font-extrabold tracking-tight text-foreground">
                  {formatINR(totalOutstandingBalance)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total outstanding balance across pending invoices
                </p>
                {pendingInvoices.length > 0 ? (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <AlertCircle className="size-3.5 text-rose-500 shrink-0" />
                    <span>Download statements & coordinate payments</span>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>No outstanding invoice balances!</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-0 border-t border-border/50 bg-muted/20 px-6 py-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 p-0 h-auto"
              render={<Link href="/portal/invoices" />}
            >
              <span>View Invoices & Receipts</span>
              <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Quick Services & Operations Support */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Quick Actions (2 cols on tablet/desktop) */}
        <Card className="border-border/70 shadow-xs md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Self-Service Hub
            </CardTitle>
            <CardDescription className="text-xs">
              Quick access to your event production documents, schedules, and profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                title: "Scheduled Events",
                href: "/portal/events",
                desc: "Timelines, venue itineraries, and run-sheet milestones",
                icon: CalendarCheck,
                badge: `${events.length} Events`,
              },
              {
                title: "Review Quotations",
                href: "/portal/quotations",
                desc: "Review pricing breakdowns and accept proposals",
                icon: FileText,
                badge:
                  pendingQuotations.length > 0
                    ? `${pendingQuotations.length} Pending`
                    : undefined,
              },
              {
                title: "Invoices & Receipts",
                href: "/portal/invoices",
                desc: "Download official tax PDFs and view paid receipts",
                icon: Receipt,
                badge:
                  pendingInvoices.length > 0
                    ? `${pendingInvoices.length} Due`
                    : undefined,
              },
              {
                title: "My Client Profile",
                href: "/portal/profile",
                desc: "Review registered contact details and security info",
                icon: UserCheck,
                badge: "Active",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col justify-between p-3.5 rounded-xl border border-border/60 hover:border-primary/50 hover:bg-muted/40 transition-all group"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Icon className="size-4" />
                      </div>
                      {item.badge && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-medium"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <div className="flex items-center text-xs font-medium text-primary mt-3 pt-2 border-t border-border/40">
                    <span>Open screen</span>
                    <ArrowRight className="size-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {/* Assigned Event Coordinator Card */}
        <Card className="border-border/70 shadow-xs flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Assigned Coordinator
            </CardTitle>
            <CardDescription className="text-xs">
              Dedicated operations contact for your events.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/50">
              <div className="size-11 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                EMS
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">
                  EMS Operations Desk
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  Senior Event Producer
                </div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                  Available Mon-Sat 9AM-7PM
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-3.5 text-primary shrink-0" />
                <span className="text-foreground font-medium">operations@ems.local</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="size-3.5 text-primary shrink-0" />
                <span className="text-foreground font-medium">+91 98765 43210</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/15 text-xs text-muted-foreground leading-relaxed">
              Need changes to your venue setup or quotation terms? Contact your coordinator directly via phone or email.
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              render={<a href="mailto:operations@ems.local?subject=Client%20Portal%20Inquiry" />}
            >
              <Mail className="size-3.5 mr-1.5" />
              Email Operations Desk
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
