"use client";

import * as React from "react";
import Link from "next/link";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ExternalLink,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEvents } from "../hooks/use-events";

interface GanttEvent {
  id: string;
  eventNumber: string;
  title: string;
  clientName: string;
  startDate: Date;
  endDate: Date;
  venueName: string;
  budget: number;
  status: "DRAFT" | "PLANNING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
}

const statusColors: Record<GanttEvent["status"], { bar: string; badge: string }> = {
  COMPLETED: {
    bar: "bg-emerald-500/80 hover:bg-emerald-500 text-white",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  IN_PROGRESS: {
    bar: "bg-blue-600/85 hover:bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/50",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  CONFIRMED: {
    bar: "bg-indigo-600/80 hover:bg-indigo-600 text-white",
    badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  PLANNING: {
    bar: "bg-amber-500/80 hover:bg-amber-500 text-white",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  DRAFT: {
    bar: "bg-slate-400/80 hover:bg-slate-400 text-white",
    badge: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  },
  CANCELLED: {
    bar: "bg-rose-500/80 hover:bg-rose-500 text-white",
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
};

export function GanttChart() {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const { data, isLoading } = useEvents({ limit: 100 });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const rawEvents = data?.events ?? [];
  const ganttEvents: GanttEvent[] = rawEvents
    .map((evt) => {
      const start = new Date(evt.eventDate);
      const end = evt.endTime ? new Date(evt.endTime) : new Date(evt.eventDate);
      const budget =
        typeof evt.budget === "string"
          ? parseFloat(evt.budget)
          : evt.budget || 0;

      return {
        id: evt.id,
        eventNumber: evt.eventNumber,
        title: evt.title,
        clientName: evt.client?.name || "Client",
        startDate: start,
        endDate: end >= start ? end : start,
        venueName: evt.venueName || "TBD",
        budget,
        status: evt.status as GanttEvent["status"],
      };
    })
    .filter((evt) => evt.startDate <= monthEnd && evt.endDate >= monthStart);

  const handlePrevMonth = () => setCurrentDate((prev) => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate((prev) => addMonths(prev, 1));
  const handleToday = () => setCurrentDate(new Date());

  return (
    <div className="space-y-4">
      {/* Month Navigator Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl border border-border/80 bg-card">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <CalendarIcon className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {format(currentDate, "MMMM yyyy")}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {daysInMonth.length} Days Timeline Grid • {ganttEvents.length} Active Events
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Loading schedule...</span>
            </div>
          )}

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="size-8 p-0"
              onClick={handlePrevMonth}
              aria-label="Previous Month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 px-2.5"
              onClick={handleToday}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="size-8 p-0"
              onClick={handleNextMonth}
              aria-label="Next Month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Gantt Timeline Viewport */}
      <div className="rounded-xl border border-border/80 bg-background overflow-hidden shadow-xs">
        <div className="overflow-x-auto scrollbar-thin">
          <div className="min-w-[1000px]">
            {/* Header Row: Projects column + Date days */}
            <div className="grid grid-cols-[260px_1fr] border-b border-border/70 bg-muted/40">
              <div className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground border-r border-border/60 flex items-center">
                Project & Client
              </div>

              {/* Day Headers Grid */}
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${daysInMonth.length}, minmax(32px, 1fr))`,
                }}
              >
                {daysInMonth.map((day) => {
                  const dayIsToday = isToday(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "py-2 text-center border-r border-border/40 text-[10px] flex flex-col items-center justify-center transition-colors",
                        dayIsToday && "bg-primary/10 font-bold text-primary"
                      )}
                    >
                      <span className="text-[9px] uppercase text-muted-foreground">
                        {format(day, "EEE")[0]}
                      </span>
                      <span
                        className={cn(
                          dayIsToday &&
                            "size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center mt-0.5"
                        )}
                      >
                        {format(day, "d")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Event Project Rows */}
            {ganttEvents.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <CalendarDays className="size-8 text-muted-foreground mb-2 opacity-50" />
                <p className="text-xs font-medium text-foreground">
                  No event productions scheduled in {format(currentDate, "MMMM yyyy")}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Navigate months using the arrows above or create a new event project.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {ganttEvents.map((evt) => {
                  // Calculate grid column positioning clamped to month boundaries
                  const rawStartDay = evt.startDate.getDate();
                  const rawEndDay = evt.endDate.getDate();

                  const startDay =
                    evt.startDate < monthStart ? 1 : rawStartDay;
                  const endDay =
                    evt.endDate > monthEnd
                      ? daysInMonth.length
                      : rawEndDay;
                  const durationDays = Math.max(1, endDay - startDay + 1);

                  return (
                    <div
                      key={evt.id}
                      className="grid grid-cols-[260px_1fr] hover:bg-muted/20 transition-colors group"
                    >
                      {/* Sticky-style Project Label */}
                      <div className="p-3 border-r border-border/60 flex flex-col justify-center gap-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-mono font-medium text-muted-foreground">
                            {evt.eventNumber}
                          </span>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[9px] px-1 py-0",
                              statusColors[evt.status]?.badge
                            )}
                          >
                            {evt.status}
                          </Badge>
                        </div>

                        <Link
                          href={`/events/${evt.id}`}
                          className="text-xs font-semibold text-foreground hover:text-primary transition-colors truncate block"
                          title={evt.title}
                        >
                          {evt.title}
                        </Link>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="truncate">{evt.clientName}</span>
                          <span className="font-medium text-foreground font-mono">
                            ₹{(evt.budget / 1000).toFixed(0)}k
                          </span>
                        </div>
                      </div>

                      {/* Timeline Grid Row */}
                      <div
                        className="grid relative items-center py-2 px-1"
                        style={{
                          gridTemplateColumns: `repeat(${daysInMonth.length}, minmax(32px, 1fr))`,
                        }}
                      >
                        {/* Grid Column Background Lines */}
                        {daysInMonth.map((day, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "absolute top-0 bottom-0 border-r border-border/20 pointer-events-none",
                              isToday(day) && "bg-primary/5"
                            )}
                            style={{
                              left: `${(idx / daysInMonth.length) * 100}%`,
                              width: `${(1 / daysInMonth.length) * 100}%`,
                            }}
                          />
                        ))}

                        {/* Event Duration Bar */}
                        <div
                          className={cn(
                            "relative z-10 h-7 rounded-md px-2.5 flex items-center justify-between text-[11px] font-medium truncate cursor-pointer transition-all shadow-xs group/bar",
                            statusColors[evt.status]?.bar ||
                              statusColors.DRAFT.bar
                          )}
                          style={{
                            gridColumnStart: startDay,
                            gridColumnEnd: `span ${durationDays}`,
                          }}
                          title={`${evt.title} (${format(evt.startDate, "d MMM")} - ${format(evt.endDate, "d MMM")})`}
                        >
                          <span className="truncate font-semibold text-[10px]">
                            {evt.title}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover/bar:opacity-100 transition-opacity">
                            <Link href={`/events/${evt.id}`}>
                              <ExternalLink className="size-3 text-white/90 hover:text-white" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline Legend */}
      <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg border border-border/60 bg-muted/20 text-xs">
        <span className="font-semibold text-foreground">Timeline Statuses:</span>
        {Object.entries(statusColors).map(([status, config]) => (
          <div
            key={status}
            className="flex items-center gap-1.5 text-muted-foreground text-[11px]"
          >
            <span
              className={cn("size-2 rounded-full", config.bar.split(" ")[0])}
            />
            <span>{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
