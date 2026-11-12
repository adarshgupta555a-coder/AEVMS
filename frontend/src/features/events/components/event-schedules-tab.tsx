"use client";

import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Plus,
  Clock,
  Pencil,
  Trash2,
  CalendarDays,
  ArrowRight,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  useEventSchedules,
  useCreateScheduleMutation,
  useUpdateScheduleMutation,
  useDeleteScheduleMutation,
} from "../hooks/use-events";
import type {
  EventScheduleItem,
  CreateEventScheduleInput,
  UpdateEventScheduleInput,
} from "../schemas/event.schema";

interface EventSchedulesTabProps {
  eventId: string;
}

export function EventSchedulesTab({ eventId }: EventSchedulesTabProps) {
  const { data: schedules = [], isLoading } = useEventSchedules(eventId);
  const createScheduleMutation = useCreateScheduleMutation(eventId);
  const updateScheduleMutation = useUpdateScheduleMutation(eventId);
  const deleteScheduleMutation = useDeleteScheduleMutation(eventId);

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingSchedule, setEditingSchedule] =
    React.useState<EventScheduleItem | null>(null);
  const [deletingScheduleId, setDeletingScheduleId] = React.useState<string | null>(
    null
  );

  const [formData, setFormData] = React.useState<{
    title: string;
    description: string;
    startAt: string;
    endAt: string;
  }>({
    title: "",
    description: "",
    startAt: "",
    endAt: "",
  });

  const openCreateDialog = () => {
    // Default to current time rounded to nearest hour or blank
    const now = new Date();
    const formatted = format(now, "yyyy-MM-dd'T'HH:mm");
    setFormData({
      title: "",
      description: "",
      startAt: formatted,
      endAt: "",
    });
    setIsCreateOpen(true);
  };

  const openEditDialog = (schedule: EventScheduleItem) => {
    setEditingSchedule(schedule);
    setFormData({
      title: schedule.title,
      description: schedule.description || "",
      startAt: schedule.startAt
        ? format(new Date(schedule.startAt), "yyyy-MM-dd'T'HH:mm")
        : "",
      endAt: schedule.endAt
        ? format(new Date(schedule.endAt), "yyyy-MM-dd'T'HH:mm")
        : "",
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Schedule title is required");
      return;
    }
    if (!formData.startAt) {
      toast.error("Start time is required");
      return;
    }
    if (formData.endAt && new Date(formData.endAt) < new Date(formData.startAt)) {
      toast.error("End time cannot be earlier than start time");
      return;
    }

    try {
      const payload: CreateEventScheduleInput = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        startAt: new Date(formData.startAt),
        endAt: formData.endAt ? new Date(formData.endAt) : undefined,
      };

      await createScheduleMutation.mutateAsync(payload);
      toast.success("Schedule entry added successfully");
      setIsCreateOpen(false);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create schedule"
      );
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;
    if (!formData.title.trim()) {
      toast.error("Schedule title is required");
      return;
    }
    if (formData.endAt && new Date(formData.endAt) < new Date(formData.startAt)) {
      toast.error("End time cannot be earlier than start time");
      return;
    }

    try {
      const payload: UpdateEventScheduleInput = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        startAt: formData.startAt ? new Date(formData.startAt) : undefined,
        endAt: formData.endAt ? new Date(formData.endAt) : null,
      };

      await updateScheduleMutation.mutateAsync({
        scheduleId: editingSchedule.id,
        data: payload,
      });
      toast.success("Schedule entry updated successfully");
      setEditingSchedule(null);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update schedule"
      );
    }
  };

  const handleDeleteSchedule = async () => {
    if (!deletingScheduleId) return;
    try {
      await deleteScheduleMutation.mutateAsync(deletingScheduleId);
      toast.success("Schedule entry deleted successfully");
      setDeletingScheduleId(null);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete schedule"
      );
    }
  };

  const sortedSchedules = React.useMemo(() => {
    return [...schedules].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
  }, [schedules]);

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Event Day Run-Sheet & Itinerary
          </h3>
          <p className="text-xs text-muted-foreground">
            Chronological itinerary schedule mapping guest arrival, ceremonies, dining, and stage execution.
          </p>
        </div>

        <Button size="sm" onClick={openCreateDialog} className="gap-1.5 h-8">
          <Plus className="size-3.5" />
          Add Schedule Block
        </Button>
      </div>

      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              Execution Timeline ({sortedSchedules.length} Items)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Loading event itinerary schedule...
            </div>
          ) : sortedSchedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-lg border-border/70">
              <div className="size-10 rounded-full bg-muted flex items-center justify-center mb-3 text-muted-foreground">
                <CalendarDays className="size-5" />
              </div>
              <p className="text-xs font-medium text-foreground">
                No schedule blocks defined yet
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Build the day timeline: guest reception, speeches, catering, cake cutting, or performances.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 text-xs h-7"
                onClick={openCreateDialog}
              >
                <Plus className="size-3.5 mr-1" /> Add Schedule Item
              </Button>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border/80">
              {sortedSchedules.map((item) => {
                const startDate = new Date(item.startAt);
                const endDate = item.endAt ? new Date(item.endAt) : null;

                return (
                  <div key={item.id} className="relative group">
                    {/* Timeline bullet indicator */}
                    <div className="absolute -left-[27px] top-1.5 size-3 rounded-full bg-background border-2 border-primary group-hover:scale-125 transition-transform" />

                    <div className="p-3.5 rounded-lg border border-border/70 bg-card hover:border-border transition-colors shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {item.title}
                          </span>
                          <Badge
                            variant="secondary"
                            className="font-mono text-[10px] px-2 py-0 gap-1 text-primary bg-primary/10 border-primary/20"
                          >
                            <Clock className="size-3" />
                            {format(startDate, "hh:mm a")}
                            {endDate && (
                              <>
                                <ArrowRight className="size-2.5" />
                                {format(endDate, "hh:mm a")}
                              </>
                            )}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {format(startDate, "dd MMM yyyy")}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => openEditDialog(item)}
                            className="size-7 text-muted-foreground hover:text-foreground"
                            title="Edit schedule block"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setDeletingScheduleId(item.id)}
                            className="size-7 text-muted-foreground hover:text-destructive"
                            title="Delete schedule block"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>

                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Schedule Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                Add Itinerary Schedule Block
              </DialogTitle>
              <DialogDescription className="text-xs">
                Enter event call times, milestone executions, or stage programming.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-4 text-xs">
              <div className="space-y-1">
                <Label htmlFor="sched-title" className="text-xs">
                  Schedule Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sched-title"
                  placeholder="e.g. Barat Welcome & Welcome Drink Service"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="sched-desc" className="text-xs">
                  Description / Run Instructions
                </Label>
                <Textarea
                  id="sched-desc"
                  placeholder="Logistical cues, MC instructions, DJ background music..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={2}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sched-start" className="text-xs">
                    Start Time <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sched-start"
                    type="datetime-local"
                    value={formData.startAt}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        startAt: e.target.value,
                      }))
                    }
                    required
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="sched-end" className="text-xs">
                    End Time (Optional)
                  </Label>
                  <Input
                    id="sched-end"
                    type="datetime-local"
                    value={formData.endAt}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        endAt: e.target.value,
                      }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createScheduleMutation.isPending}
                className="text-xs h-8"
              >
                {createScheduleMutation.isPending
                  ? "Adding..."
                  : "Add Schedule Block"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Schedule Dialog */}
      <Dialog
        open={Boolean(editingSchedule)}
        onOpenChange={(open) => !open && setEditingSchedule(null)}
      >
        <DialogContent className="max-w-md">
          <form onSubmit={handleUpdateSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                Edit Itinerary Schedule Block
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update schedule timing or instructions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-4 text-xs">
              <div className="space-y-1">
                <Label htmlFor="edit-sched-title" className="text-xs">
                  Schedule Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-sched-title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-sched-desc" className="text-xs">
                  Description / Run Instructions
                </Label>
                <Textarea
                  id="edit-sched-desc"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={2}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-sched-start" className="text-xs">
                    Start Time <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-sched-start"
                    type="datetime-local"
                    value={formData.startAt}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        startAt: e.target.value,
                      }))
                    }
                    required
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-sched-end" className="text-xs">
                    End Time (Optional)
                  </Label>
                  <Input
                    id="edit-sched-end"
                    type="datetime-local"
                    value={formData.endAt}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        endAt: e.target.value,
                      }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingSchedule(null)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateScheduleMutation.isPending}
                className="text-xs h-8"
              >
                {updateScheduleMutation.isPending
                  ? "Saving..."
                  : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingScheduleId)}
        onOpenChange={(open) => !open && setDeletingScheduleId(null)}
        title="Delete Itinerary Schedule Block"
        description="Are you sure you want to remove this schedule block from the event timeline?"
        confirmText="Delete Block"
        variant="destructive"
        onConfirm={handleDeleteSchedule}
        isLoading={deleteScheduleMutation.isPending}
      />
    </div>
  );
}
