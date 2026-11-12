"use client";

import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";
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
import { useUpdateEventMutation } from "../hooks/use-events";
import type { EventDetail, UpdateEventInput } from "../schemas/event.schema";

interface EventEditDialogProps {
  event: EventDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventEditDialog({
  event,
  open,
  onOpenChange,
}: EventEditDialogProps) {
  const updateMutation = useUpdateEventMutation();

  const [formData, setFormData] = React.useState({
    title: "",
    eventType: "",
    description: "",
    eventDate: "",
    startTime: "",
    endTime: "",
    venueName: "",
    venueAddress: "",
    guestCount: "",
    budget: "",
    notes: "",
  });

  React.useEffect(() => {
    if (event && open) {
      setTimeout(() => {
        setFormData({
          title: event.title || "",
          eventType: event.eventType || "",
          description: event.description || "",
          eventDate: event.eventDate
            ? format(new Date(event.eventDate), "yyyy-MM-dd")
            : "",
          startTime: event.startTime
            ? format(new Date(event.startTime), "yyyy-MM-dd'T'HH:mm")
            : "",
          endTime: event.endTime
            ? format(new Date(event.endTime), "yyyy-MM-dd'T'HH:mm")
            : "",
          venueName: event.venueName || "",
          venueAddress: event.venueAddress || "",
          guestCount: event.guestCount ? String(event.guestCount) : "",
          budget: event.budget ? String(event.budget) : "",
          notes: event.notes || "",
        });
      }, 0);
    }
  }, [event, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Event title is required");
      return;
    }
    if (!formData.eventType.trim()) {
      toast.error("Event type is required");
      return;
    }
    if (!formData.eventDate) {
      toast.error("Event date is required");
      return;
    }
    if (
      formData.startTime &&
      formData.endTime &&
      new Date(formData.endTime) < new Date(formData.startTime)
    ) {
      toast.error("End time cannot be earlier than start time");
      return;
    }

    try {
      const payload: UpdateEventInput = {
        title: formData.title.trim(),
        eventType: formData.eventType.trim(),
        description: formData.description.trim() || null,
        eventDate: new Date(formData.eventDate),
        startTime: formData.startTime ? new Date(formData.startTime) : null,
        endTime: formData.endTime ? new Date(formData.endTime) : null,
        venueName: formData.venueName.trim() || null,
        venueAddress: formData.venueAddress.trim() || null,
        guestCount: formData.guestCount
          ? parseInt(formData.guestCount, 10)
          : null,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        notes: formData.notes.trim() || null,
      };

      await updateMutation.mutateAsync({
        id: event.id,
        data: payload,
      });

      toast.success("Event details updated successfully");
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update event details"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Edit Event Specifications
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update project details, venue schedule, guest capacity, and planned budget.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-title" className="text-xs">
                  Event Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-type" className="text-xs">
                  Event Type <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-type"
                  placeholder="e.g. Wedding, Corporate, Sangeet"
                  value={formData.eventType}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      eventType: e.target.value,
                    }))
                  }
                  required
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-desc" className="text-xs">
                Description
              </Label>
              <Textarea
                id="edit-desc"
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-eventDate" className="text-xs">
                  Event Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-eventDate"
                  type="date"
                  value={formData.eventDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      eventDate: e.target.value,
                    }))
                  }
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-start" className="text-xs">
                  Start Time
                </Label>
                <Input
                  id="edit-start"
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      startTime: e.target.value,
                    }))
                  }
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-end" className="text-xs">
                  End Time
                </Label>
                <Input
                  id="edit-end"
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      endTime: e.target.value,
                    }))
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-venue" className="text-xs">
                  Venue Name
                </Label>
                <Input
                  id="edit-venue"
                  placeholder="e.g. Taj West End Grand Ballroom"
                  value={formData.venueName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      venueName: e.target.value,
                    }))
                  }
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-venue-addr" className="text-xs">
                  Venue Address / City
                </Label>
                <Input
                  id="edit-venue-addr"
                  placeholder="e.g. Race Course Rd, Bengaluru"
                  value={formData.venueAddress}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      venueAddress: e.target.value,
                    }))
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-guests" className="text-xs">
                  Guest Count
                </Label>
                <Input
                  id="edit-guests"
                  type="number"
                  min={1}
                  placeholder="e.g. 500"
                  value={formData.guestCount}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      guestCount: e.target.value,
                    }))
                  }
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-budget" className="text-xs">
                  Planned Budget (₹ INR)
                </Label>
                <Input
                  id="edit-budget"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 1500000"
                  value={formData.budget}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      budget: e.target.value,
                    }))
                  }
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-notes" className="text-xs">
                Internal Production Notes
              </Label>
              <Textarea
                id="edit-notes"
                placeholder="Client VIP preferences, dietary restrictions, staging notes..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={updateMutation.isPending}
              className="text-xs h-8"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
