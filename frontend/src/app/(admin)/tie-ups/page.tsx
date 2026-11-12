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
import { Handshake, Plus, Search, ArrowRight } from "lucide-react";

export default function TieUpsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Tie-up Management
            </h1>
            <Badge variant="outline" className="text-xs">
              All Tie-ups
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Partner directory for hotels, banquet halls, resorts, catering vendors, and commission arrangements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" render={<Link href="/tie-ups/transactions" />}>
            Transactions
            <ArrowRight className="size-4" />
          </Button>
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Add Partner
          </Button>
        </div>
      </div>

      <Card className="border-border/70 shadow-xs">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">Venue & Vendor Collaborations</CardTitle>
              <CardDescription className="text-xs">
                Phase 13 Tie-up Collaborations UI Adapter (Partner contracts, commission rates, and contact profiles)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="text-xs h-8">
                <Search className="size-3.5 mr-1" /> Search Partners
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-lg border-border/70 bg-muted/10">
            <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Handshake className="size-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Partner Directory Ready</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Tracks partner categories (Hotel, Banquet Hall, Resort, Catering, Decor) and agreement terms.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
