"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarCheck,
  Receipt,
  Clock,
  MapPin,
  Pencil,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  useEvent,
  useUpdateEventStatusMutation,
  useDeleteEventMutation,
} from "@/features/events/hooks/use-events";
import { EventFinancialSummary } from "@/features/events/components/event-financial-summary";
import { EventTasksTab } from "@/features/events/components/event-tasks-tab";
import { EventSchedulesTab } from "@/features/events/components/event-schedules-tab";
import { EventEditDialog } from "@/features/events/components/event-edit-dialog";
import {
  ALLOWED_TRANSITIONS,
  type EventStatus,
} from "@/features/events/schemas/event.schema";
import { formatDate, formatDateTime, formatINR } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useSetBreadcrumbTitle } from "@/store/breadcrumb-store";

const STAGES: EventStatus[] = [
  "DRAFT",
  "CONFIRMED",
  "PLANNING",
  "IN_PROGRESS",
  "COMPLETED",
];

const statusBadgeConfig: Record<
  string,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Draft",
    className: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
  },
  CONFIRMED: {
    label: "Confirmed",
    className: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
  },
  PLANNING: {
    label: "Planning",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  },
};

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const router = useRouter();

  const { data: event, isLoading, isError, error, refetch } = useEvent(id);
  useSetBreadcrumbTitle(event?.title);
  const updateStatusMutation = useUpdateEventStatusMutation();
  const deleteMutation = useDeleteEventMutation();

  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <Skeleton className="h-14 w-full rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            render={<Link href="/events" />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Event Not Found
          </h1>
        </div>
        <Card className="border-destructive/30 bg-destructive/5 text-destructive">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm font-medium">
              {error?.message || "The requested event record could not be retrieved."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="text-xs"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStatus = event.status;
  const isCancelled = currentStatus === "CANCELLED";
  const allowedTransitions = ALLOWED_TRANSITIONS[currentStatus] || [];
  const currentStageIndex = STAGES.indexOf(currentStatus);

  const handleStatusChange = async (targetStatus: EventStatus) => {
    if (targetStatus === "CANCELLED") {
      setCancelDialogOpen(true);
      return;
    }

    try {
      await updateStatusMutation.mutateAsync({
        id: event.id,
        data: { status: targetStatus },
      });
      toast.success(`Event status changed to ${targetStatus}`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update event status"
      );
    }
  };

  const handleConfirmCancel = async (reason?: string) => {
    try {
      await updateStatusMutation.mutateAsync({
        id: event.id,
        data: {
          status: "CANCELLED",
          reason: reason || "Cancelled by administrator",
        },
      });
      toast.success("Event has been cancelled");
      setCancelDialogOpen(false);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to cancel event"
      );
    }
  };

  const handleDeleteEvent = async () => {
    try {
      await deleteMutation.mutateAsync(event.id);
      toast.success(`Event "${event.eventNumber}" deleted`);
      router.push("/events");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete event"
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              render={<Link href="/events" />}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {event.title}
            </h1>
            <Badge
              variant="outline"
              className={cn("text-xs font-semibold", statusBadgeConfig[currentStatus]?.className)}
            >
              {statusBadgeConfig[currentStatus]?.label || currentStatus}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1 ml-9">
            <span className="font-mono font-medium text-foreground">
              {event.eventNumber}
            </span>
            <span>•</span>
            <span>
              Client:{" "}
              <Link
                href={`/clients/${event.client.id}`}
                className="font-medium text-primary hover:underline"
              >
                {event.client.name}
              </Link>
            </span>
            <span>•</span>
            <span>Date: {formatDate(event.eventDate)}</span>
            {event.venueName && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  {event.venueName}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Edit Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditOpen(true)}
            className="text-xs h-8 gap-1.5"
          >
            <Pencil className="size-3.5" />
            Edit Event
          </Button>

          {/* Status Transitions Dropdown */}
          {allowedTransitions.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Transition Status"
                className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onChange={(e) => {
                  const val = e.target.value as EventStatus;
                  if (val) handleStatusChange(val);
                  e.target.value = "";
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  Transition Status...
                </option>
                {allowedTransitions.map((nextStatus) => (
                  <option key={nextStatus} value={nextStatus}>
                    Move to &rarr; {nextStatus}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cancel Event Button */}
          {!isCancelled && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setCancelDialogOpen(true)}
              className="text-xs h-8 gap-1.5"
            >
              <XCircle className="size-3.5" />
              Cancel Event
            </Button>
          )}

          {/* Issue Invoice shortcut */}
          <Button
            size="sm"
            className="text-xs h-8 gap-1.5"
            render={<Link href={`/invoices/new?eventId=${event.id}&clientId=${event.client.id}`} />}
          >
            <Receipt className="size-3.5" />
            Issue Invoice
          </Button>
        </div>
      </div>

      {/* Visual State Machine Stepper */}
      <Card className="border-border/70 shadow-xs">
        <CardContent className="p-4">
          {isCancelled ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400">
              <AlertTriangle className="size-5 shrink-0" />
              <div>
                <p className="text-xs font-semibold">
                  This event project has been CANCELLED
                </p>
                <p className="text-[11px] text-rose-600/90 dark:text-rose-400/90">
                  Operational tasks and day itinerary are locked in terminal state.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 overflow-x-auto py-1">
              {STAGES.map((stage, idx) => {
                const isPastStage =
                  currentStageIndex !== -1 && idx < currentStageIndex;
                const isCurrentStage = idx === currentStageIndex;
                const isFutureStage =
                  currentStageIndex !== -1 && idx > currentStageIndex;

                return (
                  <React.Fragment key={stage}>
                    <div
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all shrink-0",
                        isCurrentStage &&
                          "bg-primary text-primary-foreground font-semibold shadow-xs ring-2 ring-primary/30",
                        isPastStage &&
                          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
                        isFutureStage && "text-muted-foreground bg-muted/40"
                      )}
                    >
                      <div
                        className={cn(
                          "size-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                          isCurrentStage && "bg-primary-foreground text-primary",
                          isPastStage && "bg-emerald-500 text-white",
                          isFutureStage && "bg-muted text-muted-foreground border"
                        )}
                      >
                        {isPastStage ? (
                          <CheckCircle2 className="size-3" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <span>{statusBadgeConfig[stage]?.label || stage}</span>
                    </div>

                    {idx < STAGES.length - 1 && (
                      <div className="hidden sm:flex flex-1 items-center px-1">
                        <div
                          className={cn(
                            "h-0.5 w-full",
                            idx < currentStageIndex
                              ? "bg-emerald-500/40"
                              : "bg-border/80"
                          )}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Summary Banner */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Financial Ledger & Budget Position
          </h2>
        </div>
        <EventFinancialSummary eventId={event.id} />
      </div>

      {/* Main Operations Tabs */}
      <Tabs defaultValue="overview" className="w-full space-y-4">
        <TabsList className="bg-muted/70 p-1 flex flex-wrap gap-1">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <CalendarCheck className="size-3.5" />
            Overview & Specifications
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5 text-xs">
            <Clock className="size-3.5" />
            Tasks Checklist ({event.tasks?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="schedules" className="gap-1.5 text-xs">
            <MapPin className="size-3.5" />
            Day Itinerary Schedule ({event.schedules?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab Content */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border/70 shadow-xs md:col-span-2">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-semibold">
                  Event Project Specifications
                </CardTitle>
                <CardDescription className="text-xs">
                  Production parameters, venue logistics, and scheduled call times.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Event Type
                    </span>
                    <span className="font-semibold text-foreground text-sm">
                      {event.eventType}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Planned Budget
                    </span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {formatINR(event.budget)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Event Date
                    </span>
                    <span className="font-medium text-foreground">
                      {formatDate(event.eventDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Guest Capacity
                    </span>
                    <span className="font-medium text-foreground">
                      {event.guestCount ? `${event.guestCount} Pax` : "Unspecified"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Start Call Time
                    </span>
                    <span className="font-medium text-foreground">
                      {event.startTime
                        ? formatDateTime(event.startTime)
                        : "Not specified"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      End Call Time
                    </span>
                    <span className="font-medium text-foreground">
                      {event.endTime
                        ? formatDateTime(event.endTime)
                        : "Not specified"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Venue Name
                    </span>
                    <span className="font-medium text-foreground">
                      {event.venueName || "TBD / Unassigned"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Venue Address / City
                    </span>
                    <span className="font-medium text-foreground">
                      {event.venueAddress || "Not provided"}
                    </span>
                  </div>
                </div>

                {event.description && (
                  <div className="pt-2 border-t border-border/60">
                    <span className="text-muted-foreground block text-[11px] mb-1">
                      Event Description / Scope
                    </span>
                    <p className="text-xs text-foreground bg-muted/20 p-2.5 rounded-md border border-border/50">
                      {event.description}
                    </p>
                  </div>
                )}

                {event.notes && (
                  <div className="pt-2 border-t border-border/60">
                    <span className="text-muted-foreground block text-[11px] mb-1">
                      Internal Operations Notes
                    </span>
                    <p className="text-xs text-foreground bg-amber-500/5 p-2.5 rounded-md border border-amber-500/20 text-amber-900 dark:text-amber-200">
                      {event.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Specs & Link Cards */}
            <div className="space-y-4">
              <Card className="border-border/70 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/60">
                  <CardTitle className="text-xs font-semibold">
                    Linked Client Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3.5 space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-foreground">
                      {event.client.name}
                    </span>
                    <p className="text-muted-foreground text-[11px]">
                      {event.client.email || "No email on record"}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      {event.client.phone}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-7 mt-1"
                    render={<Link href={`/clients/${event.client.id}`} />}
                  >
                    View Full Client Hub
                  </Button>
                </CardContent>
              </Card>

              {event.quotation && (
                <Card className="border-border/70 shadow-xs">
                  <CardHeader className="pb-3 border-b border-border/60">
                    <CardTitle className="text-xs font-semibold">
                      Originating Quotation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium text-foreground">
                        {event.quotation.quotationNumber}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {event.quotation.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      {event.quotation.title}
                    </p>
                    <p className="font-mono font-bold text-foreground pt-1">
                      {formatINR(event.quotation.totalAmount)}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-7 mt-2"
                      render={<Link href={`/quotations/${event.quotation.id}`} />}
                    >
                      <FileSpreadsheet className="size-3 mr-1" />
                      View Quotation
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card className="border-border/70 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/60">
                  <CardTitle className="text-xs font-semibold">
                    Production Admin Metadata
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Created By:</span>
                    <span className="font-medium text-foreground">
                      {event.createdBy?.name || "System Admin"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Created On:</span>
                    <span className="text-foreground">
                      {formatDate(event.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Last Updated:</span>
                    <span className="text-foreground">
                      {formatDate(event.updatedAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Operational Tasks Tab */}
        <TabsContent value="tasks">
          <EventTasksTab eventId={event.id} />
        </TabsContent>

        {/* Day Itinerary Tab */}
        <TabsContent value="schedules">
          <EventSchedulesTab eventId={event.id} />
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <EventEditDialog
        event={event}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />

      {/* Cancel Reason Confirmation Modal */}
      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel Event Project"
        description="Are you sure you want to cancel this event? This will stop active operations and transition the event to CANCELLED state."
        confirmText="Confirm Cancellation"
        variant="destructive"
        requireReason
        reasonLabel="Cancellation Reason (Required)"
        reasonPlaceholder="e.g. Client requested postponement / venue unavailable..."
        onConfirm={handleConfirmCancel}
        isLoading={updateStatusMutation.isPending}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Event Project"
        description={`Are you sure you want to permanently delete event "${event.title}" (${event.eventNumber})? All associated tasks and itinerary schedules will be removed.`}
        confirmText="Delete Event"
        variant="destructive"
        onConfirm={handleDeleteEvent}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
