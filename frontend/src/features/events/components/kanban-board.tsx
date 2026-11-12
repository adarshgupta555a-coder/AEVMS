"use client";

import * as React from "react";
import { toast } from "sonner";
import { KanbanColumn } from "./kanban-column";
import { type KanbanEventItem } from "./kanban-card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";
import {
  useEvents,
  useUpdateEventStatusMutation,
} from "../hooks/use-events";
import { formatDate, formatINR } from "@/lib/formatters";

const columnsConfig: Array<{
  status: KanbanEventItem["status"];
  title: string;
  colorClass: string;
}> = [
  { status: "DRAFT", title: "Draft", colorClass: "bg-slate-400" },
  { status: "CONFIRMED", title: "Confirmed", colorClass: "bg-indigo-500" },
  { status: "PLANNING", title: "In Planning", colorClass: "bg-amber-500" },
  { status: "IN_PROGRESS", title: "In Progress", colorClass: "bg-blue-500" },
  { status: "COMPLETED", title: "Completed", colorClass: "bg-emerald-500" },
  { status: "CANCELLED", title: "Cancelled", colorClass: "bg-rose-500" },
];

export function KanbanBoard() {
  const { data, isLoading } = useEvents({ limit: 100 });
  const updateStatusMutation = useUpdateEventStatusMutation();
  const [searchQuery, setSearchQuery] = React.useState("");

  const rawEvents = data?.events ?? [];
  const items: KanbanEventItem[] = rawEvents.map((evt) => ({
    id: evt.id,
    eventNumber: evt.eventNumber,
    title: evt.title,
    clientName: evt.client?.name || "Client",
    eventType: evt.eventType,
    eventDate: formatDate(evt.eventDate),
    venueName: evt.venueName || undefined,
    guestCount: evt.guestCount || undefined,
    budget:
      typeof evt.budget === "string"
        ? parseFloat(evt.budget)
        : evt.budget ?? undefined,
    status: evt.status as KanbanEventItem["status"],
  }));

  const handleStatusChange = async (
    id: string,
    newStatus: KanbanEventItem["status"]
  ) => {
    try {
      await updateStatusMutation.mutateAsync({
        id,
        data: { status: newStatus },
      });
      toast.success(`Event status updated to ${newStatus}`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update event status"
      );
    }
  };

  const handleDropItem = (
    id: string,
    targetStatus: KanbanEventItem["status"]
  ) => {
    handleStatusChange(id, targetStatus);
  };

  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.clientName.toLowerCase().includes(query) ||
        item.eventNumber.toLowerCase().includes(query) ||
        (item.venueName && item.venueName.toLowerCase().includes(query))
    );
  }, [items, searchQuery]);

  const totalBudget = React.useMemo(() => {
    return items.reduce((acc, curr) => acc + (curr.budget || 0), 0);
  }, [items]);

  return (
    <div className="space-y-4">
      {/* Search & Board Summary Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl border border-border/70 bg-card">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events, clients, venues..."
            className="pl-8 text-xs h-9 bg-background"
          />
        </div>

        <div className="flex items-center gap-3 text-xs">
          {isLoading && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Syncing live events...</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span>Total Projects:</span>
            <Badge variant="secondary" className="font-semibold">
              {items.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-foreground font-semibold">
            <span>Total Budget:</span>
            <span className="font-mono text-primary font-bold">
              {formatINR(totalBudget)}
            </span>
          </div>
        </div>
      </div>

      {/* Kanban Multi-Column Scrollable Canvas */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {columnsConfig.map((col) => {
          const colItems = filteredItems.filter(
            (item) => item.status === col.status
          );
          return (
            <KanbanColumn
              key={col.status}
              status={col.status}
              title={col.title}
              colorClass={col.colorClass}
              items={colItems}
              onStatusChange={handleStatusChange}
              onDropItem={handleDropItem}
            />
          );
        })}
      </div>
    </div>
  );
}
