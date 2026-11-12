"use client";

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
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  CalendarCheck,
  Clock,
  MapPin,
  Users,
  Sparkles,
  CalendarDays,
  FileText,
  AlertCircle,
} from "lucide-react";
import { useEvent, useEventSchedules } from "@/features/events/hooks/use-events";
import { formatDate, formatDateTime } from "@/lib/formatters";
import { useSetBreadcrumbTitle } from "@/store/breadcrumb-store";

function getStatusBadge(status: string) {
  switch (status) {
    case "CONFIRMED":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
          Confirmed
        </Badge>
      );
    case "IN_PROGRESS":
      return (
        <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30">
          In Production
        </Badge>
      );
    case "PLANNING":
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
          Planning
        </Badge>
      );
    case "COMPLETED":
      return (
        <Badge variant="secondary" className="text-muted-foreground">
          Completed
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge variant="destructive" className="bg-destructive/15 text-destructive border-destructive/30">
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function ClientEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);

  const { data: event, isLoading: isLoadingEvent, error: eventError } = useEvent(id);
  useSetBreadcrumbTitle(event?.title);
  const { data: schedules, isLoading: isLoadingSchedules } = useEventSchedules(id);

  const sortedSchedules = React.useMemo(() => {
    if (!schedules) return [];
    return [...schedules].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
  }, [schedules]);

  if (isLoadingEvent) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-md" />
          <div className="space-y-1">
            <Skeleton className="h-6 w-60" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-80 md:col-span-2 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="space-y-6">
        <Button
          size="sm"
          variant="ghost"
          className="gap-2 text-xs"
          render={<Link href="/portal/events" />}
        >
          <ArrowLeft className="size-4" />
          Back to Events
        </Button>
        <Card className="border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertCircle className="size-10 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-bold text-foreground">Event Not Found</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {eventError ? eventError.message : "The requested event could not be loaded."}
          </p>
        </Card>
      </div>
    );
  }

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
              render={<Link href="/portal/events" />}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {event.title}
            </h1>
            <Badge variant="outline" className="text-xs font-mono">
              {event.eventNumber}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your confirmed production timeline, venue logistics, and day-of-event schedule.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(event.status)}
        </div>
      </div>

      {/* Main Grid: Itinerary Schedule & Event Details Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Day Itinerary Schedule Timeline (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Clock className="size-4 text-primary" />
                    Day-of-Event Itinerary Timeline
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Official schedule and program milestones arranged chronologically.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {sortedSchedules.length} {sortedSchedules.length === 1 ? "Item" : "Items"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoadingSchedules ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="size-8 rounded-full shrink-0" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3.5 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : sortedSchedules.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-center border border-dashed rounded-xl border-border/70 bg-muted/10">
                  <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                    <CalendarCheck className="size-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Itinerary Timeline Being Finalized
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1">
                    Your assigned event coordinator is currently preparing the day-of-event
                    schedule. Detailed run-of-show milestones will appear here once published.
                  </p>
                </div>
              ) : (
                <div className="relative pl-6 sm:pl-8 border-l-2 border-primary/20 space-y-8 my-2">
                  {sortedSchedules.map((schedule, idx) => {
                    const startTimeStr = formatDate(schedule.startAt, "hh:mm a");
                    const endTimeStr = schedule.endAt
                      ? formatDate(schedule.endAt, "hh:mm a")
                      : null;

                    return (
                      <div key={schedule.id} className="relative group">
                        {/* Timeline Node Icon */}
                        <div className="absolute -left-[31px] sm:-left-[39px] top-0 flex size-6 items-center justify-center rounded-full bg-background border-2 border-primary text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                          <span className="text-[10px] font-bold">{idx + 1}</span>
                        </div>

                        {/* Content */}
                        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-2xs hover:border-primary/40 transition-colors space-y-1.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <h4 className="text-sm font-bold text-foreground">
                              {schedule.title}
                            </h4>
                            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                              <Clock className="size-3" />
                              <span>
                                {startTimeStr}
                                {endTimeStr ? ` - ${endTimeStr}` : ""}
                              </span>
                            </div>
                          </div>

                          {schedule.description && (
                            <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                              {schedule.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Event Overview & Notes */}
          {event.notes && (
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  Event Instructions & Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line p-3.5 rounded-lg bg-muted/40 border border-border/50">
                  {event.notes}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Venue, Timetable, Coordinator Info */}
        <div className="space-y-6">
          {/* Key Event Information Card */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-semibold">Event Particulars</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Event Type
                </span>
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Sparkles className="size-3.5 text-primary" />
                  <span>{event.eventType}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Event Date
                </span>
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <CalendarDays className="size-3.5 text-primary" />
                  <span>{formatDate(event.eventDate, "EEEE, dd MMMM yyyy")}</span>
                </div>
              </div>

              {(event.startTime || event.endTime) && (
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Operational Timing
                  </span>
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Clock className="size-3.5 text-primary" />
                    <span>
                      {event.startTime ? formatDateTime(event.startTime, "hh:mm a") : "TBA"}
                      {" - "}
                      {event.endTime ? formatDateTime(event.endTime, "hh:mm a") : "TBA"}
                    </span>
                  </div>
                </div>
              )}

              {event.guestCount !== null && event.guestCount !== undefined && (
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Guest Count
                  </span>
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Users className="size-3.5 text-primary" />
                    <span>{event.guestCount} Attending</span>
                  </div>
                </div>
              )}

              <div className="space-y-1 pt-2 border-t border-border/50">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Venue Location
                </span>
                <div className="flex items-start gap-2 text-foreground font-medium mt-1">
                  <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div>{event.venueName || "Venue name pending"}</div>
                    {event.venueAddress && (
                      <div className="text-muted-foreground text-[11px] font-normal mt-0.5">
                        {event.venueAddress}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dedicated Operations Support Card */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-semibold">Event Operations Coordinator</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                <div className="size-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                  EMS
                </div>
                <div>
                  <div className="font-semibold text-foreground">EMS Production Team</div>
                  <div className="text-[11px] text-muted-foreground">operations@ems.local</div>
                </div>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Have last-minute guest additions, itinerary adjustments, or special vendor instructions?
                Reach out to your coordinator.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
