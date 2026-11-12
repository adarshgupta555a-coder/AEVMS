"use client";

import * as React from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Loader2,
  CalendarCheck2,
  PhoneCall,
  Users,
  Compass,
  FileText,
  Activity,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { useClientActivities } from "../hooks/use-clients";
import { formatDateTime } from "@/lib/formatters";
import type { CalendarEntry } from "@/types/models";
import { ActivityDialog } from "@/features/calendar/components/activity-dialog";
import { ActivityDetailDialog } from "@/features/calendar/components/activity-detail-dialog";

export interface ClientActivityTimelineProps {
  clientId: string;
  onLogActivity?: () => void;
}

const activityTypeIcons: Record<string, React.ReactNode> = {
  CLIENT_MEETING: <Users className="size-4 text-blue-500" />,
  MEETING: <Users className="size-4 text-blue-500" />,
  SITE_VISIT: <Compass className="size-4 text-emerald-500" />,
  VENDOR_MEETING: <Users className="size-4 text-amber-500" />,
  REHEARSAL: <Activity className="size-4 text-purple-500" />,
  EVENT_DATE: <CalendarCheck2 className="size-4 text-indigo-500" />,
  FOLLOW_UP: <PhoneCall className="size-4 text-orange-500" />,
  OFFICE_ACTIVITY: <FileText className="size-4 text-zinc-500" />,
  OTHER: <Clock className="size-4 text-zinc-500" />,
};

const activityTypeLabels: Record<string, string> = {
  CLIENT_MEETING: "Client Meeting",
  MEETING: "Meeting",
  SITE_VISIT: "Site Visit",
  VENDOR_MEETING: "Vendor Meeting",
  REHEARSAL: "Rehearsal",
  EVENT_DATE: "Event Milestone",
  FOLLOW_UP: "Follow-up Call",
  OFFICE_ACTIVITY: "Office Activity",
  OTHER: "Activity",
};

export function ClientActivityTimeline({
  clientId,
  onLogActivity,
}: ClientActivityTimelineProps) {
  const [logDialogOpen, setLogDialogOpen] = React.useState(false);
  const [selectedEntry, setSelectedEntry] = React.useState<CalendarEntry | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<CalendarEntry | null>(null);

  const {
    data: activities = [],
    isLoading,
    refetch,
  } = useClientActivities(clientId);

  const handleOpenLog = () => {
    if (onLogActivity) {
      onLogActivity();
    } else {
      setEditingEntry(null);
      setLogDialogOpen(true);
    }
  };

  const handleEntryClick = (item: CalendarEntry) => {
    setSelectedEntry(item);
    setDetailDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">CRM Activity Timeline</h3>
          <p className="text-xs text-muted-foreground">
            Chronological audit of site visits, meetings, and client follow-ups.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={handleOpenLog}
        >
          <Plus className="size-3.5" />
          Log Activity
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-xs">
          <Loader2 className="size-4 animate-spin mr-2" />
          Loading activity timeline...
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed rounded-lg border-border/70 bg-muted/10">
          <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2.5">
            <Calendar className="size-4" />
          </div>
          <h4 className="text-xs font-semibold text-foreground">No Activities Recorded</h4>
          <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
            Log site visits, meetings, follow-ups or rehearsal checkpoints for this client.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 gap-1.5 text-xs"
            onClick={handleOpenLog}
          >
            <Plus className="size-3" />
            Log First Activity
          </Button>
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:bottom-2 before:top-2 before:left-[11px] before:w-0.5 before:bg-border/80">
          {activities.map((item: CalendarEntry) => {
            const icon =
              activityTypeIcons[item.type] || activityTypeIcons.OTHER;
            const label =
              activityTypeLabels[item.type] || item.type;

            return (
              <div
                key={item.id}
                className="relative group cursor-pointer"
                onClick={() => handleEntryClick(item)}
              >
                {/* Timeline node */}
                <div className="absolute -left-[30px] top-1 size-5 rounded-full bg-background border-2 border-primary/60 flex items-center justify-center shadow-xs group-hover:border-primary transition-colors">
                  <div className="size-1.5 rounded-full bg-primary" />
                </div>

                <div className="p-3.5 rounded-lg border border-border/70 bg-card hover:border-border hover:bg-muted/15 transition-all space-y-2 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-muted/50">{icon}</div>
                      <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                        {item.title}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {label}
                      </Badge>
                      {item.allDay && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">
                          All Day
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                      <Clock className="size-3 text-muted-foreground" />
                      <span>{formatDateTime(item.startAt)}</span>
                      {item.endAt && (
                        <span> - {formatDateTime(item.endAt, "hh:mm a")}</span>
                      )}
                    </div>
                  </div>

                  {item.location && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3 text-primary/70 shrink-0" />
                      <span>{item.location}</span>
                    </div>
                  )}

                  {item.description && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 p-2 rounded">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Internal Activity Dialog Fallback */}
      <ActivityDialog
        open={logDialogOpen}
        onOpenChange={setLogDialogOpen}
        initialData={editingEntry}
        defaultClientId={clientId}
        onSuccess={() => {
          refetch();
        }}
      />

      {/* Activity Detail Dialog */}
      <ActivityDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        entry={selectedEntry}
        onEdit={(entry) => {
          setEditingEntry(entry);
          setLogDialogOpen(true);
        }}
        onDeleted={() => {
          refetch();
        }}
      />
    </div>
  );
}
