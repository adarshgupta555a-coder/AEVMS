"use client";

import * as React from "react";
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isSameDay,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Search,
  MapPin,
  Users,
  Compass,
  FileText,
  Building,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { useCalendarEntries } from "../hooks/use-calendar";
import { ActivityDialog } from "./activity-dialog";
import { ActivityDetailDialog } from "./activity-detail-dialog";
import {
  CALENDAR_ENTRY_TYPES,
  CALENDAR_ENTRY_TYPE_LABELS,
  CALENDAR_ENTRY_TYPE_COLORS,
  type CalendarEntryType,
} from "../schemas/calendar.schema";
import { formatDateTime } from "@/lib/formatters";
import type { CalendarEntry } from "@/types/models";

const typeIcons: Record<string, React.ReactNode> = {
  MEETING: <Users className="size-3" />,
  SITE_VISIT: <Compass className="size-3" />,
  VENDOR_MEETING: <Users className="size-3" />,
  OFFICE_ACTIVITY: <FileText className="size-3" />,
  OTHER: <Clock className="size-3" />,
};

export function MasterCalendar() {
  const [currentDate, setCurrentDate] = React.useState<Date>(new Date());
  const [viewMode, setViewMode] = React.useState<"month" | "week" | "day">("month");
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Dialog states
  const [activityDialogOpen, setActivityDialogOpen] = React.useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [selectedEntry, setSelectedEntry] = React.useState<CalendarEntry | null>(null);
  const [editingEntry, setEditingEntry] = React.useState<CalendarEntry | null>(null);
  const [defaultNewDate, setDefaultNewDate] = React.useState<Date | undefined>(undefined);

  // Fetch entries from backend
  const { data, isLoading, isError, error, refetch, isFetching } = useCalendarEntries({
    limit: 100,
    type: typeFilter !== "ALL" ? (typeFilter as CalendarEntryType) : undefined,
    search: searchQuery.trim() || undefined,
  });

  const entries: CalendarEntry[] = React.useMemo(
    () => data?.entries ?? [],
    [data?.entries]
  );

  // Filter entries that match a specific day
  const getEntriesForDay = (day: Date) => {
    return entries.filter((entry) => {
      const start = new Date(entry.startAt);
      if (!entry.endAt) {
        return isSameDay(start, day);
      }
      const end = new Date(entry.endAt);
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
      const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
      return start <= dayEnd && end >= dayStart;
    });
  };

  // Navigation handlers
  const handlePrevious = () => {
    if (viewMode === "month") {
      setCurrentDate((prev) => subMonths(prev, 1));
    } else if (viewMode === "week") {
      setCurrentDate((prev) => subWeeks(prev, 1));
    } else {
      setCurrentDate((prev) => subDays(prev, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setCurrentDate((prev) => addMonths(prev, 1));
    } else if (viewMode === "week") {
      setCurrentDate((prev) => addWeeks(prev, 1));
    } else {
      setCurrentDate((prev) => addDays(prev, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const openNewActivity = (date?: Date) => {
    setEditingEntry(null);
    setDefaultNewDate(date || new Date());
    setActivityDialogOpen(true);
  };

  const openDetail = (entry: CalendarEntry) => {
    setSelectedEntry(entry);
    setDetailDialogOpen(true);
  };

  const openEdit = (entry: CalendarEntry) => {
    setDetailDialogOpen(false);
    setEditingEntry(entry);
    setActivityDialogOpen(true);
  };

  // Header Title formatter based on view mode
  const renderPeriodTitle = () => {
    if (viewMode === "month") {
      return format(currentDate, "MMMM yyyy");
    } else if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(weekStart, "dd MMM")} – ${format(weekEnd, "dd MMM yyyy")}`;
    } else {
      return format(currentDate, "EEEE, dd MMMM yyyy");
    }
  };

  // Summary counts for current loaded entries
  const countsByType = React.useMemo(() => {
    const counts: Record<string, number> = {
      TOTAL: entries.length,
      MEETING: 0,
      SITE_VISIT: 0,
      VENDOR_MEETING: 0,
      OFFICE_ACTIVITY: 0,
      OTHER: 0,
    };
    entries.forEach((e) => {
      const t = e.type || "OTHER";
      if (counts[t] !== undefined) {
        counts[t]++;
      } else {
        counts.OTHER++;
      }
    });
    return counts;
  }, [entries]);

  return (
    <div className="space-y-4">
      {/* Top Banner / Metrics Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <button
          type="button"
          onClick={() => setTypeFilter("ALL")}
          className={cn(
            "text-left p-2.5 rounded-lg border transition-all",
            typeFilter === "ALL"
              ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-xs"
              : "border-border/70 bg-card hover:bg-muted/40"
          )}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>All Activities</span>
            <CalendarIcon className="size-3.5 text-primary" />
          </div>
          <p className="text-xl font-bold text-foreground mt-1">
            {countsByType.TOTAL}
          </p>
        </button>

        {CALENDAR_ENTRY_TYPES.map((type) => {
          const color = CALENDAR_ENTRY_TYPE_COLORS[type];
          const isSelected = typeFilter === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(isSelected ? "ALL" : type)}
              className={cn(
                "text-left p-2.5 rounded-lg border transition-all",
                isSelected
                  ? `border-primary ring-1 ring-primary/20 ${color.bg} shadow-xs`
                  : "border-border/70 bg-card hover:bg-muted/40"
              )}
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{CALENDAR_ENTRY_TYPE_LABELS[type]}</span>
                <span className={cn("size-2 rounded-full", color.dotColor)} />
              </div>
              <p className="text-xl font-bold text-foreground mt-1">
                {countsByType[type] || 0}
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Calendar Card */}
      <Card className="border-border/70 shadow-xs overflow-hidden">
        {/* Navigation & Controls Toolbar */}
        <div className="p-4 border-b border-border/60 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Date Navigation */}
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={handlePrevious}
                  aria-label="Previous period"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 text-xs font-medium"
                  onClick={handleToday}
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={handleNext}
                  aria-label="Next period"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                {renderPeriodTitle()}
              </h2>

              {isFetching && (
                <RefreshCw className="size-3.5 animate-spin text-muted-foreground ml-1" />
              )}
            </div>

            {/* View Mode & New Activity Button */}
            <div className="flex flex-wrap items-center gap-2">
              {/* View Switcher */}
              <div className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("month")}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium transition-colors",
                    viewMode === "month"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("week")}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium transition-colors",
                    viewMode === "week"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Week
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("day")}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-medium transition-colors",
                    viewMode === "day"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Day
                </button>
              </div>

              {/* Action Button */}
              <Button
                size="sm"
                className="gap-1.5 h-8 text-xs font-semibold"
                onClick={() => openNewActivity()}
              >
                <Plus className="size-3.5" />
                New Activity
              </Button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search activities, clients, venues..."
                className="pl-8 h-8 text-xs bg-muted/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="w-full sm:w-48">
              <Select
                value={typeFilter}
                onValueChange={(val) => setTypeFilter(val || "ALL")}
              >
                <SelectTrigger className="h-8 text-xs w-full bg-muted/20">
                  <SelectValue placeholder="All Activity Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" label="All Activity Types">
                    All Activity Types
                  </SelectItem>
                  {CALENDAR_ENTRY_TYPES.map((type) => (
                    <SelectItem
                      key={type}
                      value={type}
                      label={CALENDAR_ENTRY_TYPE_LABELS[type]}
                    >
                      {CALENDAR_ENTRY_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(searchQuery || typeFilter !== "ALL") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearchQuery("");
                  setTypeFilter("ALL");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Calendar Body */}
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center space-y-3">
              <div className="size-8 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-xs text-muted-foreground">
                Loading operational calendar schedule...
              </p>
            </div>
          ) : isError ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-xs text-destructive font-medium">
                {error instanceof Error ? error.message : "Failed to load calendar"}
              </p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : viewMode === "month" ? (
            <MonthGrid
              currentDate={currentDate}
              getEntriesForDay={getEntriesForDay}
              onDayClick={(day) => openNewActivity(day)}
              onEntryClick={openDetail}
            />
          ) : viewMode === "week" ? (
            <WeekView
              currentDate={currentDate}
              getEntriesForDay={getEntriesForDay}
              onDayClick={(day) => openNewActivity(day)}
              onEntryClick={openDetail}
            />
          ) : (
            <DayView
              currentDate={currentDate}
              entries={getEntriesForDay(currentDate)}
              onNewActivity={() => openNewActivity(currentDate)}
              onEntryClick={openDetail}
            />
          )}
        </CardContent>
      </Card>

      {/* Activity Creation / Edit Dialog */}
      <ActivityDialog
        open={activityDialogOpen}
        onOpenChange={setActivityDialogOpen}
        initialData={editingEntry}
        defaultDate={defaultNewDate}
        onSuccess={() => {
          refetch();
        }}
      />

      {/* Activity Details Dialog */}
      <ActivityDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        entry={selectedEntry}
        onEdit={(entry) => openEdit(entry)}
        onDeleted={() => {
          refetch();
        }}
      />
    </div>
  );
}

/**
 * ==========================================
 * Month Grid Component
 * ==========================================
 */
interface MonthGridProps {
  currentDate: Date;
  getEntriesForDay: (day: Date) => CalendarEntry[];
  onDayClick: (day: Date) => void;
  onEntryClick: (entry: CalendarEntry) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function MonthGrid({
  currentDate,
  getEntriesForDay,
  onDayClick,
  onEntryClick,
}: MonthGridProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Pad to start of week (Sunday) and end of week (Saturday)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div className="w-full">
      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30 text-center text-[11px] font-semibold text-muted-foreground uppercase py-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-0.5">
            {day}
          </div>
        ))}
      </div>

      {/* Month Days Grid */}
      <div className="grid grid-cols-7 auto-rows-[minmax(110px,1fr)] divide-x divide-y divide-border/60">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);
          const dayEntries = getEntriesForDay(day);
          const maxVisible = 3;
          const overflowCount = dayEntries.length - maxVisible;

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "group relative p-1.5 flex flex-col justify-between transition-colors min-h-[110px]",
                isCurrentMonth ? "bg-card" : "bg-muted/15 text-muted-foreground/60",
                isCurrentDay && "bg-primary/5"
              )}
            >
              {/* Day Cell Header */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "text-xs font-semibold size-6 flex items-center justify-center rounded-full transition-colors",
                    isCurrentDay
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : isCurrentMonth
                      ? "text-foreground"
                      : "text-muted-foreground/60"
                  )}
                >
                  {format(day, "d")}
                </span>

                {/* Quick Add Button on Hover */}
                <button
                  type="button"
                  onClick={() => onDayClick(day)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity size-5 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center"
                  title={`Add activity on ${format(day, "dd MMM")}`}
                >
                  <Plus className="size-3" />
                </button>
              </div>

              {/* Day's Activities List */}
              <div className="space-y-1 flex-1 overflow-hidden">
                {dayEntries.slice(0, maxVisible).map((entry) => {
                  const color =
                    CALENDAR_ENTRY_TYPE_COLORS[entry.type as CalendarEntryType] ||
                    CALENDAR_ENTRY_TYPE_COLORS.OTHER;
                  const icon = typeIcons[entry.type] || <Clock className="size-2.5" />;

                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEntryClick(entry);
                      }}
                      className={cn(
                        "w-full text-left rounded px-1.5 py-0.5 text-[11px] font-medium border truncate flex items-center gap-1 transition-transform hover:scale-[1.01]",
                        color.bg,
                        color.text,
                        color.border
                      )}
                      title={`${entry.title} (${entry.client?.name || ""})`}
                    >
                      <span className="shrink-0">{icon}</span>
                      <span className="truncate flex-1">{entry.title}</span>
                      {!entry.allDay && (
                        <span className="shrink-0 text-[10px] opacity-75 font-mono">
                          {format(new Date(entry.startAt), "h:mm a")}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Overflow popover */}
                {overflowCount > 0 && (
                  <Popover>
                    <PopoverTrigger
                      className="w-full text-left text-[10px] font-semibold text-primary hover:underline px-1 py-0.5 cursor-pointer block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      +{overflowCount} more...
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2 text-xs space-y-1.5" align="start">
                      <p className="font-semibold text-foreground text-xs pb-1 border-b border-border/60">
                        {format(day, "EEEE, dd MMMM")} ({dayEntries.length} activities)
                      </p>
                      <div className="max-h-48 overflow-y-auto space-y-1 pt-1">
                        {dayEntries.map((entry) => {
                          const color =
                            CALENDAR_ENTRY_TYPE_COLORS[entry.type as CalendarEntryType] ||
                            CALENDAR_ENTRY_TYPE_COLORS.OTHER;
                          return (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => onEntryClick(entry)}
                              className={cn(
                                "w-full text-left rounded p-1 text-[11px] font-medium border block",
                                color.bg,
                                color.text,
                                color.border
                              )}
                            >
                              <div className="font-semibold truncate">{entry.title}</div>
                              <div className="text-[10px] opacity-75 flex items-center justify-between mt-0.5">
                                <span>{entry.client?.name || "Client"}</span>
                                <span>
                                  {entry.allDay
                                    ? "All Day"
                                    : format(new Date(entry.startAt), "h:mm a")}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ==========================================
 * Week View Component
 * ==========================================
 */
interface WeekViewProps {
  currentDate: Date;
  getEntriesForDay: (day: Date) => CalendarEntry[];
  onDayClick: (day: Date) => void;
  onEntryClick: (entry: CalendarEntry) => void;
}

function WeekView({
  currentDate,
  getEntriesForDay,
  onDayClick,
  onEntryClick,
}: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="w-full">
      {/* 7 Columns for the 7 Days of Week */}
      <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-border/60 min-h-[500px]">
        {days.map((day) => {
          const isCurrentDay = isToday(day);
          const dayEntries = getEntriesForDay(day);

          return (
            <div key={day.toISOString()} className="flex flex-col bg-card">
              {/* Day Header */}
              <div
                className={cn(
                  "p-2.5 text-center border-b border-border/60 transition-colors",
                  isCurrentDay ? "bg-primary/10" : "bg-muted/20"
                )}
              >
                <p className="text-[11px] font-medium text-muted-foreground uppercase">
                  {format(day, "EEE")}
                </p>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <span
                    className={cn(
                      "text-base font-bold size-7 flex items-center justify-center rounded-full",
                      isCurrentDay
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onDayClick(day)}
                  className="mt-1 text-[10px] text-muted-foreground hover:text-primary flex items-center justify-center gap-0.5 mx-auto"
                >
                  <Plus className="size-2.5" />
                  Add
                </button>
              </div>

              {/* Day Entries */}
              <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                {dayEntries.length === 0 ? (
                  <div className="h-28 flex items-center justify-center text-[11px] text-muted-foreground/60 italic">
                    No activities
                  </div>
                ) : (
                  dayEntries.map((entry) => {
                    const color =
                      CALENDAR_ENTRY_TYPE_COLORS[entry.type as CalendarEntryType] ||
                      CALENDAR_ENTRY_TYPE_COLORS.OTHER;
                    const icon = typeIcons[entry.type] || <Clock className="size-3" />;

                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => onEntryClick(entry)}
                        className={cn(
                          "w-full text-left rounded-lg p-2 text-xs border transition-transform hover:scale-[1.01] block shadow-xs",
                          color.bg,
                          color.text,
                          color.border
                        )}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider">
                            {icon}
                            {entry.type}
                          </span>
                          <span className="text-[10px] font-mono">
                            {entry.allDay
                              ? "All Day"
                              : format(new Date(entry.startAt), "h:mm a")}
                          </span>
                        </div>
                        <p className="font-semibold text-foreground text-xs leading-tight line-clamp-2">
                          {entry.title}
                        </p>
                        {entry.client && (
                          <p className="text-[11px] opacity-80 mt-1 flex items-center gap-1 truncate">
                            <Users className="size-3 shrink-0" />
                            {entry.client.name}
                          </p>
                        )}
                        {entry.location && (
                          <p className="text-[10px] opacity-75 mt-0.5 flex items-center gap-1 truncate">
                            <MapPin className="size-2.5 shrink-0" />
                            {entry.location}
                          </p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ==========================================
 * Day View Component
 * ==========================================
 */
interface DayViewProps {
  currentDate: Date;
  entries: CalendarEntry[];
  onNewActivity: () => void;
  onEntryClick: (entry: CalendarEntry) => void;
}

function DayView({
  currentDate,
  entries,
  onNewActivity,
  onEntryClick,
}: DayViewProps) {
  const isCurrentDay = isToday(currentDate);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-foreground">
              {format(currentDate, "EEEE, dd MMMM yyyy")}
            </h3>
            {isCurrentDay && (
              <Badge variant="secondary" className="text-xs">
                Today
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {entries.length === 0
              ? "No operational activities scheduled for this date."
              : `${entries.length} operational activity scheduled.`}
          </p>
        </div>

        <Button size="sm" onClick={onNewActivity} className="gap-1.5 self-start">
          <Plus className="size-3.5" />
          Schedule Activity
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-lg border-border/70 bg-muted/10">
          <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
            <CalendarIcon className="size-5" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">
            Clear Schedule
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            No meetings, site visits, or milestone deadlines are planned for this date.
          </p>
          <Button size="sm" onClick={onNewActivity} className="mt-4 gap-1.5">
            <Plus className="size-3.5" />
            Schedule an Activity
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const color =
              CALENDAR_ENTRY_TYPE_COLORS[entry.type as CalendarEntryType] ||
              CALENDAR_ENTRY_TYPE_COLORS.OTHER;
            const icon = typeIcons[entry.type] || <Clock className="size-4" />;

            return (
              <div
                key={entry.id}
                onClick={() => onEntryClick(entry)}
                className="group p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/20 transition-all cursor-pointer shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 px-2 py-0.5 text-xs font-semibold border",
                        color.bg,
                        color.text,
                        color.border
                      )}
                    >
                      {icon}
                      {CALENDAR_ENTRY_TYPE_LABELS[entry.type as CalendarEntryType] ||
                        entry.type}
                    </Badge>
                    {entry.allDay ? (
                      <Badge variant="secondary" className="text-[10px]">
                        All Day
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                        <Clock className="size-3" />
                        {formatDateTime(entry.startAt, "h:mm a")}
                        {entry.endAt && ` – ${formatDateTime(entry.endAt, "h:mm a")}`}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {entry.title}
                  </h4>

                  {entry.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {entry.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                    {entry.client && (
                      <span className="flex items-center gap-1">
                        <Users className="size-3.5 text-primary" />
                        {entry.client.name}
                      </span>
                    )}
                    {entry.event && (
                      <span className="flex items-center gap-1">
                        <Building className="size-3.5 text-purple-500" />
                        {entry.event.title}
                      </span>
                    )}
                    {entry.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5 text-emerald-500" />
                        {entry.location}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEntryClick(entry);
                    }}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
