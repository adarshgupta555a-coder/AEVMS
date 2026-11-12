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
import { formatINR, formatDate } from "@/lib/formatters";
import type { UpcomingEventSummary } from "../types";
import {
  CalendarDays,
  MapPin,
  Users,
  ArrowRight,
  Clock,
  Building2,
} from "lucide-react";

interface UpcomingOperationsTimelineProps {
  events: UpcomingEventSummary[];
}

export function UpcomingOperationsTimeline({ events }: UpcomingOperationsTimelineProps) {
  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CalendarDays className="size-4" />
            </div>
            <CardTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              Upcoming Premier Operations & Milestones
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Key operational milestones, venue logistics, and financial status for upcoming productions
          </CardDescription>
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-xs text-primary self-start sm:self-auto cursor-pointer"
          render={<Link href="/events" />}
        >
          <span>View Master Operations Roster</span>
          <ArrowRight className="size-3.5" />
        </Button>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs">
            No upcoming events scheduled in this operational window.
          </div>
        ) : (
          events.map((event) => {
            const isUrgent =
              event.daysUntilText === "Today" || event.daysUntilText === "Tomorrow";

            return (
              <div
                key={event.id}
                className="group p-3.5 rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-primary/30 transition-all shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                {/* Event Core Info */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                      {event.title}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-medium px-2 py-0"
                    >
                      {event.eventType}
                    </Badge>
                    {isUrgent && (
                      <Badge className="text-[10px] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 px-2 py-0">
                        Immediate Production
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1 text-foreground/80 font-medium">
                      <Building2 className="size-3.5 text-muted-foreground" />
                      {event.clientName}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5 text-muted-foreground" />
                      {event.venueName}
                    </span>
                    {event.guestCount && (
                      <span className="flex items-center gap-1">
                        <Users className="size-3.5 text-muted-foreground" />
                        {event.guestCount.toLocaleString()} Guests
                      </span>
                    )}
                  </div>
                </div>

                {/* Logistics & Financial Pills */}
                <div className="flex items-center gap-3 shrink-0 self-start md:self-center flex-wrap">
                  {/* Countdown pill */}
                  <div className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-muted text-foreground">
                    <Clock className="size-3 text-muted-foreground" />
                    <span>{event.daysUntilText}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      ({formatDate(event.eventDate, "dd MMM")})
                    </span>
                  </div>

                  {/* Financial Status */}
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium px-2 py-0.5 ${
                      event.financialStatus === "FULLY_PAID"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : event.financialStatus === "ADVANCE_PAID"
                        ? "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {event.financialStatus === "FULLY_PAID"
                      ? "100% Settled"
                      : event.financialStatus === "ADVANCE_PAID"
                      ? "Deposit Received"
                      : "Pending Settlement"}
                  </Badge>

                  {/* Contract Value */}
                  <span className="text-xs font-bold text-foreground font-mono">
                    {formatINR(event.budget)}
                  </span>

                  {/* Action Link */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 px-2.5 group-hover:border-primary/40 group-hover:bg-primary/5 transition-colors"
                    render={<Link href={`/events/${event.id}`} />}
                  >
                    <span>Inspect</span>
                    <ArrowRight className="size-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
