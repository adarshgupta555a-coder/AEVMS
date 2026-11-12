"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Pencil, Check } from "lucide-react";

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
  updateClientSchema,
  type UpdateClientInput,
  type ClientItem,
  type ClientDetail,
} from "../schemas/client.schema";
import { useUpdateClientMutation } from "../hooks/use-clients";
import { ApiError } from "@/lib/api";

export interface ClientEditDialogProps {
  client: ClientItem | ClientDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (updated: ClientItem) => void;
}

export function ClientEditDialog({
  client,
  open,
  onOpenChange,
  onSuccess,
}: ClientEditDialogProps) {
  const updateMutation = useUpdateClientMutation();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateClientInput>({
    resolver: zodResolver(updateClientSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      notes: "",
    },
  });

  React.useEffect(() => {
    if (client && open) {
      reset({
        name: client.name ?? "",
        phone: client.phone ?? "",
        email: client.email ?? "",
        address: client.address ?? "",
        city: client.city ?? "",
        notes: client.notes ?? "",
      });
    }
  }, [client, open, reset]);

  const onSubmit = async (data: UpdateClientInput) => {
    if (!client) return;

    try {
      const sanitizedPayload: UpdateClientInput = {
        name: data.name?.trim(),
        phone: data.phone?.trim(),
        email: data.email?.trim() || "",
        address: data.address?.trim() || "",
        city: data.city?.trim() || "",
        notes: data.notes?.trim() || "",
      };

      const updated = await updateMutation.mutateAsync({
        id: client.id,
        data: sanitizedPayload,
      });

      toast.success(`Client "${updated.name}" updated successfully`);
      onOpenChange(false);
      onSuccess?.(updated);
    } catch (err: unknown) {
      if (err instanceof ApiError && Array.isArray(err.details)) {
        err.details.forEach((item: { field: string; message: string }) => {
          if (item.field) {
            setError(item.field as keyof UpdateClientInput, {
              type: "server",
              message: item.message,
            });
          }
        });
        toast.error(err.message || "Validation failed");
      } else if (err instanceof Error) {
        toast.error(err.message || "Failed to update client");
      } else {
        toast.error("An unexpected error occurred while updating client");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Pencil className="size-4" />
            </div>
            <DialogTitle className="text-lg font-semibold">
              Edit Client Profile
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Update contact details and CRM notes for {client?.name ?? "this client"}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="edit-client-name" className="text-xs font-medium">
                Client Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-client-name"
                placeholder="Client Name"
                {...register("name")}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-client-phone" className="text-xs font-medium">
                Indian Mobile Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-client-phone"
                placeholder="10-digit mobile"
                maxLength={10}
                {...register("phone")}
                aria-invalid={Boolean(errors.phone)}
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-client-email" className="text-xs font-medium">
                Email Address
              </Label>
              <Input
                id="edit-client-email"
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
              <Label htmlFor="edit-client-city" className="text-xs font-medium">
                City / Region
              </Label>
              <Input
                id="edit-client-city"
                placeholder="City"
                {...register("city")}
              />
              {errors.city && (
                <p className="text-xs text-destructive">{errors.city.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-client-address" className="text-xs font-medium">
                Physical / Billing Address
              </Label>
              <Input
                id="edit-client-address"
                placeholder="Address"
                {...register("address")}
              />
              {errors.address && (
                <p className="text-xs text-destructive">{errors.address.message}</p>
              )}
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="edit-client-notes" className="text-xs font-medium">
                Internal CRM Notes
              </Label>
              <Textarea
                id="edit-client-notes"
                placeholder="CRM notes..."
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
              disabled={isSubmitting || updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || updateMutation.isPending}
              className="gap-1.5"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
