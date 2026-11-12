"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  List,
  Kanban,
  CalendarDays,
  GanttChartSquare,
  MoreHorizontal,
  Eye,
  Pencil,
  XCircle,
  Trash2,
  MapPin,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DataTable,
  type DataTableColumnDef,
} from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatINR, formatDate } from "@/lib/formatters";
import {
  useEvents,
  useDeleteEventMutation,
  useUpdateEventStatusMutation,
} from "@/features/events/hooks/use-events";
import type { EventItem, EventDetail } from "@/features/events/schemas/event.schema";
import { EventEditDialog } from "@/features/events/components/event-edit-dialog";
import type { EventStatus } from "@/types/models";
import { cn } from "@/lib/utils";

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

type EventTableRow = EventItem & Record<string, unknown>;

export default function EventsPage() {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = React.useState<string>("ALL");

  const queryParams = React.useMemo(() => {
    return {
      limit: 100,
      ...(selectedStatus !== "ALL"
        ? { status: selectedStatus as EventStatus }
        : {}),
    };
  }, [selectedStatus]);

  const { data, isLoading, refetch } = useEvents(queryParams);
  const events = (data?.events ?? []) as EventTableRow[];

  const deleteMutation = useDeleteEventMutation();
  const updateStatusMutation = useUpdateEventStatusMutation();

  const [editingEvent, setEditingEvent] = React.useState<EventDetail | null>(
    null
  );
  const [cancellingEvent, setCancellingEvent] = React.useState<EventItem | null>(
    null
  );
  const [deletingEvent, setDeletingEvent] = React.useState<EventItem | null>(
    null
  );

  const handleDeleteEvent = async () => {
    if (!deletingEvent) return;
    try {
      await deleteMutation.mutateAsync(deletingEvent.id);
      toast.success(`Event "${deletingEvent.eventNumber}" deleted`);
      setDeletingEvent(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete event");
    }
  };

  const handleConfirmCancel = async (reason?: string) => {
    if (!cancellingEvent) return;
    try {
      await updateStatusMutation.mutateAsync({
        id: cancellingEvent.id,
        data: {
          status: "CANCELLED",
          reason: reason || "Cancelled by administrator",
        },
      });
      toast.success(`Event "${cancellingEvent.eventNumber}" cancelled`);
      setCancellingEvent(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel event");
    }
  };

  const columns: DataTableColumnDef<EventTableRow>[] = React.useMemo(
    () => [
      {
        accessorKey: "eventNumber",
        header: "Event Number",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-mono text-xs font-semibold text-primary">
              {row.original.eventNumber}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {row.original.eventType}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "title",
        header: "Project Title",
        cell: ({ row }) => {
          const evt = row.original;
          return (
            <div className="space-y-0.5 max-w-[260px]">
              <span className="text-xs font-medium text-foreground block truncate">
                {evt.title}
              </span>
              {evt.venueName && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                  <MapPin className="size-3 shrink-0" />
                  {evt.venueName}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "client",
        header: "Client Account",
        cell: ({ row }) => {
          const client = row.original.client;
          return (
            <div className="flex flex-col max-w-[180px]">
              <span className="text-xs font-medium text-foreground truncate">
                {client?.name || "-"}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {client?.phone}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "eventDate",
        header: "Event Date",
        cell: ({ row }) => (
          <span className="text-xs text-foreground font-medium">
            {formatDate(row.original.eventDate)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;
          const cfg = statusBadgeConfig[status] || statusBadgeConfig.DRAFT;
          return (
            <Badge
              variant="outline"
              className={cn("text-[11px] font-semibold px-2 py-0.5", cfg.className)}
            >
              {cfg.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "budget",
        header: "Planned Budget",
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-foreground">
            {formatINR(row.original.budget)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const event = row.original;
          return (
            <div
              className="flex justify-end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" className="size-7" />
                  }
                >
                  <MoreHorizontal className="size-3.5" />
                  <span className="sr-only">Open event actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 text-xs">
                  <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                    Event Options
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => router.push(`/events/${event.id}`)}
                    className="cursor-pointer gap-2"
                  >
                    <Eye className="size-3.5 text-muted-foreground" />
                    View Command Hub
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setEditingEvent(event as unknown as EventDetail)}
                    className="cursor-pointer gap-2"
                  >
                    <Pencil className="size-3.5 text-muted-foreground" />
                    Edit Event Specs
                  </DropdownMenuItem>

                  {event.status !== "CANCELLED" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setCancellingEvent(event)}
                        className="cursor-pointer gap-2 text-rose-600 focus:text-rose-600"
                      >
                        <XCircle className="size-3.5" />
                        Cancel Event...
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeletingEvent(event)}
                    className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                    Delete Event
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [router]
  );

  return (
    <div className="space-y-6">
      {/* Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Event Operations
            </h1>
            <Badge variant="outline" className="text-xs">
              {events.length} Projects
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor active event projects, venues, milestones, timeline schedules, and financial budgets.
          </p>
        </div>

        {/* View Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-1">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2.5 text-xs font-semibold shadow-xs"
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
              variant="ghost"
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
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

          <Button
            size="sm"
            className="gap-1.5 h-8 text-xs font-semibold"
            render={<Link href="/events/new" />}
          >
            <Plus className="size-4" />
            Create Event
          </Button>
        </div>
      </div>

      {/* Main Events DataTable */}
      <DataTable
        columns={columns}
        data={events}
        isLoading={isLoading}
        searchPlaceholder="Search events by title, number, or venue..."
        onRowClick={(row) => router.push(`/events/${row.id}`)}
        emptyTitle="No event projects found"
        emptyDescription="Create your first event project or adjust the filter parameters."
        extraActions={
          <div className="flex items-center gap-2">
            <select
              aria-label="Filter events by status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PLANNING">Planning</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        }
      />

      {/* Edit Dialog */}
      {editingEvent && (
        <EventEditDialog
          event={editingEvent}
          open={Boolean(editingEvent)}
          onOpenChange={(open) => !open && setEditingEvent(null)}
        />
      )}

      {/* Cancel Event Reason Prompt */}
      <ConfirmDialog
        open={Boolean(cancellingEvent)}
        onOpenChange={(open) => !open && setCancellingEvent(null)}
        title="Cancel Event Project"
        description={`Provide a cancellation reason to transition event "${cancellingEvent?.title}" (${cancellingEvent?.eventNumber}) to CANCELLED state.`}
        confirmText="Confirm Cancellation"
        variant="destructive"
        requireReason
        reasonLabel="Cancellation Reason (Required)"
        reasonPlaceholder="e.g. Client requested postponement / venue unavailable..."
        onConfirm={handleConfirmCancel}
        isLoading={updateStatusMutation.isPending}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deletingEvent)}
        onOpenChange={(open) => !open && setDeletingEvent(null)}
        title="Delete Event Project"
        description={`Are you sure you want to permanently delete "${deletingEvent?.title}" (${deletingEvent?.eventNumber})? All associated tasks and itinerary schedules will be deleted.`}
        confirmText="Delete Event"
        variant="destructive"
        onConfirm={handleDeleteEvent}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
