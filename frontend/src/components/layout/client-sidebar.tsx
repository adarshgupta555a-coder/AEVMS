"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, UserCheck, LogOut } from "lucide-react";
import { clientNavigationConfig } from "@/config/client-navigation";
import { SidebarNav } from "./sidebar-nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface ClientSidebarProps {
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
  side?: "left" | "right";
  className?: string;
}

export function ClientSidebar({
  variant = "sidebar",
  collapsible = "icon",
  side = "left",
  className,
}: ClientSidebarProps) {
  const { user, logout, isLoggingOut } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const clientInitials = (() => {
    if (!user?.name) return "CP";
    const parts = user.name.trim().split(" ");
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return user.name.slice(0, 2).toUpperCase();
  })();

  return (
    <Sidebar
      variant={variant}
      collapsible={collapsible}
      side={side}
      className={cn(
        side === "right"
          ? "border-l border-border bg-sidebar"
          : "border-r border-border bg-sidebar",
        className
      )}
    >
      {/* Client Brand Header */}
      <SidebarHeader className="border-b border-border/60 px-4 py-3">
        <Link href="/portal/dashboard" className="flex items-center gap-2.5 group">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm group-hover:scale-105 transition-transform">
            <Sparkles className="size-4" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-bold tracking-tight text-foreground truncate">
                Client Portal
              </span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-wide uppercase truncate">
                EMS Self-Service
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      {/* Grouped, Expandable Navigation Content */}
      <SidebarContent className="px-2 py-3 overflow-y-auto overflow-x-hidden scrollbar-thin">
        <SidebarNav groups={clientNavigationConfig} />
      </SidebarContent>

      {/* Sidebar Footer with Active Client Details & Quick Sign-Out */}
      <SidebarFooter className="border-t border-border/60 p-2">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <Avatar size="sm" className="size-7 border border-border" title={user?.name || "Client"}>
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">
                {clientInitials}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-2">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar size="sm" className="size-7 shrink-0 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">
                  {clientInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold leading-tight text-foreground truncate">
                  {user?.name || "Client User"}
                </span>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                  <UserCheck className="size-3 shrink-0 text-primary" />
                  <span className="truncate">{user?.email || "CLIENT"}</span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="size-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="size-3.5" />
            </Button>
          </div>
        )}
      </SidebarFooter>

      {/* Resize Rail */}
      <SidebarRail />
    </Sidebar>
  );
}
