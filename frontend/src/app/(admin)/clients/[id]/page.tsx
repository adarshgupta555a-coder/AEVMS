"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  KeyRound,
  CalendarCheck,
  Receipt,
  FileSpreadsheet,
  CreditCard,
  Mail,
  Phone,
  Building,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyDisplay } from "@/components/shared/money-display";
import { formatIndianPhone } from "@/lib/formatters";

import { useClient } from "@/features/clients/hooks/use-clients";
import { ClientTabs } from "@/features/clients/components/client-tabs";
import { ClientEditDialog } from "@/features/clients/components/client-edit-dialog";
import { PortalAssignmentDialog } from "@/features/clients/components/portal-assignment-dialog";
import { useSetBreadcrumbTitle } from "@/store/breadcrumb-store";

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const { data: client, isLoading, isError, error, refetch } = useClient(id);

  useSetBreadcrumbTitle(client?.name);

  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [portalDialogOpen, setPortalDialogOpen] = React.useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 pb-2 border-b border-border/60">
          <Skeleton className="size-8 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (isError || !client) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 space-y-4">
        <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <AlertCircle className="size-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            Client Profile Not Found
          </h2>
          <p className="text-xs text-muted-foreground max-w-sm">
            {error instanceof Error ? error.message : "The requested client record could not be loaded."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            render={<Link href="/clients" />}
          >
            <ArrowLeft className="size-3.5" />
            Back to Directory
          </Button>
          <Button size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const initials = client.name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "CL";

  // Financial aggregates
  const totalEvents = client._count?.event ?? client.event?.length ?? 0;
  const totalQuotations = client._count?.quotations ?? client.quotations?.length ?? 0;

  const totalInvoiced = (client.invoice ?? []).reduce((acc, curr) => {
    return acc + Number(curr.totalAmount || 0);
  }, 0);

  const totalPaid = (client.payments ?? []).reduce((acc, curr) => {
    return acc + Number(curr.amount || 0);
  }, 0);

  const isPortalActive = client.user?.isActive;
  const hasPortalUser = Boolean(client.user);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            render={<Link href="/clients" />}
          >
            <ArrowLeft className="size-4" />
          </Button>

          <Avatar className="size-11 rounded-full border border-border/80">
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {client.name}
              </h1>
              <Badge
                variant="outline"
                className={
                  isPortalActive
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs"
                    : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20 text-xs"
                }
              >
                {isPortalActive ? "Active Client" : "Standard Account"}
              </Badge>
              {hasPortalUser ? (
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs">
                  Portal Enabled
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground text-xs">
                  No Portal
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
              <span className="flex items-center gap-1 font-mono">
                <Phone className="size-3 text-primary/70" />
                {formatIndianPhone(client.phone)}
              </span>
              {client.email && (
                <span className="flex items-center gap-1">
                  <Mail className="size-3 text-primary/70" />
                  {client.email}
                </span>
              )}
              {client.city && (
                <span className="flex items-center gap-1">
                  <Building className="size-3 text-primary/70" />
                  {client.city}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setEditDialogOpen(true)}
          >
            <Pencil className="size-3.5" />
            Edit Profile
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setPortalDialogOpen(true)}
          >
            <KeyRound className="size-3.5" />
            {hasPortalUser ? "Portal Access" : "Assign Portal"}
          </Button>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Linked Events</p>
              <h3 className="text-xl font-bold text-foreground mt-1">{totalEvents}</h3>
            </div>
            <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <CalendarCheck className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Quotations Issued</p>
              <h3 className="text-xl font-bold text-foreground mt-1">{totalQuotations}</h3>
            </div>
            <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <FileSpreadsheet className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Invoiced</p>
              <div className="mt-1">
                <MoneyDisplay amount={totalInvoiced} size="lg" />
              </div>
            </div>
            <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Receipt className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Payments Received</p>
              <div className="mt-1">
                <MoneyDisplay amount={totalPaid} size="lg" colorCoding />
              </div>
            </div>
            <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <CreditCard className="size-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sub-Resource Tabs */}
      <ClientTabs client={client} onRefresh={() => refetch()} />

      {/* Edit Dialog */}
      <ClientEditDialog
        client={client}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => refetch()}
      />

      {/* Portal Assignment Dialog */}
      <PortalAssignmentDialog
        client={client}
        mode={hasPortalUser ? "resend" : "assign"}
        open={portalDialogOpen}
        onOpenChange={setPortalDialogOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
