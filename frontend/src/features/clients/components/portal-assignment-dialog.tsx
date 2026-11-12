"use client";

import * as React from "react";
import { toast } from "sonner";
import { KeyRound, Copy, Check, Loader2, AlertCircle, Send } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { ClientItem, ClientDetail, AssignPortalResponse } from "../schemas/client.schema";
import { useAssignPortalMutation, useResendInviteMutation } from "../hooks/use-clients";

export interface PortalAssignmentDialogProps {
  client: ClientItem | ClientDetail | null;
  mode?: "assign" | "resend";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PortalAssignmentDialog({
  client,
  mode = "assign",
  open,
  onOpenChange,
  onSuccess,
}: PortalAssignmentDialogProps) {
  const [expiresInHours, setExpiresInHours] = React.useState<number>(24);
  const [result, setResult] = React.useState<AssignPortalResponse | null>(null);
  const [copied, setCopied] = React.useState<boolean>(false);

  const assignMutation = useAssignPortalMutation();
  const resendMutation = useResendInviteMutation();

  const isPending = assignMutation.isPending || resendMutation.isPending;

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setResult(null);
      setCopied(false);
      setExpiresInHours(24);
    }
    onOpenChange(newOpen);
  };

  if (!client) return null;

  const handleAction = async () => {
    if (!client.email) {
      toast.error("Client email is required to assign portal access.");
      return;
    }

    try {
      let res: AssignPortalResponse;
      if (mode === "resend") {
        res = await resendMutation.mutateAsync({
          id: client.id,
          data: { expiresInHours },
        });
        toast.success(`Portal invitation resent to ${client.email}`);
      } else {
        res = await assignMutation.mutateAsync({
          id: client.id,
          data: { expiresInHours },
        });
        toast.success(`Portal credentials assigned for ${client.name}`);
      }
      setResult(res);
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to process portal assignment");
      } else {
        toast.error("An unexpected error occurred");
      }
    }
  };

  const handleCopyLink = async () => {
    if (!result?.activationUrl) return;
    try {
      await navigator.clipboard.writeText(result.activationUrl);
      setCopied(true);
      toast.success("Activation URL copied to clipboard");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Failed to copy URL to clipboard");
    }
  };

  const hasNoEmail = !client.email || client.email.trim() === "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <KeyRound className="size-4" />
            </div>
            <DialogTitle className="text-lg font-semibold">
              {mode === "resend" ? "Resend Portal Invitation" : "Assign Client Portal"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {mode === "resend"
              ? `Generate and dispatch a new activation link for ${client.name}.`
              : `Grant self-service client portal access to ${client.name}.`}
          </DialogDescription>
        </DialogHeader>

        {hasNoEmail ? (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold">Missing Email Address</p>
              <p className="mt-1 text-muted-foreground">
                Client portal access requires a registered email address. Please update
                the client profile first before issuing portal credentials.
              </p>
            </div>
          </div>
        ) : result ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                <Check className="size-4" />
                <span>Invitation Generated Successfully</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                An activation link has been generated and sent to{" "}
                <span className="font-semibold text-foreground">{client.email}</span>.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Single-Use Activation URL
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={result.activationUrl}
                  readOnly
                  className="font-mono text-xs bg-muted/40 selection:bg-primary/20"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="shrink-0 gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Link expires in {expiresInHours} hours. You may share this link directly
                with the client.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client:</span>
                <span className="font-semibold text-foreground">{client.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registered Email:</span>
                <span className="font-mono text-foreground">{client.email}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expires-select" className="text-xs font-medium">
                Token Expiration Window
              </Label>
              <Select
                value={String(expiresInHours)}
                onValueChange={(val) => {
                  if (val) setExpiresInHours(Number(val));
                }}
              >
                <SelectTrigger id="expires-select" className="w-full text-xs">
                  <SelectValue placeholder="Select expiration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12" label="12 Hours">
                    12 Hours
                  </SelectItem>
                  <SelectItem
                    value="24"
                    label="24 Hours (1 Day - Recommended)"
                  >
                    24 Hours (1 Day - Recommended)
                  </SelectItem>
                  <SelectItem value="48" label="48 Hours (2 Days)">
                    48 Hours (2 Days)
                  </SelectItem>
                  <SelectItem value="72" label="72 Hours (3 Days)">
                    72 Hours (3 Days)
                  </SelectItem>
                  <SelectItem value="168" label="168 Hours (7 Days)">
                    168 Hours (7 Days)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
          {result ? (
            <Button
              type="button"
              size="sm"
              onClick={() => handleOpenChange(false)}
            >
              Done
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isPending || hasNoEmail}
                onClick={handleAction}
                className="gap-1.5"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" />
                    {mode === "resend" ? "Resend Invitation" : "Assign & Send Invite"}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
