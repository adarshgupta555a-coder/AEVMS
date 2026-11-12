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
import {
  Users,
  CalendarCheck,
  FileText,
  Receipt,
  ArrowUpRight,
  Plus,
} from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Executive Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time overview of active events, pending quotations, and client receivables.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" render={<Link href="/events/new" />}>
            <Plus className="size-4" />
            Create Event
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" render={<Link href="/quotations/new" />}>
            <Plus className="size-4" />
            New Quotation
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Clients
            </CardTitle>
            <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Users className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">--</div>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Verified API /api/v1/clients
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active Events
            </CardTitle>
            <div className="size-8 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CalendarCheck className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">--</div>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Verified API /api/v1/events
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quotations In Review
            </CardTitle>
            <div className="size-8 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <FileText className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">--</div>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Verified API /api/v1/quotations
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Invoices
            </CardTitle>
            <div className="size-8 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Receipt className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">--</div>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Verified API /api/v1/invoices
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/70 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Verified Business Modules</CardTitle>
            <CardDescription className="text-xs">
              Backend verified endpoints ready for frontend integration in Phase 1-6.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { title: "Client Management", href: "/clients", desc: "Manage client master records & portal access" },
              { title: "Quotation Management", href: "/quotations", desc: "Formulate event quotations with automated tax engine" },
              { title: "Event Operations", href: "/events", desc: "Project lifecycle tracking from planning to completion" },
              { title: "Master Operations Calendar", href: "/calendar", desc: "Full calendar view of visits, meetings, and dates" },
              { title: "Billing & Invoicing", href: "/invoices", desc: "Proforma & tax invoices with advance adjustment" },
              { title: "Payment Engine", href: "/payments", desc: "Client payment receipts with multi-invoice allocation" },
            ].map((module) => (
              <Link
                key={module.href}
                href={module.href}
                className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors group"
              >
                <div>
                  <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    {module.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{module.desc}</div>
                </div>
                <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Backend Engine Status</CardTitle>
            <CardDescription className="text-xs">
              Verified against Express TypeScript server & Prisma PostgreSQL schema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 text-xs">
              <span className="font-medium text-foreground">API Version</span>
              <Badge variant="outline">v1 (/api/v1)</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 text-xs">
              <span className="font-medium text-foreground">Authentication</span>
              <Badge variant="secondary">Bearer JWT + Cookie</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 text-xs">
              <span className="font-medium text-foreground">Authorization</span>
              <Badge variant="secondary">ADMIN & CLIENT Roles</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 text-xs">
              <span className="font-medium text-foreground">Deferred Modules</span>
              <span className="text-[11px] text-muted-foreground">Inventory, Tie-ups, Expenses (Pending Backend)</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
