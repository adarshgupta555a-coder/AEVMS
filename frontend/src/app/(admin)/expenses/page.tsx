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
import { Wallet, Plus, Search } from "lucide-react";

export default function ExpensesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Expense Management
            </h1>
            <Badge variant="outline" className="text-xs">
              All Expenses
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Operational cash outflow tracking, event vendor expenses, office overheads, and personal withdrawal isolation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" render={<Link href="/expenses/events" />}>
            Event Expenses
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" render={<Link href="/expenses/withdrawals" />}>
            Withdrawals
          </Button>
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Add Expense
          </Button>
        </div>
      </div>

      <Card className="border-border/70 shadow-xs">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">Operating Expenses Register</CardTitle>
              <CardDescription className="text-xs">
                Phase 13 Expense UI Adapter (General Business Overheads & Event Specific Outflows)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="text-xs h-8">
                <Search className="size-3.5 mr-1" /> Search
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-lg border-border/70 bg-muted/10">
            <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Wallet className="size-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Expense Register Ready</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Supports categorizing expenses into General Office, Venue Rentals, Catering, Sound/Light, and Logistics.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
