"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserCheck,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Building,
  ShieldCheck,
  KeyRound,
  Calendar,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { useAuth, useCurrentUser } from "@/features/auth/hooks/use-auth";
import { useClient } from "@/features/clients/hooks/use-clients";
import { formatDate, formatIndianPhone } from "@/lib/formatters";

export default function ClientProfilePage() {
  const { user } = useAuth();
  const { data: currentUserData, isLoading: isLoadingUser } = useCurrentUser();

  // If user has linked clientId, query the client record for complete billing info
  const clientId = user?.clientId || currentUserData?.user?.clientId;
  const { data: clientData, isLoading: isLoadingClient } = useClient(
    clientId || ""
  );

  const activeUser = currentUserData?.user || user;
  const client = clientData || activeUser?.client;

  const isLoading = isLoadingUser || (Boolean(clientId) && isLoadingClient);

  const clientName = client?.name || activeUser?.name || "Client";
  const clientEmail = client?.email || activeUser?.email || "-";
  const clientPhone = client?.phone ? formatIndianPhone(client.phone) : "-";
  const clientAddress = client?.address || "No address registered";
  const clientCity = client?.city || "Not specified";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              render={<Link href="/portal/dashboard" />}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Profile & Account Details
            </h1>
            <Badge variant="outline" className="text-xs">
              Client Portal
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your registered client profile information, contact records, and active portal security credentials.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-4">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </Card>
          <Card className="p-6 space-y-4">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Client Profile Particulars */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <UserCheck className="size-4 text-primary" />
                    Client Profile Information
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Primary contact information linked to your event contracts and invoices.
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px]"
                >
                  <CheckCircle2 className="size-3 mr-1" />
                  Active Portal
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Client / Organization Name
                </span>
                <div className="text-sm font-bold text-foreground">
                  {clientName}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Registered Email Address
                </span>
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Mail className="size-3.5 text-primary shrink-0" />
                  <span>{clientEmail}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Registered Phone Number
                </span>
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Phone className="size-3.5 text-primary shrink-0" />
                  <span>{clientPhone}</span>
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-border/50">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Billing Address & City
                </span>
                <div className="flex items-start gap-2 text-foreground font-medium mt-1">
                  <MapPin className="size-3.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div>{clientAddress}</div>
                    <div className="text-muted-foreground text-[11px] mt-0.5">
                      City: {clientCity}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-muted/40 border border-border/50 text-xs text-muted-foreground leading-relaxed mt-4">
                To update your registered organization name, tax GSTIN, or billing address on official invoices, please notify your assigned event coordinator.
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Security & Active Session Info */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    Security & Authentication
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Your authenticated session details and credentials.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-[11px]">
                  HttpOnly Guarded
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Linked User Account
                </span>
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <KeyRound className="size-3.5 text-primary shrink-0" />
                  <span>{activeUser?.email || "CLIENT"}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Portal Role
                </span>
                <div>
                  <Badge variant="outline" className="text-xs font-semibold">
                    {activeUser?.role || "CLIENT"}
                  </Badge>
                </div>
              </div>

              {activeUser?.createdAt && (
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Portal Member Since
                  </span>
                  <div className="flex items-center gap-2 text-foreground font-medium">
                    <Calendar className="size-3.5 text-primary shrink-0" />
                    <span>{formatDate(activeUser.createdAt, "dd MMMM yyyy")}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1 pt-2 border-t border-border/50">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Session Protection
                </span>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  <Sparkles className="size-3.5 shrink-0" />
                  <span>Active Encrypted HttpOnly Session</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Your session is automatically refreshed using rotating secure tokens. You can securely log out anytime via the sidebar.
                </p>
              </div>

              <div className="space-y-1 pt-2 border-t border-border/50">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Assigned Operations Desk
                </span>
                <div className="flex items-center gap-2 text-foreground font-medium mt-1">
                  <Building className="size-3.5 text-primary shrink-0" />
                  <span>EMS Production & Client Services Desk</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Email: operations@ems.local
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
