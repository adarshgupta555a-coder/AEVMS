"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  KeyRound,
  ShieldCheck,
  Clock,
  Send,
  AlertTriangle,
  PowerOff,
  Power,
  Loader2,
} from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

import {
  useClientPortalStatus,
  useUpdateClientStatusMutation,
} from "../hooks/use-clients";
import { PortalAssignmentDialog } from "./portal-assignment-dialog";
import { formatDateTime } from "@/lib/formatters";
import type { ClientDetail, ClientItem } from "../schemas/client.schema";

export interface ClientPortalCardProps {
  client: ClientItem | ClientDetail;
  onRefresh?: () => void;
}

export function ClientPortalCard({ client, onRefresh }: ClientPortalCardProps) {
  const { data: statusData, isLoading, refetch } = useClientPortalStatus(client.id);
  const statusMutation = useUpdateClientStatusMutation();

  const [assignDialogOpen, setAssignDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<"assign" | "resend">("assign");
  const [confirmToggleOpen, setConfirmToggleOpen] = React.useState(false);

  const portalState = statusData?.status || "NOT_ASSIGNED";
  const user = statusData?.user || client.user;

  const handleToggleStatus = async (reason?: string) => {
    if (!user) return;
    const targetStatus = !user.isActive;

    try {
      await statusMutation.mutateAsync({
        id: client.id,
        data: {
          isActive: targetStatus,
          reason,
        },
      });
      toast.success(
        targetStatus
          ? "Client portal access has been reactivated."
          : "Client portal access has been deactivated."
      );
      refetch();
      onRefresh?.();
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to update portal access status");
      } else {
        toast.error("Failed to update status");
      }
    }
  };

  return (
    <>
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <KeyRound className="size-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Portal Access</CardTitle>
                <CardDescription className="text-xs">
                  Client self-service account & security credentials
                </CardDescription>
              </div>
            </div>

            {isLoading ? (
              <Skeleton className="h-5 w-20 rounded" />
            ) : portalState === "ACTIVE" ? (
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Active
              </Badge>
            ) : portalState === "INVITATION_PENDING" ? (
              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs gap-1">
                <span className="size-1.5 rounded-full bg-amber-500" />
                Pending Activation
              </Badge>
            ) : portalState === "INVITATION_EXPIRED" ? (
              <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 text-xs gap-1">
                <span className="size-1.5 rounded-full bg-rose-500" />
                Invite Expired
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                <span className="size-1.5 rounded-full bg-zinc-400" />
                Not Assigned
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-8 w-28" />
            </div>
          ) : portalState === "NOT_ASSIGNED" ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                This client has not been granted portal access. Assigning access generates
                secure single-use activation credentials and invites them to review
                quotations, invoices, and event updates.
              </p>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setDialogMode("assign");
                  setAssignDialogOpen(true);
                }}
              >
                <ShieldCheck className="size-3.5" />
                Assign Portal Access
              </Button>
            </div>
          ) : portalState === "INVITATION_PENDING" ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-1 text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-1.5 font-medium">
                  <Clock className="size-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Invitation dispatched to {client.email}</span>
                </div>
                {user?.invitationExpiresAt && (
                  <p className="text-[11px] text-muted-foreground pl-5">
                    Expires on {formatDateTime(user.invitationExpiresAt)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    setDialogMode("resend");
                    setAssignDialogOpen(true);
                  }}
                >
                  <Send className="size-3.5" />
                  Resend Invitation
                </Button>
              </div>
            </div>
          ) : portalState === "INVITATION_EXPIRED" ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs space-y-1 text-rose-900 dark:text-rose-200">
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="size-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Invitation Token Expired</span>
                </div>
                <p className="text-[11px] text-muted-foreground pl-5">
                  The client did not activate their account within the expiration
                  window. Issue a fresh invite below.
                </p>
              </div>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setDialogMode("resend");
                  setAssignDialogOpen(true);
                }}
              >
                <Send className="size-3.5" />
                Resend Fresh Invite
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Portal Login:</span>
                  <span className="font-mono text-foreground font-medium">
                    {user?.email || client.email}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">User Status:</span>
                  <Badge
                    variant="outline"
                    className={
                      user?.isActive
                        ? "text-emerald-600 border-emerald-500/30"
                        : "text-rose-600 border-rose-500/30"
                    }
                  >
                    {user?.isActive ? "Operational" : "Deactivated"}
                  </Badge>
                </div>
                {user?.createdAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Member Since:</span>
                    <span>{formatDateTime(user.createdAt, "dd MMM yyyy")}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={user?.isActive ? "destructive" : "default"}
                  className="gap-1.5"
                  onClick={() => setConfirmToggleOpen(true)}
                  disabled={statusMutation.isPending}
                >
                  {statusMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : user?.isActive ? (
                    <>
                      <PowerOff className="size-3.5" />
                      Deactivate Portal Access
                    </>
                  ) : (
                    <>
                      <Power className="size-3.5" />
                      Reactivate Portal Access
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <PortalAssignmentDialog
        client={client}
        mode={dialogMode}
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        onSuccess={() => {
          refetch();
          onRefresh?.();
        }}
      />

      <ConfirmDialog
        open={confirmToggleOpen}
        onOpenChange={setConfirmToggleOpen}
        title={user?.isActive ? "Deactivate Client Portal Access" : "Reactivate Portal Access"}
        description={
          user?.isActive
            ? `Are you sure you want to disable portal login for ${client.name}? The client will be immediately logged out and unable to access invoices, quotations, or event dashboards.`
            : `Are you sure you want to restore portal login access for ${client.name}?`
        }
        variant={user?.isActive ? "destructive" : "default"}
        confirmText={user?.isActive ? "Deactivate Access" : "Reactivate Access"}
        requireReason={user?.isActive}
        reasonLabel="Reason for deactivation"
        reasonPlaceholder="e.g. Contract terminated, requested suspension, billing dispute..."
        onConfirm={handleToggleStatus}
        isLoading={statusMutation.isPending}
      />
    </>
  );
}
