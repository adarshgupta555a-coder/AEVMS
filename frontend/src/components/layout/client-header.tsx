"use client";

import * as React from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Palette } from "lucide-react";
import { openThemeCustomizer } from "@/components/theme-customizer-wrapper";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { AppBreadcrumbs } from "@/components/layout/app-breadcrumbs";

export function ClientHeader() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-background/95 px-4 backdrop-blur-md supports-backdrop-filter:bg-background/80">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <AppBreadcrumbs isClientPortal />
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="outline" className="hidden sm:inline-flex text-[11px] gap-1 px-2 py-0.5 border-border/70 font-medium">
          <span className="size-1.5 rounded-full bg-blue-500" />
          Client Portal
        </Badge>
        <Badge variant="secondary" className="hidden sm:inline-flex text-[11px] font-semibold">
          {user?.role || "CLIENT"}
        </Badge>

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
  );
}
