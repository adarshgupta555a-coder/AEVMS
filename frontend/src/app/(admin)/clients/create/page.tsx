"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Check,
} from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  createClientSchema,
  type CreateClientInput,
} from "@/features/clients/schemas/client.schema";
import { useCreateClientMutation } from "@/features/clients/hooks/use-clients";
import { ApiError } from "@/lib/api";

const defaultValues: CreateClientInput = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  notes: "",
};

export default function CreateClientPage() {
  const router = useRouter();
  const createMutation = useCreateClientMutation();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues,
  });

  const onSubmit = async (data: CreateClientInput) => {
    try {
      const sanitizedPayload: CreateClientInput = {
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email?.trim() || "",
        address: data.address?.trim() || undefined,
        city: data.city?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
      };

      const newClient = await createMutation.mutateAsync(sanitizedPayload);
      toast.success(`Client "${newClient.name}" created successfully`);
      router.push(`/clients/${newClient.id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError && Array.isArray(err.details)) {
        err.details.forEach((item: { field: string; message: string }) => {
          if (item.field) {
            setError(item.field as keyof CreateClientInput, {
              type: "server",
              message: item.message,
            });
          }
        });
        toast.error(err.message || "Validation failed");
      } else if (err instanceof Error) {
        toast.error(err.message || "Failed to create client");
      } else {
        toast.error("An unexpected error occurred");
      }
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              render={<Link href="/clients" />}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Register New Client
            </h1>
            <Badge variant="outline" className="text-xs">
              Client CRM
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add a new business or individual client, configure contact details and billing addresses.
          </p>
        </div>
      </div>

      <Card className="border-border/70 shadow-xs">
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Client Intake Form</CardTitle>
            <CardDescription className="text-xs">
              Fill in client contact information. Client portal access can be assigned upon profile creation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="client-name" className="text-xs font-medium">
                  Client / Organization Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="client-name"
                  placeholder="e.g. Ramesh Patel / Apex Celebrations LLP"
                  {...register("name")}
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="client-phone" className="text-xs font-medium">
                  Indian Mobile Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="client-phone"
                  placeholder="10-digit mobile (e.g. 9876543210)"
                  maxLength={10}
                  {...register("phone")}
                  aria-invalid={Boolean(errors.phone)}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="client-email" className="text-xs font-medium">
                  Email Address
                </Label>
                <Input
                  id="client-email"
                  type="email"
                  placeholder="client@example.com (optional)"
                  {...register("email")}
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="client-city" className="text-xs font-medium">
                  City / Region
                </Label>
                <Input
                  id="client-city"
                  placeholder="e.g. Mumbai, Surat"
                  {...register("city")}
                />
                {errors.city && (
                  <p className="text-xs text-destructive">{errors.city.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="client-address" className="text-xs font-medium">
                  Physical / Billing Address
                </Label>
                <Input
                  id="client-address"
                  placeholder="Street address, building, suite"
                  {...register("address")}
                />
                {errors.address && (
                  <p className="text-xs text-destructive">{errors.address.message}</p>
                )}
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="client-notes" className="text-xs font-medium">
                  Internal CRM Notes
                </Label>
                <Textarea
                  id="client-notes"
                  placeholder="Add background notes, preferences, or initial context..."
                  rows={4}
                  {...register("notes")}
                />
                {errors.notes && (
                  <p className="text-xs text-destructive">{errors.notes.message}</p>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t border-border/60 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/clients")}
              disabled={isSubmitting || createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || createMutation.isPending}
              className="gap-1.5"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  Save Client Profile
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
