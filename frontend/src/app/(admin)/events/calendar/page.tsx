"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MasterCalendar } from "@/features/calendar/components/master-calendar";
import {
  List,
  Kanban,
  CalendarDays,
  GanttChartSquare,
  Plus,
} from "lucide-react";

export default function EventCalendarPage() {
  return (
    <div className="space-y-6">
      {/* Operations Header with View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Event Operations Calendar
            </h1>
            <Badge variant="outline" className="text-xs">
              Live Schedule
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Master operational schedule displaying site visits, venue bookings, rehearsal calls, and event execution dates.
          </p>
        </div>

        {/* View Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              render={<Link href="/events" />}
            >
              <List className="size-3.5 mr-1" /> Table
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              render={<Link href="/events/board" />}
            >
              <Kanban className="size-3.5 mr-1" /> Board
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2.5 text-xs font-semibold shadow-xs"
              render={<Link href="/events/calendar" />}
            >
              <CalendarDays className="size-3.5 mr-1" /> Calendar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              render={<Link href="/events/timeline" />}
            >
              <GanttChartSquare className="size-3.5 mr-1" /> Gantt
            </Button>
          </div>

          <Button size="sm" className="gap-1.5" render={<Link href="/events/new" />}>
            <Plus className="size-4" />
            Create Event
          </Button>
        </div>
      </div>

      {/* Live Master Operational Calendar */}
      <MasterCalendar />
    </div>
  );
}
