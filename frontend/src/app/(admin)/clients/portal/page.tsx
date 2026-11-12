"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ShieldCheck,
  Send,
  PowerOff,
  Users,
  Clock,
  UserX,
  Mail,
  AlertTriangle,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DataTable,
  type DataTableColumnDef,
} from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatIndianPhone, formatDateTime } from "@/lib/formatters";

import {
  useClients,
  useUpdateClientStatusMutation,
} from "@/features/clients/hooks/use-clients";
import type { ClientItem } from "@/features/clients/schemas/client.schema";
import { PortalAssignmentDialog } from "@/features/clients/components/portal-assignment-dialog";

type ClientPortalRow = ClientItem & Record<string, unknown>;

export default function ClientPortalAccessPage() {
  const { data, isLoading, refetch } = useClients({ limit: 100 });
  const clients = (data?.clients ?? []) as ClientPortalRow[];

  const [activeClient, setActiveClient] = React.useState<ClientItem | null>(null);
  const [dialogMode, setDialogMode] = React.useState<"assign" | "resend">("assign");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [toggleClient, setToggleClient] = React.useState<ClientItem | null>(null);

  const toggleMutation = useUpdateClientStatusMutation();

  // Metrics
  const totalCount = clients.length;
  const activatedCount = clients.filter((c) => c.user?.isActive).length;
  const pendingCount = clients.filter((c) => c.user && !c.user.isActive).length;
  const unassignedCount = clients.filter((c) => !c.user).length;

  const handleToggleStatus = async (reason?: string) => {
    if (!toggleClient) return;
    const currentActive = toggleClient.user?.isActive ?? false;
    const targetStatus = !currentActive;

    try {
      await toggleMutation.mutateAsync({
        id: toggleClient.id,
        data: {
          isActive: targetStatus,
          reason,
        },
      });
      toast.success(
        targetStatus
          ? `Portal access reactivated for ${toggleClient.name}`
          : `Portal access deactivated for ${toggleClient.name}`
      );
      setToggleClient(null);
      refetch();
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to update portal status");
      } else {
        toast.error("Failed to update portal status");
      }
    }
  };

  const columns = React.useMemo<DataTableColumnDef<ClientPortalRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Client Name",
        enableSorting: true,
        cell: ({ row }) => {
          const client = row.original;
          const initials = client.name
            .split(" ")
            .map((n) => n[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase() || "CL";

          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-8 rounded-full border border-border/80">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <Link
                  href={`/clients/${client.id}`}
                  className="font-medium text-xs text-foreground hover:text-primary transition-colors truncate"
                  onClick={(e) => e.stopPropagation()}
                >
                  {client.name}
                </Link>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {formatIndianPhone(client.phone)}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "email",
        header: "Registered Portal Email",
        cell: ({ row }) => {
          const email = row.original.email;
          return email ? (
            <span className="text-xs text-foreground font-mono flex items-center gap-1">
              <Mail className="size-3 text-muted-foreground shrink-0" />
              {email}
            </span>
          ) : (
            <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="size-3 shrink-0" />
              No email registered
            </span>
          );
        },
      },
      {
        id: "portalStatus",
        header: "Portal Status",
        cell: ({ row }) => {
          const client = row.original;
          if (client.user?.isActive) {
            return (
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Activated
              </Badge>
            );
          }
          if (client.user) {
            const isExpired =
              client.user.invitationExpiresAt &&
              new Date() > new Date(client.user.invitationExpiresAt);

            return isExpired ? (
              <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 text-xs gap-1">
                <span className="size-1.5 rounded-full bg-rose-500" />
                Invite Expired
              </Badge>
            ) : (
              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs gap-1">
                <span className="size-1.5 rounded-full bg-amber-500" />
                Invite Pending
              </Badge>
            );
          }
          return (
            <Badge variant="outline" className="text-muted-foreground text-xs gap-1">
              <span className="size-1.5 rounded-full bg-zinc-400" />
              Unassigned
            </Badge>
          );
        },
      },
      {
        id: "invitationDetails",
        header: "Invitation / Activity",
        cell: ({ row }) => {
          const user = row.original.user;
          if (!user) {
            return <span className="text-[11px] text-muted-foreground">Not yet invited</span>;
          }
          if (user.isActive) {
            return (
              <span className="text-[11px] text-muted-foreground">
                Active login account
              </span>
            );
          }
          if (user.invitationExpiresAt) {
            return (
              <span className="text-[11px] text-muted-foreground">
                Expires: {formatDateTime(user.invitationExpiresAt, "dd MMM, hh:mm a")}
              </span>
            );
          }
          return <span className="text-[11px] text-muted-foreground">-</span>;
        },
      },
      {
        id: "quickActions",
        header: () => <div className="text-right">Quick Actions</div>,
        cell: ({ row }) => {
          const client = row.original;
          const user = client.user;

          return (
            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
              {!user ? (
                <Button
                  size="xs"
                  variant="outline"
                  className="gap-1 text-xs"
                  disabled={!client.email}
                  onClick={() => {
                    setActiveClient(client);
                    setDialogMode("assign");
                    setDialogOpen(true);
                  }}
                >
                  <Send className="size-3" />
                  Invite
                </Button>
              ) : !user.isActive ? (
                <Button
                  size="xs"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={() => {
                    setActiveClient(client);
                    setDialogMode("resend");
                    setDialogOpen(true);
                  }}
                >
                  <Send className="size-3" />
                  Resend Invite
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="destructive"
                  className="gap-1 text-xs"
                  onClick={() => setToggleClient(client)}
                >
                  <PowerOff className="size-3" />
                  Deactivate
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
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
              Portal Access Management
            </h1>
            <Badge variant="outline" className="text-xs">
              Client Portal
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage client portal user accounts, credentials, invitation dispatch, and self-service permissions.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Clients</p>
              <h3 className="text-xl font-bold text-foreground mt-1">{totalCount}</h3>
            </div>
            <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Users className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Activated Accounts</p>
              <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {activatedCount}
              </h3>
            </div>
            <div className="size-9 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pending Invites</p>
              <h3 className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {pendingCount}
              </h3>
            </div>
            <div className="size-9 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Unassigned</p>
              <h3 className="text-xl font-bold text-muted-foreground mt-1">
                {unassignedCount}
              </h3>
            </div>
            <div className="size-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
              <UserX className="size-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main DataTable */}
      <DataTable
        columns={columns}
        data={clients}
        isLoading={isLoading}
        searchPlaceholder="Filter portal accounts by client name, email, phone..."
        defaultPageSize={10}
        emptyTitle="No portal accounts found"
        emptyDescription="Invite clients to the self-service portal using the action buttons."
        extraActions={
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5"
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        }
      />

      {/* Portal Assignment / Resend Dialog */}
      <PortalAssignmentDialog
        client={activeClient}
        mode={dialogMode}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setActiveClient(null);
        }}
        onSuccess={() => refetch()}
      />

      {/* Toggle Status Confirmation */}
      <ConfirmDialog
        open={Boolean(toggleClient)}
        onOpenChange={(open) => {
          if (!open) setToggleClient(null);
        }}
        title="Deactivate Client Portal Access"
        description={`Are you sure you want to disable portal login for ${toggleClient?.name}? They will not be able to log in to view their dashboard or invoices.`}
        variant="destructive"
        confirmText="Deactivate Access"
        requireReason
        reasonLabel="Reason for deactivation"
        reasonPlaceholder="e.g. Contract ended, client requested account lock..."
        onConfirm={handleToggleStatus}
        isLoading={toggleMutation.isPending}
      />
    </div>
  );
}
