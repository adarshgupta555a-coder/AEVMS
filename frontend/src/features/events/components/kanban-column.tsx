"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { KanbanCard, type KanbanEventItem } from "./kanban-card";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  status: KanbanEventItem["status"];
  title: string;
  colorClass: string;
  items: KanbanEventItem[];
  onStatusChange: (id: string, newStatus: KanbanEventItem["status"]) => void;
  onDropItem: (id: string, targetStatus: KanbanEventItem["status"]) => void;
}

export function KanbanColumn({
  status,
  title,
  colorClass,
  items,
  onStatusChange,
  onDropItem,
}: KanbanColumnProps) {
  const [isOver, setIsOver] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    const id = e.dataTransfer.getData("text/plain");
    if (id) {
      onDropItem(id, status);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col rounded-xl border border-border/80 bg-muted/30 p-3 min-w-[280px] max-w-[320px] w-full flex-shrink-0 transition-colors",
        isOver && "border-primary/70 bg-primary/5 ring-1 ring-primary/30"
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", colorClass)} />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            {title}
          </h3>
        </div>
        <Badge
          variant="secondary"
          className="text-[10px] font-semibold size-5 flex items-center justify-center p-0 rounded-full"
        >
          {items.length}
        </Badge>
      </div>

      {/* Card Items Container */}
      <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[calc(100vh-260px)] scrollbar-thin pr-0.5">
        {items.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center border border-dashed rounded-lg border-border/60 text-center p-4">
            <span className="text-xs text-muted-foreground">No events</span>
            <span className="text-[10px] text-muted-foreground/60 mt-0.5">
              Drag events here
            </span>
          </div>
        ) : (
          items.map((item) => (
            <KanbanCard
              key={item.id}
              item={item}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    </div>
  );
}
