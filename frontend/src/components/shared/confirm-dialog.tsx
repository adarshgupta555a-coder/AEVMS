"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default";
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => Promise<void> | void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "destructive",
  requireReason = false,
  reasonLabel = "Reason for this action",
  reasonPlaceholder = "Please explain the reason for this action...",
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  const [reason, setReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason("");
      setIsSubmitting(false);
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) return;

    try {
      setIsSubmitting(true);
      await onConfirm(reason.trim() || undefined);
      handleOpenChange(false);
    } catch {
      // Error handled by mutation caller
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBusy = isLoading || isSubmitting;
  const isConfirmDisabled = isBusy || (requireReason && !reason.trim());

  return (
    <Dialog open={open} onOpenChange={(val) => !isBusy && handleOpenChange(val)}>
      <DialogContent className="max-w-md sm:max-w-md">
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-3">
            {variant === "destructive" && (
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <AlertTriangle className="size-5" />
              </div>
            )}
            <DialogTitle className="text-base font-semibold text-foreground">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
            {description}
          </DialogDescription>
        </DialogHeader>

        {requireReason && (
          <div className="space-y-1.5 pt-2">
            <Label htmlFor="confirm-reason" className="text-xs font-medium text-foreground">
              {reasonLabel}{" "}
              <span className="text-destructive font-bold">*</span>
            </Label>
            <Textarea
              id="confirm-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              disabled={isBusy}
              className="min-h-20 text-xs"
            />
          </div>
        )}

        <DialogFooter className="mt-4 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={isBusy}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            size="sm"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className="gap-2"
          >
            {isBusy && <Loader2 className="size-3.5 animate-spin" />}
            <span>{confirmText}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
