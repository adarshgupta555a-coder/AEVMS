"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarPlus,
  Loader2,
  Calendar,
  Users,
  MapPin,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useClients, useClientQuotations } from "@/features/clients/hooks/use-clients";
import { useCreateEventMutation } from "@/features/events/hooks/use-events";
import {
  createEventSchema,
  type CreateEventInput,
  type CreateEventRawInput,
} from "@/features/events/schemas/event.schema";
import { formatINR } from "@/lib/formatters";

const COMMON_EVENT_TYPES = [
  "Wedding",
  "Corporate Summit",
  "Birthday Gala",
  "Cocktail & Sangeet",
  "Concert / Live Music",
  "Exhibition & Trade Fair",
  "Golden Jubilee",
  "Conference & Hackathon",
  "Private Dinner",
];

export default function CreateEventPage() {
  const router = useRouter();
  const createMutation = useCreateEventMutation();
  const { data: clientData, isLoading: loadingClients } = useClients({
    limit: 100,
  });
  const clients = clientData?.clients ?? [];

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateEventRawInput, unknown, CreateEventInput>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      clientId: "",
      quotationId: null,
      title: "",
      eventType: "Wedding",
      description: "",
      venueName: "",
      venueAddress: "",
      notes: "",
    },
  });

  const selectedClientId = useWatch({ control, name: "clientId" });
  const { data: quotationData, isLoading: loadingQuotations } =
    useClientQuotations(selectedClientId, { limit: 50 });
  const clientQuotations = quotationData?.quotations ?? [];

  const onSubmit = async (data: CreateEventInput) => {
    try {
      const created = await createMutation.mutateAsync(data);
      toast.success(`Event project "${created.title}" registered successfully`);
      router.push(`/events/${created.id}`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create event project"
      );
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              render={<Link href="/events" />}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Register New Event
            </h1>
            <Badge variant="outline" className="text-xs">
              Project Onboarding
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 ml-9">
            Onboard an event production project, configure venue dates, assign client, and set the planned budget.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Client & Quotation Association */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="size-4 text-primary" />
              1. Client & Originating Proposal
            </CardTitle>
            <CardDescription className="text-xs">
              Select the client account owning this event project.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="clientId" className="text-xs">
                  Client <span className="text-destructive">*</span>
                </Label>
                <select
                  id="clientId"
                  {...register("clientId")}
                  disabled={loadingClients}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                >
                  <option value="">
                    {loadingClients
                      ? "Loading client database..."
                      : "-- Select Client Account --"}
                  </option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
                {errors.clientId && (
                  <p className="text-[11px] text-destructive">
                    {errors.clientId.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="quotationId" className="text-xs">
                  Linked Quotation / Estimate (Optional)
                </Label>
                <select
                  id="quotationId"
                  {...register("quotationId")}
                  disabled={!selectedClientId || loadingQuotations}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                >
                  <option value="">
                    {!selectedClientId
                      ? "Select a client first"
                      : loadingQuotations
                        ? "Loading client quotations..."
                        : clientQuotations.length === 0
                          ? "No quotations on file (Direct Event)"
                          : "-- Optional: Link Approved Quotation --"}
                  </option>
                  {clientQuotations.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.quotationNumber} - {q.title} ({formatINR(q.totalAmount)})
                    </option>
                  ))}
                </select>
                {errors.quotationId && (
                  <p className="text-[11px] text-destructive">
                    {errors.quotationId.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Event Core Information */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              2. Event Title, Type & Scope
            </CardTitle>
            <CardDescription className="text-xs">
              Project title and category classification.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="title" className="text-xs">
                  Event Project Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="e.g. Mehta & Kapoor Destination Wedding"
                  {...register("title")}
                  className="h-9 text-xs"
                />
                {errors.title && (
                  <p className="text-[11px] text-destructive">
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="eventType" className="text-xs">
                  Event Type <span className="text-destructive">*</span>
                </Label>
                <div className="space-y-1">
                  <Input
                    id="eventType"
                    placeholder="e.g. Wedding, Corporate"
                    {...register("eventType")}
                    className="h-9 text-xs"
                    list="eventType-suggestions"
                  />
                  <datalist id="eventType-suggestions">
                    {COMMON_EVENT_TYPES.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
                {errors.eventType && (
                  <p className="text-[11px] text-destructive">
                    {errors.eventType.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs">
                Description / Production Brief
              </Label>
              <Textarea
                id="description"
                placeholder="High-level production scope, guest profile, theme, or stage requirements..."
                {...register("description")}
                rows={3}
                className="text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Schedule, Venue & Logistics */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="size-4 text-primary" />
              3. Venue Logistics & Call Times
            </CardTitle>
            <CardDescription className="text-xs">
              Venue location, guest count, and execution dates.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="eventDate" className="text-xs">
                  Event Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="eventDate"
                  type="date"
                  {...register("eventDate")}
                  className="h-9 text-xs"
                />
                {errors.eventDate && (
                  <p className="text-[11px] text-destructive">
                    {errors.eventDate.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="startTime" className="text-xs">
                  Start Call Time (Optional)
                </Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  {...register("startTime")}
                  className="h-9 text-xs"
                />
                {errors.startTime && (
                  <p className="text-[11px] text-destructive">
                    {errors.startTime.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="endTime" className="text-xs">
                  End Call Time (Optional)
                </Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  {...register("endTime")}
                  className="h-9 text-xs"
                />
                {errors.endTime && (
                  <p className="text-[11px] text-destructive">
                    {errors.endTime.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="venueName" className="text-xs">
                  Venue Name
                </Label>
                <Input
                  id="venueName"
                  placeholder="e.g. ITC Gardenia / The Oberoi Grand"
                  {...register("venueName")}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="venueAddress" className="text-xs">
                  Venue Address / City
                </Label>
                <Input
                  id="venueAddress"
                  placeholder="e.g. Residency Road, Bengaluru"
                  {...register("venueAddress")}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="guestCount" className="text-xs">
                  Expected Guest Count (Pax)
                </Label>
                <Input
                  id="guestCount"
                  type="number"
                  min={1}
                  placeholder="e.g. 450"
                  {...register("guestCount")}
                  className="h-9 text-xs"
                />
                {errors.guestCount && (
                  <p className="text-[11px] text-destructive">
                    {errors.guestCount.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="budget" className="text-xs">
                  Planned Budget (₹ INR)
                </Label>
                <Input
                  id="budget"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 1200000"
                  {...register("budget")}
                  className="h-9 text-xs font-mono"
                />
                {errors.budget && (
                  <p className="text-[11px] text-destructive">
                    {errors.budget.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs">
                Internal Production Notes
              </Label>
              <Textarea
                id="notes"
                placeholder="VIP guest preferences, technical rider notes, special staging constraints..."
                {...register("notes")}
                rows={2}
                className="text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-4 text-xs"
            render={<Link href="/events" />}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || createMutation.isPending}
            className="h-9 px-5 text-xs gap-1.5 font-semibold"
          >
            {isSubmitting || createMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Registering Event...
              </>
            ) : (
              <>
                <CalendarPlus className="size-4" />
                Create Event Project
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
