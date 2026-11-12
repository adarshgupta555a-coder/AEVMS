"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, UserPlus } from "lucide-react";

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
  createClientSchema,
  type CreateClientInput,
  type ClientItem,
} from "../schemas/client.schema";
import { useCreateClientMutation } from "../hooks/use-clients";
import { ApiError } from "@/lib/api";

export interface ClientCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (client: ClientItem) => void;
}

const defaultValues: CreateClientInput = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  notes: "",
};

export function ClientCreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: ClientCreateDialogProps) {
  const createMutation = useCreateClientMutation();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (open) {
      reset(defaultValues);
    }
  }, [open, reset]);

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
      reset(defaultValues);
      onOpenChange(false);
      onSuccess?.(newClient);
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
        toast.error("An unexpected error occurred while creating client");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <UserPlus className="size-4" />
            </div>
            <DialogTitle className="text-lg font-semibold">
              Create New Client
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Add a new client profile. Portal access can be assigned later from the
            client hub.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="client-name" className="text-xs font-medium">
                Client Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="client-name"
                placeholder="e.g. Ramesh Patel / Acme Corp"
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
                rows={3}
                {...register("notes")}
              />
              {errors.notes && (
                <p className="text-xs text-destructive">{errors.notes.message}</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
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
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="size-3.5" />
                  Save Client
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
