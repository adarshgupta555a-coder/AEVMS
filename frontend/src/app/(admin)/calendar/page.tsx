"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { MasterCalendar } from "@/features/calendar/components/master-calendar";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Master Operations Calendar
            </h1>
            <Badge variant="outline" className="text-xs">
              Live Operations
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Operational schedule displaying client meetings, site visits, vendor walkthroughs, and office execution milestones.
          </p>
        </div>
      </div>

      {/* Master Operational Calendar */}
      <MasterCalendar />
    </div>
  );
}
