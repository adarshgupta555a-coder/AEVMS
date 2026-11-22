"use client";

import * as React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminHeader } from "@/components/layout/admin-header";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { config } = useSidebarConfig();

  return (
    <SidebarProvider
      className={config.collapsible === "none" ? "sidebar-none-mode" : ""}
    >
      {config.side === "left" ? (
        <>
          <AdminSidebar
            variant={config.variant}
            collapsible={config.collapsible}
            side={config.side}
          />
          <SidebarInset className="flex flex-col min-h-screen bg-muted/20 min-w-0 overflow-x-hidden">
            <AdminHeader />
            <main className="flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 w-full min-w-0">
              {children}
            </main>
          </SidebarInset>
        </>
      ) : (
        <>
          <SidebarInset className="flex flex-col min-h-screen bg-muted/20 min-w-0 overflow-x-hidden">
            <AdminHeader />
            <main className="flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 w-full min-w-0">
              {children}
            </main>
          </SidebarInset>
          <AdminSidebar
            variant={config.variant}
            collapsible={config.collapsible}
            side={config.side}
          />
        </>
      )}
    </SidebarProvider>
  );
}
