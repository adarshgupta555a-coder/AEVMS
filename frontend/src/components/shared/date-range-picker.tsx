"use client";

import * as React from "react";
import {
  startOfToday,
  endOfToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  format,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
  disabled?: boolean;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  className,
  align = "start",
  disabled = false,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const presets = React.useMemo(() => {
    const today = new Date();
    return [
      {
        label: "Today",
        getRange: () => ({
          from: startOfToday(),
          to: endOfToday(),
        }),
      },
      {
        label: "This Week",
        getRange: () => ({
          from: startOfWeek(today, { weekStartsOn: 1 }),
          to: endOfWeek(today, { weekStartsOn: 1 }),
        }),
      },
      {
        label: "This Month",
        getRange: () => ({
          from: startOfMonth(today),
          to: endOfMonth(today),
        }),
      },
      {
        label: "Last 30 Days",
        getRange: () => ({
          from: subDays(today, 29),
          to: endOfToday(),
        }),
      },
    ];
  }, []);

  const handleApplyPreset = (getRange: () => DateRange) => {
    const range = getRange();
    onChange?.(range);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(undefined);
  };

  const formattedDisplay = React.useMemo(() => {
    if (!value?.from) return null;
    if (value.to) {
      if (format(value.from, "yyyy-MM-dd") === format(value.to, "yyyy-MM-dd")) {
        return format(value.from, "dd MMM yyyy");
      }
      return `${format(value.from, "dd MMM yyyy")} – ${format(value.to, "dd MMM yyyy")}`;
    }
    return `${format(value.from, "dd MMM yyyy")} – ...`;
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn(
              "h-8 justify-start text-left text-xs font-normal",
              !value?.from && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon className="mr-2 size-3.5 shrink-0 opacity-70" />
        <span className="truncate">
          {formattedDisplay || placeholder}
        </span>
        {value?.from && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            className="ml-auto pl-1 hover:text-foreground text-muted-foreground/70"
            title="Clear date range"
          >
            <X className="size-3" />
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align={align}
        className="w-auto p-0 flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border"
      >
        {/* Quick Presets Bar */}
        <div className="flex flex-row sm:flex-col gap-1 p-2 bg-muted/20 min-w-[130px] overflow-x-auto sm:overflow-visible">
          <div className="hidden sm:block px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Presets
          </div>
          {presets.map((preset) => (
            <Button
              key={preset.label}
              variant="ghost"
              size="xs"
              onClick={() => handleApplyPreset(preset.getRange)}
              className="justify-start text-xs font-medium h-7 px-2"
            >
              {preset.label}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onChange?.(undefined)}
            className="justify-start text-xs font-medium h-7 px-2 text-muted-foreground hover:text-destructive"
          >
            Reset
          </Button>
        </div>

        {/* Calendar Range Component */}
        <div className="p-2">
          <Calendar
            mode="range"
            selected={value}
            onSelect={onChange}
            numberOfMonths={1}
            defaultMonth={value?.from || new Date()}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
