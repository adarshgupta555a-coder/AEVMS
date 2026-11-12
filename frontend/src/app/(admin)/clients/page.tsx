"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  ShieldCheck,
  MoreHorizontal,
  Eye,
  Pencil,
  KeyRound,
  Trash2,
  PowerOff,
  Power,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DataTable,
  type DataTableColumnDef,
} from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatIndianPhone } from "@/lib/formatters";

import {
  useClients,
  useDeleteClientMutation,
  useUpdateClientStatusMutation,
} from "@/features/clients/hooks/use-clients";
import type { ClientItem } from "@/features/clients/schemas/client.schema";
import { ClientCreateDialog } from "@/features/clients/components/client-create-dialog";
import { ClientEditDialog } from "@/features/clients/components/client-edit-dialog";
import { PortalAssignmentDialog } from "@/features/clients/components/portal-assignment-dialog";

type ClientTableRow = ClientItem & Record<string, unknown>;

export default function ClientsPage() {
  const router = useRouter();
  const { data, isLoading, refetch } = useClients({ limit: 100 });
  const clients = (data?.clients ?? []) as ClientTableRow[];

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editingClient, setEditingClient] = React.useState<ClientItem | null>(null);
  const [portalClient, setPortalClient] = React.useState<ClientItem | null>(null);
  const [portalMode, setPortalMode] = React.useState<"assign" | "resend">("assign");
  const [deletingClient, setDeletingClient] = React.useState<ClientItem | null>(null);
  const [togglingClient, setTogglingClient] = React.useState<ClientItem | null>(null);

  // Mutations
  const deleteMutation = useDeleteClientMutation();
  const toggleMutation = useUpdateClientStatusMutation();

  const handleDelete = async () => {
    if (!deletingClient) return;
    try {
      await deleteMutation.mutateAsync(deletingClient.id);
      toast.success(`Client "${deletingClient.name}" deleted successfully`);
      setDeletingClient(null);
      refetch();
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to delete client");
      } else {
        toast.error("Failed to delete client");
      }
    }
  };

  const handleToggleStatus = async (reason?: string) => {
    if (!togglingClient) return;
    const currentActive = togglingClient.user?.isActive ?? true;
    const targetStatus = !currentActive;

    try {
      await toggleMutation.mutateAsync({
        id: togglingClient.id,
        data: {
          isActive: targetStatus,
          reason,
        },
      });
      toast.success(
        targetStatus
          ? `Portal access reactivated for ${togglingClient.name}`
          : `Portal access deactivated for ${togglingClient.name}`
      );
      setTogglingClient(null);
      refetch();
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to update client status");
      } else {
        toast.error("Failed to update status");
      }
    }
  };

  const columns = React.useMemo<DataTableColumnDef<ClientTableRow, unknown>[]>(
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

          const eventCount = client._count?.event ?? 0;
          const quoteCount = client._count?.quotations ?? 0;

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
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>{eventCount} {eventCount === 1 ? "event" : "events"}</span>
                  <span>•</span>
                  <span>{quoteCount} {quoteCount === 1 ? "quote" : "quotes"}</span>
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "phone",
        header: "Phone Number",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-foreground">
            {formatIndianPhone(row.original.phone)}
          </span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email Address",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground truncate max-w-[180px] block">
            {row.original.email || <span className="italic text-muted-foreground/60">-</span>}
          </span>
        ),
      },
      {
        accessorKey: "city",
        header: "City",
        cell: ({ row }) => (
          <span className="text-xs text-foreground">
            {row.original.city || <span className="text-muted-foreground italic">-</span>}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const client = row.original;
          const isUserActive = client.user ? client.user.isActive : true;

          return isUserActive ? (
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[11px] gap-1"
            >
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Active
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20 text-[11px] gap-1"
            >
              <span className="size-1.5 rounded-full bg-zinc-400" />
              Inactive
            </Badge>
          );
        },
      },
      {
        id: "portalAccess",
        header: "Portal Access",
        cell: ({ row }) => {
          const client = row.original;
          if (client.user?.isActive) {
            return (
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0 font-normal">
                Activated
              </Badge>
            );
          }
          if (client.user) {
            return (
              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px] px-1.5 py-0 font-normal">
                Invite Pending
              </Badge>
            );
          }
          return (
            <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0 font-normal">
              Unassigned
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const client = row.original;
          return (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" className="size-7" />
                  }
                >
                  <MoreHorizontal className="size-3.5" />
                  <span className="sr-only">Open client actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 text-xs">
                  <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                    Client Actions
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => router.push(`/clients/${client.id}`)}
                    className="gap-2 cursor-pointer"
                  >
                    <Eye className="size-3.5" />
                    View Profile & Hub
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setEditingClient(client)}
                    className="gap-2 cursor-pointer"
                  >
                    <Pencil className="size-3.5" />
                    Edit Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setPortalClient(client);
                      setPortalMode(client.user ? "resend" : "assign");
                    }}
                    className="gap-2 cursor-pointer"
                  >
                    <KeyRound className="size-3.5" />
                    {client.user ? "Resend Portal Invite" : "Assign Portal"}
                  </DropdownMenuItem>

                  {client.user && (
                    <DropdownMenuItem
                      onClick={() => setTogglingClient(client)}
                      className="gap-2 cursor-pointer"
                    >
                      {client.user.isActive ? (
                        <>
                          <PowerOff className="size-3.5 text-amber-600" />
                          <span>Deactivate Portal</span>
                        </>
                      ) : (
                        <>
                          <Power className="size-3.5 text-emerald-600" />
                          <span>Reactivate Portal</span>
                        </>
                      )}
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeletingClient(client)}
                    className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                    Delete Client
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [router]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Client Management
            </h1>
            <Badge variant="outline" className="text-xs">
              {clients.length} {clients.length === 1 ? "Client" : "Clients"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Client directory, contact details, company profiles, and financial ledger summaries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            render={<Link href="/clients/portal" />}
          >
            <ShieldCheck className="size-4" />
            Portal Access
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="size-4" />
            New Client
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={clients}
        isLoading={isLoading}
        searchPlaceholder="Search clients by name, phone, email, city..."
        defaultPageSize={10}
        onRowClick={(row) => router.push(`/clients/${row.id}`)}
        emptyTitle="No clients found"
        emptyDescription="Get started by registering your first client profile."
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

      {/* Creation Modal */}
      <ClientCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => refetch()}
      />

      {/* Edit Modal */}
      <ClientEditDialog
        client={editingClient}
        open={Boolean(editingClient)}
        onOpenChange={(open) => {
          if (!open) setEditingClient(null);
        }}
        onSuccess={() => {
          setEditingClient(null);
          refetch();
        }}
      />

      {/* Portal Assignment Modal */}
      <PortalAssignmentDialog
        client={portalClient}
        mode={portalMode}
        open={Boolean(portalClient)}
        onOpenChange={(open) => {
          if (!open) setPortalClient(null);
        }}
        onSuccess={() => {
          refetch();
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deletingClient)}
        onOpenChange={(open) => {
          if (!open) setDeletingClient(null);
        }}
        title="Delete Client Record"
        description={`Are you sure you want to delete ${deletingClient?.name}? This action cannot be undone. Note: clients with linked events, quotations, or invoices cannot be deleted.`}
        variant="destructive"
        confirmText="Delete Client"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />

      {/* Status Toggle Confirmation */}
      <ConfirmDialog
        open={Boolean(togglingClient)}
        onOpenChange={(open) => {
          if (!open) setTogglingClient(null);
        }}
        title={
          togglingClient?.user?.isActive
            ? "Deactivate Client Portal"
            : "Reactivate Client Portal"
        }
        description={
          togglingClient?.user?.isActive
            ? `Are you sure you want to deactivate portal login for ${togglingClient?.name}? They will not be able to log in.`
            : `Restore portal access for ${togglingClient?.name}?`
        }
        variant={togglingClient?.user?.isActive ? "destructive" : "default"}
        confirmText={
          togglingClient?.user?.isActive ? "Deactivate" : "Reactivate"
        }
        requireReason={togglingClient?.user?.isActive}
        reasonLabel="Reason for deactivation"
        reasonPlaceholder="e.g. Contract ended, requested temporary hold..."
        onConfirm={handleToggleStatus}
        isLoading={toggleMutation.isPending}
      />
    </div>
  );
}
