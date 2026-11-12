"use client";

import * as React from "react";
import Link from "next/link";
import {
  Calendar,
  FileSpreadsheet,
  Receipt,
  CreditCard,
  Clock,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  FileText,
  User,
  Building,
} from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { MoneyDisplay } from "@/components/shared/money-display";
import {
  EventStatusBadge,
  QuotationStatusBadge,
  InvoiceStatusBadge,
} from "@/components/shared/status-badge";
import { formatIndianPhone, formatDate } from "@/lib/formatters";

import type { ClientDetail } from "../schemas/client.schema";
import { ClientPortalCard } from "./client-portal-card";
import { ClientActivityTimeline } from "./client-activity-timeline";
import {
  clientKeys,
  useClientEvents,
  useClientQuotations,
  useClientInvoices,
  useClientPayments,
} from "../hooks/use-clients";
import { ActivityDialog } from "@/features/calendar/components/activity-dialog";

export interface ClientTabsProps {
  client: ClientDetail;
  onRefresh?: () => void;
}

export function ClientTabs({ client, onRefresh }: ClientTabsProps) {
  const queryClient = useQueryClient();
  const [activityDialogOpen, setActivityDialogOpen] = React.useState(false);

  const { data: eventsData } = useClientEvents(client.id);
  const { data: quotationsData } = useClientQuotations(client.id);
  const { data: invoicesData } = useClientInvoices(client.id);
  const { data: paymentsData } = useClientPayments(client.id);

  const events = eventsData?.events ?? client.event ?? [];
  const quotations = quotationsData?.quotations ?? client.quotations ?? [];
  const invoices = invoicesData?.invoices ?? client.invoice ?? [];
  const payments = paymentsData?.payments ?? client.payments ?? [];

  return (
    <>
      <Tabs defaultValue="overview" className="w-full space-y-4">
      <TabsList className="bg-muted/70 p-1 flex flex-wrap gap-1">
        <TabsTrigger value="overview" className="gap-1.5 text-xs">
          <User className="size-3.5" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="events" className="gap-1.5 text-xs">
          <Calendar className="size-3.5" />
          Events ({events.length})
        </TabsTrigger>
        <TabsTrigger value="quotations" className="gap-1.5 text-xs">
          <FileSpreadsheet className="size-3.5" />
          Quotations ({quotations.length})
        </TabsTrigger>
        <TabsTrigger value="invoices" className="gap-1.5 text-xs">
          <Receipt className="size-3.5" />
          Invoices ({invoices.length})
        </TabsTrigger>
        <TabsTrigger value="payments" className="gap-1.5 text-xs">
          <CreditCard className="size-3.5" />
          Payments ({payments.length})
        </TabsTrigger>
        <TabsTrigger value="activities" className="gap-1.5 text-xs">
          <Clock className="size-3.5" />
          Activity Timeline
        </TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border/70 shadow-xs md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Contact & Profile Information</CardTitle>
              <CardDescription className="text-xs">
                Client profile details, contact information, and audit notes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <User className="size-3.5 text-primary" />
                    Full Name / Company
                  </span>
                  <p className="font-medium text-foreground">{client.name}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Phone className="size-3.5 text-primary" />
                    Indian Mobile
                  </span>
                  <p className="font-medium text-foreground font-mono">
                    {formatIndianPhone(client.phone)}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Mail className="size-3.5 text-primary" />
                    Email Address
                  </span>
                  <p className="font-medium text-foreground">
                    {client.email || <span className="text-muted-foreground italic">None registered</span>}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Building className="size-3.5 text-primary" />
                    City / Location
                  </span>
                  <p className="font-medium text-foreground">
                    {client.city || <span className="text-muted-foreground italic">None specified</span>}
                  </p>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-primary" />
                    Physical / Billing Address
                  </span>
                  <p className="font-medium text-foreground">
                    {client.address || <span className="text-muted-foreground italic">No address provided</span>}
                  </p>
                </div>
              </div>

              {client.notes && (
                <div className="pt-3 border-t border-border/60 space-y-1.5 text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <FileText className="size-3.5 text-primary" />
                    CRM Notes & Audit Log
                  </span>
                  <div className="bg-muted/40 p-3 rounded-md text-foreground whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                    {client.notes}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div>
            <ClientPortalCard client={client} onRefresh={onRefresh} />
          </div>
        </div>
      </TabsContent>

      {/* Events Tab */}
      <TabsContent value="events">
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Client Events</CardTitle>
            <CardDescription className="text-xs">
              All active and historical event projects associated with this client.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {events.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No events linked to this client yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Event #</TableHead>
                    <TableHead className="text-xs">Title</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Budget</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((evt) => (
                    <TableRow key={evt.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground font-semibold">
                        {evt.eventNumber}
                      </TableCell>
                      <TableCell className="font-medium text-xs text-foreground">
                        {evt.title}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(evt.eventDate)}
                      </TableCell>
                      <TableCell>
                        <EventStatusBadge status={evt.status} />
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {evt.budget ? (
                          <MoneyDisplay amount={evt.budget} size="xs" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="xs"
                          className="gap-1 text-xs"
                          render={<Link href={`/events/${evt.id}`} />}
                        >
                          View
                          <ExternalLink className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Quotations Tab */}
      <TabsContent value="quotations">
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Client Quotations</CardTitle>
            <CardDescription className="text-xs">
              Estimates and proposals generated for this client.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {quotations.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No quotations issued for this client yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Quotation #</TableHead>
                    <TableHead className="text-xs">Title</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Total Amount</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground font-semibold">
                        {quote.quotationNumber}
                      </TableCell>
                      <TableCell className="font-medium text-xs text-foreground">
                        {quote.title}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(quote.createdAt)}
                      </TableCell>
                      <TableCell>
                        <QuotationStatusBadge status={quote.status} />
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        <MoneyDisplay amount={quote.totalAmount} size="xs" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="xs"
                          className="gap-1 text-xs"
                          render={<Link href={`/quotations/${quote.id}`} />}
                        >
                          View
                          <ExternalLink className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Invoices Tab */}
      <TabsContent value="invoices">
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Client Invoices</CardTitle>
            <CardDescription className="text-xs">
              Tax invoices, proformas, and billing statements.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No invoices billed to this client yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Invoice #</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Invoice Amount</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground font-semibold">
                        {inv.invoiceNumber}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(inv.invoiceDate)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={inv.status} />
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        <MoneyDisplay amount={inv.totalAmount} size="xs" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="xs"
                          className="gap-1 text-xs"
                          render={<Link href={`/invoices/${inv.id}`} />}
                        >
                          View
                          <ExternalLink className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Payments Tab */}
      <TabsContent value="payments">
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Client Payment Receipts</CardTitle>
            <CardDescription className="text-xs">
              Payment transactions and remittances collected from this client.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {payments.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No payment transactions recorded for this client yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Receipt #</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Method</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Amount Received</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((pmt) => (
                    <TableRow key={pmt.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground font-semibold">
                        {pmt.paymentNumber}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(pmt.paymentDate)}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {pmt.paymentMethod}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            pmt.status === "COMPLETED"
                              ? "text-emerald-600 border-emerald-500/20"
                              : "text-amber-600 border-amber-500/20"
                          }
                        >
                          {pmt.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        <MoneyDisplay amount={pmt.amount} size="xs" colorCoding />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="xs"
                          className="gap-1 text-xs"
                          render={<Link href={`/payments/${pmt.id}`} />}
                        >
                          View
                          <ExternalLink className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* CRM Activities Tab */}
      <TabsContent value="activities">
        <Card className="border-border/70 shadow-xs">
          <CardContent className="pt-4">
            <ClientActivityTimeline
              clientId={client.id}
              onLogActivity={() => setActivityDialogOpen(true)}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

    {/* Pre-filled Activity Dialog for this Client */}
    <ActivityDialog
      open={activityDialogOpen}
      onOpenChange={setActivityDialogOpen}
      defaultClientId={client.id}
      onSuccess={() => {
        queryClient.invalidateQueries({
          queryKey: clientKeys.activities(client.id),
        });
        queryClient.invalidateQueries({
          queryKey: clientKeys.detail(client.id),
        });
        onRefresh?.();
      }}
    />
  </>
  );
}
