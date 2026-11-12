"use client";

import * as React from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Loader2,
  CalendarCheck,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  createCalendarEntrySchema,
  CALENDAR_ENTRY_TYPES,
  CALENDAR_ENTRY_TYPE_LABELS,
  type CalendarEntryType,
  type CreateCalendarEntryInput,
} from "../schemas/calendar.schema";
import {
  useCreateCalendarEntry,
  useUpdateCalendarEntry,
} from "../hooks/use-calendar";
import { useClients, useClientEvents } from "@/features/clients/hooks/use-clients";
import { ApiError } from "@/lib/api";
import type { CalendarEntry, Event } from "@/types/models";

export interface ActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: CalendarEntry | null;
  defaultClientId?: string;
  defaultDate?: Date;
  onSuccess?: (entry: CalendarEntry) => void;
}

function toDateTimeLocal(d?: string | Date | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toDateLocal(d?: string | Date | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function ActivityDialog({
  open,
  onOpenChange,
  initialData,
  defaultClientId,
  defaultDate,
  onSuccess,
}: ActivityDialogProps) {
  const isEditing = Boolean(initialData?.id);
  const createMutation = useCreateCalendarEntry();
  const updateMutation = useUpdateCalendarEntry();

  const { data: clientsData, isLoading: isLoadingClients } = useClients({
    limit: 100,
  });
  const clients = clientsData?.clients ?? [];

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateCalendarEntryInput>({
    resolver: zodResolver(createCalendarEntrySchema),
    defaultValues: {
      title: "",
      type: "MEETING",
      clientId: defaultClientId || "",
      eventId: "",
      allDay: false,
      startAt: defaultDate || new Date(),
      endAt: undefined,
      location: "",
      description: "",
    },
  });

  const selectedClientId = useWatch({ control, name: "clientId" });
  const isAllDay = useWatch({ control, name: "allDay" });

  // Fetch events belonging to the selected client
  const { data: clientEventsData } = useClientEvents(selectedClientId, {
    limit: 50,
  });
  const clientEvents = clientEventsData?.events ?? [];

  // Reset or populate form when dialog opens or initialData changes
  React.useEffect(() => {
    if (open) {
      if (initialData) {
        reset({
          title: initialData.title || "",
          type: (initialData.type as CalendarEntryType) || "MEETING",
          clientId: initialData.clientId || defaultClientId || "",
          eventId: initialData.eventId || "",
          allDay: initialData.allDay || false,
          startAt: new Date(initialData.startAt),
          endAt: initialData.endAt ? new Date(initialData.endAt) : undefined,
          location: initialData.location || "",
          description: initialData.description || "",
        });
      } else {
        const baseDate = defaultDate ? new Date(defaultDate) : new Date();
        reset({
          title: "",
          type: "MEETING",
          clientId: defaultClientId || "",
          eventId: "",
          allDay: false,
          startAt: baseDate,
          endAt: undefined,
          location: "",
          description: "",
        });
      }
    }
  }, [open, initialData, defaultClientId, defaultDate, reset]);

  const onSubmit = async (data: CreateCalendarEntryInput) => {
    try {
      let savedEntry: CalendarEntry;

      if (isEditing && initialData?.id) {
        savedEntry = await updateMutation.mutateAsync({
          id: initialData.id,
          data: {
            title: data.title.trim(),
            type: data.type,
            clientId: data.clientId,
            eventId: data.eventId && data.eventId !== "none" ? data.eventId : null,
            allDay: data.allDay,
            startAt: data.startAt,
            endAt: data.endAt || null,
            location: data.location?.trim() || null,
            description: data.description?.trim() || null,
          },
        });
        toast.success(`Activity "${savedEntry.title}" updated successfully`);
      } else {
        savedEntry = await createMutation.mutateAsync({
          title: data.title.trim(),
          type: data.type,
          clientId: data.clientId,
          eventId: data.eventId && data.eventId !== "none" ? data.eventId : null,
          allDay: data.allDay,
          startAt: data.startAt,
          endAt: data.endAt || undefined,
          location: data.location?.trim() || undefined,
          description: data.description?.trim() || undefined,
        });
        toast.success(`Activity "${savedEntry.title}" scheduled successfully`);
      }

      onOpenChange(false);
      onSuccess?.(savedEntry);
    } catch (err: unknown) {
      if (err instanceof ApiError && Array.isArray(err.details)) {
        err.details.forEach((item: { field: string; message: string }) => {
          if (item.field) {
            setError(item.field as keyof CreateCalendarEntryInput, {
              type: "server",
              message: item.message,
            });
          }
        });
        toast.error(err.message || "Please correct the form errors.");
      } else if (err instanceof Error) {
        toast.error(err.message || "Failed to save calendar activity");
      } else {
        toast.error("An unexpected error occurred while saving activity");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <CalendarCheck className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {isEditing ? "Edit Activity" : "Schedule New Activity"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {isEditing
                  ? "Update timeline, linked client, or event details."
                  : "Plan a site visit, client consultation, or operational milestone."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="title" className="text-xs font-medium">
              Activity Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g. Venue walk-through & lighting check"
              {...register("title")}
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Activity Type & All Day Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div className="space-y-1">
              <Label className="text-xs font-medium">
                Activity Type <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => {
                      if (val) field.onChange(val as CalendarEntryType);
                    }}
                  >
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CALENDAR_ENTRY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {CALENDAR_ENTRY_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type && (
                <p className="text-xs text-destructive">{errors.type.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-3 sm:pt-5">
              <Controller
                control={control}
                name="allDay"
                render={({ field }) => (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="allDay"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked)}
                    />
                    <Label
                      htmlFor="allDay"
                      className="text-xs font-medium cursor-pointer"
                    >
                      All Day Activity
                    </Label>
                  </div>
                )}
              />
            </div>
          </div>

          {/* Client & Linked Event */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Client Select */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">
                Client Profile <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="clientId"
                render={({ field }) => {
                  const selectedClient = clients.find((c) => c.id === field.value);
                  return (
                    <Select
                      value={field.value || ""}
                      onValueChange={(val) => {
                        field.onChange(val || "");
                        setValue("eventId", ""); // Reset linked event when client changes
                      }}
                    >
                      <SelectTrigger className="w-full text-xs">
                        <SelectValue
                          placeholder={
                            isLoadingClients
                              ? "Loading clients..."
                              : "Choose a client"
                          }
                        >
                          {selectedClient
                            ? `${selectedClient.name}${selectedClient.phone ? ` (${selectedClient.phone})` : ""}`
                            : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem
                            key={c.id}
                            value={c.id}
                            label={`${c.name}${c.phone ? ` (${c.phone})` : ""}`}
                          >
                            {c.name} ({c.phone})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                }}
              />
              {errors.clientId && (
                <p className="text-xs text-destructive">
                  {errors.clientId.message}
                </p>
              )}
            </div>

            {/* Event Select */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">
                Linked Event <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <Controller
                control={control}
                name="eventId"
                render={({ field }) => {
                  const selectedEvent = clientEvents.find(
                    (evt: Event) => evt.id === field.value
                  );
                  return (
                    <Select
                      value={field.value || "none"}
                      onValueChange={(val) => {
                        field.onChange(val === "none" ? "" : val);
                      }}
                      disabled={!selectedClientId}
                    >
                      <SelectTrigger className="w-full text-xs">
                        <SelectValue
                          placeholder={
                            !selectedClientId
                              ? "Select client first"
                              : clientEvents.length === 0
                              ? "No events for client"
                              : "Select event"
                          }
                        >
                          {field.value === "none" || !field.value
                            ? "(None - General Activity)"
                            : selectedEvent
                            ? `${selectedEvent.eventNumber ? `[${selectedEvent.eventNumber}] ` : ""}${selectedEvent.title}`
                            : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          value="none"
                          label="(None - General Activity)"
                        >
                          (None - General Activity)
                        </SelectItem>
                        {clientEvents.map((evt: Event) => (
                          <SelectItem
                            key={evt.id}
                            value={evt.id}
                            label={`${evt.eventNumber ? `[${evt.eventNumber}] ` : ""}${evt.title}`}
                          >
                            {evt.eventNumber ? `[${evt.eventNumber}] ` : ""}
                            {evt.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                }}
              />
              {errors.eventId && (
                <p className="text-xs text-destructive">
                  {errors.eventId.message}
                </p>
              )}
            </div>
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="startAt" className="text-xs font-medium">
                {isAllDay ? "Date" : "Start Date & Time"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="startAt"
                render={({ field }) => (
                  <Input
                    id="startAt"
                    type={isAllDay ? "date" : "datetime-local"}
                    value={
                      isAllDay
                        ? toDateLocal(field.value)
                        : toDateTimeLocal(field.value)
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      field.onChange(new Date(val));
                    }}
                    aria-invalid={Boolean(errors.startAt)}
                  />
                )}
              />
              {errors.startAt && (
                <p className="text-xs text-destructive">
                  {errors.startAt.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="endAt" className="text-xs font-medium">
                {isAllDay ? "End Date" : "End Date & Time"}{" "}
                <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <Controller
                control={control}
                name="endAt"
                render={({ field }) => (
                  <Input
                    id="endAt"
                    type={isAllDay ? "date" : "datetime-local"}
                    value={
                      isAllDay
                        ? toDateLocal(field.value)
                        : toDateTimeLocal(field.value)
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      field.onChange(val ? new Date(val) : undefined);
                    }}
                    aria-invalid={Boolean(errors.endAt)}
                  />
                )}
              />
              {errors.endAt && (
                <p className="text-xs text-destructive">
                  {errors.endAt.message}
                </p>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1">
            <Label htmlFor="location" className="text-xs font-medium">
              Location / Venue <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="location"
              placeholder="e.g. Grand Ballroom, The Taj Palace, Mumbai / Google Meet"
              {...register("location")}
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="description" className="text-xs font-medium">
              Notes & Agenda <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Key discussion points, preparation checklist, or decisions..."
              rows={3}
              {...register("description")}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                "Update Activity"
              ) : (
                "Schedule Activity"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
