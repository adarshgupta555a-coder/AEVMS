"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

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

import {
  convertToEventSchema,
  type ConvertToEventInput,
  type QuotationWithRelations,
} from "../schemas/quotation.schema";
import { useConvertToEventMutation } from "../hooks/use-quotations";
import { formatINR } from "@/lib/formatters";

export interface ConvertToEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: QuotationWithRelations | null;
  onSuccess?: (eventId: string) => void;
}

interface FormValues {
  title: string;
  eventType: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  venueName: string;
  venueAddress: string;
  guestCount: string | number;
  budget: string | number;
  notes: string;
}

export function ConvertToEventDialog({
  open,
  onOpenChange,
  quotation,
  onSuccess,
}: ConvertToEventDialogProps) {
  const router = useRouter();
  const convertMutation = useConvertToEventMutation();

  const getInitialValues = React.useCallback((): FormValues => {
    if (!quotation) {
      return {
        title: "",
        eventType: "Wedding",
        eventDate: "",
        startTime: "",
        endTime: "",
        venueName: "",
        venueAddress: "",
        guestCount: "",
        budget: "",
        notes: "",
      };
    }

    let formattedDate = "";
    if (quotation.eventDate) {
      try {
        const d = new Date(quotation.eventDate);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toISOString().split("T")[0] || "";
        }
      } catch {
        formattedDate = "";
      }
    }

    return {
      title: quotation.title || "",
      eventType: quotation.eventType || "Wedding",
      eventDate: formattedDate,
      startTime: "",
      endTime: "",
      venueName: quotation.venue || "",
      venueAddress: "",
      guestCount: quotation.guestCount ?? "",
      budget: Number(quotation.totalAmount) || "",
      notes: quotation.notes || `Converted from Quotation #${quotation.quotationNumber}`,
    };
  }, [quotation]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: getInitialValues(),
  });

  React.useEffect(() => {
    if (open && quotation) {
      reset(getInitialValues());
    }
  }, [open, quotation, reset, getInitialValues]);

  const onSubmit = async (values: FormValues) => {
    if (!quotation) return;

    try {
      const payload: ConvertToEventInput = {
        title: values.title.trim() || quotation.title,
        eventType: values.eventType.trim() || quotation.eventType,
        eventDate: values.eventDate ? new Date(values.eventDate) : undefined,
        startTime: values.startTime ? new Date(values.startTime) : null,
        endTime: values.endTime ? new Date(values.endTime) : null,
        venueName: values.venueName.trim() || null,
        venueAddress: values.venueAddress.trim() || null,
        guestCount: values.guestCount ? Number(values.guestCount) : null,
        budget: values.budget ? Number(values.budget) : Number(quotation.totalAmount),
        notes: values.notes.trim() || null,
      };

      // Validate with convertToEventSchema
      const validated = convertToEventSchema.parse(payload);

      const result = await convertMutation.mutateAsync({
        id: quotation.id,
        data: validated,
      });

      toast.success(
        `Quotation successfully converted to Event #${result.event.eventNumber}!`
      );
      onOpenChange(false);

      if (onSuccess) {
        onSuccess(result.event.id);
      } else {
        router.push(`/events/${result.event.id}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to convert quotation to event");
      } else {
        toast.error("Failed to convert quotation to event");
      }
    }
  };

  if (!quotation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Convert Quotation to Event
              </DialogTitle>
              <DialogDescription className="text-xs">
                Turn Quotation{" "}
                <span className="font-mono font-medium text-foreground">
                  #{quotation.quotationNumber}
                </span>{" "}
                for{" "}
                <span className="font-medium text-foreground">
                  {quotation.client?.name || "Client"}
                </span>{" "}
                into an active, confirmed operational event.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Summary Box */}
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <span className="text-muted-foreground block text-[11px]">Quotation Value</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                {formatINR(quotation.totalAmount)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Items Included</span>
              <span className="font-semibold text-foreground">
                {quotation.items?.length ?? 0} line items
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Status</span>
              <span className="font-semibold text-foreground">
                {quotation.status}
              </span>
            </div>
          </div>

          {/* Event Title */}
          <div className="space-y-1.5">
            <Label htmlFor="event-title" className="text-xs font-medium">
              Event Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="event-title"
              {...register("title", { required: "Event title is required" })}
              placeholder="e.g. Verma & Sharma Grand Wedding"
              className="h-8 text-xs"
            />
            {errors.title && (
              <p className="text-[11px] text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Event Type & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-type" className="text-xs font-medium">
                Event Type <span className="text-destructive">*</span>
              </Label>
              <Input
                id="event-type"
                {...register("eventType", { required: "Event type is required" })}
                placeholder="e.g. Wedding, Corporate Gala"
                className="h-8 text-xs"
              />
              {errors.eventType && (
                <p className="text-[11px] text-destructive">{errors.eventType.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-date" className="text-xs font-medium">
                Event Date <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="event-date"
                  type="date"
                  {...register("eventDate", { required: "Event date is required" })}
                  className="h-8 text-xs"
                />
              </div>
              {errors.eventDate && (
                <p className="text-[11px] text-destructive">{errors.eventDate.message}</p>
              )}
            </div>
          </div>

          {/* Schedule: Start & End Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-start" className="text-xs font-medium text-muted-foreground">
                Start Time (Optional)
              </Label>
              <Input
                id="event-start"
                type="datetime-local"
                {...register("startTime")}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-end" className="text-xs font-medium text-muted-foreground">
                End Time (Optional)
              </Label>
              <Input
                id="event-end"
                type="datetime-local"
                {...register("endTime")}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Venue Name & Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="venue-name" className="text-xs font-medium">
                Venue Name
              </Label>
              <div className="relative">
                <Input
                  id="venue-name"
                  {...register("venueName")}
                  placeholder="e.g. The Taj Palace Ballroom"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="venue-address" className="text-xs font-medium">
                Venue Address
              </Label>
              <Input
                id="venue-address"
                {...register("venueAddress")}
                placeholder="City, Street, Landmark"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Guest Count & Budget */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="guest-count" className="text-xs font-medium">
                Expected Guest Count
              </Label>
              <Input
                id="guest-count"
                type="number"
                min="1"
                {...register("guestCount")}
                placeholder="e.g. 500"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="budget" className="text-xs font-medium">
                Allocated Budget (₹)
              </Label>
              <Input
                id="budget"
                type="number"
                step="0.01"
                min="0"
                {...register("budget")}
                placeholder="e.g. 250000"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-medium">
              Event Notes / Handover Instructions
            </Label>
            <Textarea
              id="notes"
              {...register("notes")}
              rows={2}
              placeholder="Important notes, client special requests, schedule notes..."
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="pt-2 sm:justify-between items-center gap-2">
            <p className="text-[11px] text-muted-foreground">
              Status will transition to <strong className="text-foreground">CONFIRMED</strong>
            </p>
            <div className="flex items-center gap-2">
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" />
                    Confirm & Convert to Event
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
