"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Palette,
  Search,
  LayoutDashboard,
  Users,
  FileText,
  CalendarCheck,
  Receipt,
  CreditCard,
  Calendar,
  Package,
  DollarSign,
  Handshake,
  ArrowRight,
} from "lucide-react";
import { openThemeCustomizer } from "@/components/theme-customizer-wrapper";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { AppBreadcrumbs } from "@/components/layout/app-breadcrumbs";

// Global search navigation modules
const searchModules = [
  {
    title: "Dashboard",
    href: "/dashboard",
    description: "Executive KPIs, active events, and revenue highlights",
    icon: LayoutDashboard,
    category: "Core",
  },
  {
    title: "Clients",
    href: "/clients",
    description: "Client CRM directory, contact records, and portal status",
    icon: Users,
    category: "Core",
  },
  {
    title: "Quotations",
    href: "/quotations",
    description: "Itemized quotation builder, approvals, and conversions",
    icon: FileText,
    category: "Core",
  },
  {
    title: "Events",
    href: "/events",
    description: "Event command center, task checklists, and timelines",
    icon: CalendarCheck,
    category: "Operations",
  },
  {
    title: "Calendar",
    href: "/calendar",
    description: "Master operations calendar, meetings, and site visits",
    icon: Calendar,
    category: "Operations",
  },
  {
    title: "Invoices",
    href: "/invoices",
    description: "Proforma & tax invoicing, balance tracking, and PDF streaming",
    icon: Receipt,
    category: "Finance",
  },
  {
    title: "Payments",
    href: "/payments",
    description: "Record payments, receipts, and multi-invoice allocations",
    icon: CreditCard,
    category: "Finance",
  },
  {
    title: "Inventory",
    href: "/inventory",
    description: "Warehouse inventory stock, sound, lighting, and gear",
    icon: Package,
    category: "Resources",
  },
  {
    title: "Expenses",
    href: "/expenses",
    description: "Vendor payouts, operational overhead, and withdrawals",
    icon: DollarSign,
    category: "Finance",
  },
  {
    title: "Tie-ups",
    href: "/tie-ups",
    description: "Third-party vendor commission rates and tie-up logs",
    icon: Handshake,
    category: "Resources",
  },
];

export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter modules based on search query
  const filteredModules = React.useMemo(() => {
    if (!searchQuery.trim()) return searchModules;
    const q = searchQuery.toLowerCase().trim();
    return searchModules.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleSelectModule = (href: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    router.push(href);
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-background/95 px-4 backdrop-blur-md supports-backdrop-filter:bg-background/80">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <AppBreadcrumbs />
        </div>

        {/* Global Quick Search Button */}
        <div className="flex items-center gap-2 flex-1 max-w-xs sm:max-w-sm mx-3">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-8 w-full items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-3 text-xs text-muted-foreground shadow-xs transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="size-3.5 shrink-0 opacity-70" />
              <span className="truncate">Search modules...</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden lg:flex items-center gap-1.5">
            <Badge variant="outline" className="text-[11px] gap-1 px-2 py-0.5 border-border/70 font-medium">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live System
            </Badge>
            <Badge variant="secondary" className="text-[11px] font-semibold">
              {user?.role || "ADMIN"}
            </Badge>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={openThemeCustomizer}
            title="Open Theme Customizer"
            aria-label="Customize Theme"
          >
            <Palette className="size-4" />
          </Button>

          <ThemeToggle />
        </div>
      </header>

      {/* Global Quick Navigation Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden sm:max-w-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Quick Navigation Search</DialogTitle>
            <DialogDescription>
              Search and jump directly to EMS Back-Office modules
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center border-b border-border/70 px-3.5 py-2.5">
            <Search className="size-4 shrink-0 text-muted-foreground mr-2.5" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search EMS modules (e.g., Quotations, Invoices, Events)..."
              className="h-8 border-0 bg-transparent px-0 text-sm focus-visible:ring-0 shadow-none"
            />
            <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>

          <div className="max-h-[360px] overflow-y-auto p-2">
            {filteredModules.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No modules match &quot;{searchQuery}&quot;
              </div>
            ) : (
              <div className="space-y-1">
                {filteredModules.map((item) => {
                  const Icon = item.icon;
                  const isCurrent = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => handleSelectModule(item.href)}
                      className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground outline-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <Icon className="size-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground group-hover:text-foreground">
                              {item.title}
                            </span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal text-muted-foreground">
                              {item.category}
                            </Badge>
                            {isCurrent && (
                              <span className="text-[10px] font-medium text-primary">
                                Current
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground truncate">
                            {item.description}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-3.5 py-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Navigate with click or Enter</span>
            </div>
            <span>EMS Quick Jump</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
