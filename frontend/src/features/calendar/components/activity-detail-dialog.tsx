"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Clock,
  MapPin,
  Building,
  User,
  Phone,
  Mail,
  Pencil,
  Trash2,
  ExternalLink,
  Users,
  Compass,
  FileText,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

import {
  CALENDAR_ENTRY_TYPE_LABELS,
  CALENDAR_ENTRY_TYPE_COLORS,
  type CalendarEntryType,
} from "../schemas/calendar.schema";
import { useDeleteCalendarEntry } from "../hooks/use-calendar";
import { formatDate, formatDateTime, formatIndianPhone } from "@/lib/formatters";
import type { CalendarEntry } from "@/types/models";

export interface ActivityDetailDialogProps {
  entry: CalendarEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (entry: CalendarEntry) => void;
  onDeleted?: () => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  MEETING: <Users className="size-4" />,
  SITE_VISIT: <Compass className="size-4" />,
  VENDOR_MEETING: <Users className="size-4" />,
  OFFICE_ACTIVITY: <FileText className="size-4" />,
  OTHER: <Clock className="size-4" />,
};

export function ActivityDetailDialog({
  entry,
  open,
  onOpenChange,
  onEdit,
  onDeleted,
}: ActivityDetailDialogProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const deleteMutation = useDeleteCalendarEntry();

  if (!entry) return null;

  const entryType = (entry.type as CalendarEntryType) || "OTHER";
  const typeLabel = CALENDAR_ENTRY_TYPE_LABELS[entryType] || entryType;
  const colorConfig = CALENDAR_ENTRY_TYPE_COLORS[entryType] || CALENDAR_ENTRY_TYPE_COLORS.OTHER;
  const icon = typeIcons[entryType] || <Clock className="size-4" />;

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({
        id: entry.id,
        clientId: entry.clientId,
      });
      toast.success(`Activity "${entry.title}" deleted successfully`);
      setDeleteConfirmOpen(false);
      onOpenChange(false);
      onDeleted?.();
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to delete calendar activity");
      } else {
        toast.error("Failed to delete calendar activity");
      }
    }
  };

  const formatScheduleTime = () => {
    if (entry.allDay) {
      return `All Day • ${formatDate(entry.startAt, "EEEE, dd MMMM yyyy")}`;
    }
    const startStr = formatDateTime(entry.startAt, "dd MMM yyyy, h:mm a");
    if (entry.endAt) {
      const endStr = formatDateTime(entry.endAt, "h:mm a");
      return `${startStr} – ${endStr}`;
    }
    return startStr;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="space-y-2 pb-1 border-b border-border/60">
            <div className="flex items-center justify-between gap-2">
              <Badge
                variant="outline"
                className={`gap-1.5 px-2.5 py-0.5 text-xs font-medium border ${colorConfig.border} ${colorConfig.bg} ${colorConfig.text}`}
              >
                {icon}
                {typeLabel}
              </Badge>
              {entry.allDay && (
                <Badge variant="secondary" className="text-[10px]">
                  All Day
                </Badge>
              )}
            </div>
            <DialogTitle className="text-lg font-bold text-foreground leading-snug">
              {entry.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Date & Time */}
            <div className="flex items-start gap-2.5 text-muted-foreground">
              <Clock className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground text-xs">
                  {formatScheduleTime()}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Scheduled time slot
                </p>
              </div>
            </div>

            {/* Location */}
            {entry.location && (
              <div className="flex items-start gap-2.5 text-muted-foreground">
                <MapPin className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">{entry.location}</p>
                  <p className="text-[11px] text-muted-foreground">Venue / Location</p>
                </div>
              </div>
            )}

            {/* Client Profile */}
            <div className="flex items-start gap-2.5 rounded-lg border border-border/70 bg-muted/20 p-2.5">
              <User className="size-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Client Details
                  </span>
                  {entry.clientId && (
                    <Link
                      href={`/clients/${entry.clientId}`}
                      className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                    >
                      View Profile
                      <ExternalLink className="size-3" />
                    </Link>
                  )}
                </div>
                <p className="font-semibold text-foreground text-xs mt-0.5">
                  {entry.client?.name || "Client"}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1">
                  {entry.client?.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="size-3" />
                      {formatIndianPhone(entry.client.phone)}
                    </span>
                  )}
                  {entry.client?.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="size-3" />
                      {entry.client.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Linked Event */}
            {entry.eventId && (
              <div className="flex items-start gap-2.5 rounded-lg border border-border/70 bg-muted/20 p-2.5">
                <Building className="size-4 text-purple-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Linked Event
                    </span>
                    <Link
                      href={`/events/${entry.eventId}`}
                      className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                    >
                      View Event
                      <ExternalLink className="size-3" />
                    </Link>
                  </div>
                  <p className="font-semibold text-foreground text-xs mt-0.5">
                    {entry.event?.eventNumber ? `[${entry.event.eventNumber}] ` : ""}
                    {entry.event?.title || "Linked Event"}
                  </p>
                  {entry.event?.eventDate && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Date: {formatDate(entry.event.eventDate)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Notes / Description */}
            {entry.description && (
              <div className="space-y-1 rounded-lg border border-border/60 bg-muted/10 p-2.5">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <FileText className="size-3.5" />
                  Notes & Discussion Points
                </span>
                <p className="text-foreground whitespace-pre-wrap leading-relaxed text-xs">
                  {entry.description}
                </p>
              </div>
            )}

            {/* Audit info */}
            <div className="pt-1 text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/40">
              <span>
                Created by{" "}
                <span className="font-medium text-foreground">
                  {entry.createdBy?.name || "Admin"}
                </span>
              </span>
              <span>{formatDate(entry.createdAt, "dd MMM yyyy, h:mm a")}</span>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5 w-full sm:w-auto"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="size-3.5" />
              Delete Activity
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              {onEdit && (
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit(entry);
                  }}
                >
                  <Pencil className="size-3.5" />
                  Edit Activity
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Destructive Confirm Dialog for Deletion */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Calendar Activity"
        description={`Are you sure you want to delete "${entry.title}"? This operational activity will be permanently removed.`}
        confirmText="Delete Activity"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
