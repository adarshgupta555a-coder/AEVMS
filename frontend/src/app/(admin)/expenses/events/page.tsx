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
import { ArrowLeft, CalendarCheck, Plus } from "lucide-react";

export default function EventExpensesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="size-7" render={<Link href="/expenses" />}>
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Event Expenses
            </h1>
            <Badge variant="outline" className="text-xs">
              Project Outflows
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Direct production expenses linked to specific event IDs for accurate project profitability calculations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Record Event Cost
          </Button>
        </div>
      </div>

      <Card className="border-border/70 shadow-xs">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Event Cost Breakdown</CardTitle>
          <CardDescription className="text-xs">
            Linked to Event projects: <code className="font-mono text-primary">eventId</code> required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-lg border-border/70 bg-muted/10">
            <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
              <CalendarCheck className="size-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Event Expense Tracker Ready</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Computes net project margin = Invoiced Amount &minus; Event Direct Expenses.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
