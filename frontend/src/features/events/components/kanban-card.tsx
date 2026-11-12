"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  MapPin,
  Users,
  MoreVertical,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  IndianRupee,
} from "lucide-react";

export interface KanbanEventItem {
  id: string;
  eventNumber: string;
  title: string;
  clientName: string;
  eventType: string;
  eventDate: string;
  startTime?: string;
  venueName?: string;
  guestCount?: number;
  budget?: number;
  status: "DRAFT" | "PLANNING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

interface KanbanCardProps {
  item: KanbanEventItem;
  onStatusChange?: (id: string, newStatus: KanbanEventItem["status"]) => void;
  onDragStart?: (e: React.DragEvent, id: string) => void;
}

const statusOrder: KanbanEventItem["status"][] = [
  "DRAFT",
  "PLANNING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
];

export function KanbanCard({
  item,
  onStatusChange,
  onDragStart,
}: KanbanCardProps) {
  const currentIndex = statusOrder.indexOf(item.status);
  const canAdvance = currentIndex >= 0 && currentIndex < statusOrder.length - 1;
  const canRegress = currentIndex > 0;

  return (
    <Card
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", item.id);
        onDragStart?.(e, item.id);
      }}
      className="border-border/80 shadow-xs hover:border-primary/50 transition-all cursor-grab active:cursor-grabbing group bg-card"
    >
      <CardHeader className="p-3 pb-2 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <Badge
            variant="outline"
            className="text-[10px] font-mono font-medium tracking-tight px-1.5 py-0 border-border/80"
          >
            {item.eventNumber}
          </Badge>
          <div className="flex items-center gap-1">
            {item.priority && (
              <Badge
                variant={
                  item.priority === "URGENT" || item.priority === "HIGH"
                    ? "destructive"
                    : "secondary"
                }
                className="text-[9px] uppercase px-1 py-0"
              >
                {item.priority}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-foreground opacity-70 group-hover:opacity-100"
                  >
                    <MoreVertical className="size-3.5" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-44 text-xs">
                <DropdownMenuItem
                  render={
                    <Link href={`/events/${item.id}`} className="flex items-center gap-2">
                      <ExternalLink className="size-3.5" />
                      <span>View Details</span>
                    </Link>
                  }
                />
                <DropdownMenuSeparator />
                {canAdvance && (
                  <DropdownMenuItem
                    onClick={() =>
                      onStatusChange?.(item.id, statusOrder[currentIndex + 1])
                    }
                    className="flex items-center gap-2"
                  >
                    <ChevronRight className="size-3.5" />
                    <span>Move to {statusOrder[currentIndex + 1]}</span>
                  </DropdownMenuItem>
                )}
                {canRegress && (
                  <DropdownMenuItem
                    onClick={() =>
                      onStatusChange?.(item.id, statusOrder[currentIndex - 1])
                    }
                    className="flex items-center gap-2"
                  >
                    <ChevronLeft className="size-3.5" />
                    <span>Back to {statusOrder[currentIndex - 1]}</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Link
          href={`/events/${item.id}`}
          className="text-xs font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 block leading-snug"
        >
          {item.title}
        </Link>
        <div className="text-[11px] text-muted-foreground font-medium truncate">
          Client: {item.clientName}
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0 pb-2 space-y-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Calendar className="size-3 text-primary shrink-0" />
          <span className="truncate">{item.eventDate}</span>
        </div>
        {item.venueName && (
          <div className="flex items-center gap-1.5">
            <MapPin className="size-3 text-primary shrink-0" />
            <span className="truncate">{item.venueName}</span>
          </div>
        )}
        {item.guestCount && (
          <div className="flex items-center gap-1.5">
            <Users className="size-3 text-primary shrink-0" />
            <span>{item.guestCount.toLocaleString()} Guests</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
        <div className="flex items-center text-foreground font-semibold">
          <IndianRupee className="size-3 text-muted-foreground" />
          <span>{(item.budget || 0).toLocaleString("en-IN")}</span>
        </div>
        <Badge variant="outline" className="text-[10px] text-muted-foreground">
          {item.eventType}
        </Badge>
      </CardFooter>
    </Card>
  );
}
