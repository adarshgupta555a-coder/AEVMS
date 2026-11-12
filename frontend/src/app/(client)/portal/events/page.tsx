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
  Calendar,
  MapPin,
  Users,
  Search,
  ArrowRight,
  ArrowLeft,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { useEvents } from "@/features/events/hooks/use-events";
import { EventItem } from "@/features/events/schemas/event.schema";
import { formatDate } from "@/lib/formatters";
import { startOfDay } from "date-fns";

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

export default function ClientEventsPage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"all" | "upcoming" | "past">("all");

  const { data, isLoading, error } = useEvents({ limit: 100 });
  const events = React.useMemo(() => data?.events ?? [], [data?.events]);

  const filteredEvents = React.useMemo(() => {
    const today = startOfDay(new Date());
    return events.filter((event) => {
      // Search matching
      const matchesSearch =
        searchTerm === "" ||
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.eventType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (event.venueName && event.venueName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        event.eventNumber.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      const eventDate = startOfDay(new Date(event.eventDate));
      if (activeTab === "upcoming") {
        return eventDate >= today && event.status !== "CANCELLED";
      }
      if (activeTab === "past") {
        return eventDate < today || event.status === "COMPLETED";
      }
      return true;
    });
  }, [events, searchTerm, activeTab]);

  const upcomingCount = React.useMemo(() => {
    const today = startOfDay(new Date());
    return events.filter(
      (e) => startOfDay(new Date(e.eventDate)) >= today && e.status !== "CANCELLED"
    ).length;
  }, [events]);

  const pastCount = React.useMemo(() => {
    const today = startOfDay(new Date());
    return events.filter(
      (e) => startOfDay(new Date(e.eventDate)) < today || e.status === "COMPLETED"
    ).length;
  }, [events]);

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
              render={<Link href="/portal/dashboard" />}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              My Scheduled Events
            </h1>
            <Badge variant="outline" className="text-xs">
              Client Portal
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            View your event production schedule, venue details, and confirmed run-of-show itineraries.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "all" | "upcoming" | "past")}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-3 w-full sm:w-auto">
            <TabsTrigger value="all" className="text-xs">
              All ({events.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="text-xs">
              Upcoming ({upcomingCount})
            </TabsTrigger>
            <TabsTrigger value="past" className="text-xs">
              Past ({pastCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search events or venues..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>
      </div>

      {/* Events List / Grid */}
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
            Failed to load events: {error.message}
          </p>
        </Card>
      ) : filteredEvents.length === 0 ? (
        <Card className="border-border/70 shadow-xs">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
              <CalendarDays className="size-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {searchTerm ? "No matching events found" : "No events scheduled yet"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              {searchTerm
                ? "Try searching with a different term or clear the filter."
                : "When your event coordinator creates and schedules your event, it will appear here with full itineraries."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEvents.map((event: EventItem) => (
            <Card
              key={event.id}
              className="border-border/70 hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between overflow-hidden group"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {event.eventNumber}
                    </div>
                    <CardTitle className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                      {event.title}
                    </CardTitle>
                    <div className="inline-flex items-center gap-1.5 text-xs text-primary font-medium mt-0.5">
                      <Sparkles className="size-3" />
                      {event.eventType}
                    </div>
                  </div>
                  <div>{getStatusBadge(event.status)}</div>
                </div>
              </CardHeader>

              <CardContent className="space-y-2.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="size-3.5 text-primary shrink-0" />
                  <span className="text-foreground font-medium">
                    {formatDate(event.eventDate, "EEEE, dd MMMM yyyy")}
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin className="size-3.5 text-primary shrink-0 mt-0.5" />
                  <span className="truncate">
                    {event.venueName
                      ? `${event.venueName}${event.venueAddress ? `, ${event.venueAddress}` : ""}`
                      : "Venue details to be announced"}
                  </span>
                </div>

                {event.guestCount !== null && event.guestCount !== undefined && (
                  <div className="flex items-center gap-2">
                    <Users className="size-3.5 text-primary shrink-0" />
                    <span>Estimated {event.guestCount} Guests</span>
                  </div>
                )}
              </CardContent>

              <div className="border-t border-border/50 bg-muted/20 px-6 py-3 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  View timeline & day itinerary
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs font-semibold text-primary hover:text-primary p-0 h-auto"
                  render={<Link href={`/portal/events/${event.id}`} />}
                >
                  <span>Event Details</span>
                  <ArrowRight className="size-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
