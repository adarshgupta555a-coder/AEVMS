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
            <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto min-w-0">
              {children}
            </main>
          </SidebarInset>
        </>
      ) : (
        <>
          <SidebarInset className="flex flex-col min-h-screen bg-muted/20 min-w-0 overflow-x-hidden">
            <AdminHeader />
            <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto min-w-0">
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
