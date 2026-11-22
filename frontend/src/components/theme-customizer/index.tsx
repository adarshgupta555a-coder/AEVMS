"use client";

import * as React from "react";
import { Layout, Palette, RotateCcw, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useThemeManager } from "@/hooks/use-theme-manager";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import { tweakcnThemes } from "@/config/theme-data";
import { ThemeTab } from "./theme-tab";
import { LayoutTab } from "./layout-tab";
import { ImportModal } from "./import-modal";
import { cn } from "@/lib/utils";
import type { ImportedTheme } from "@/types/theme-customizer";

interface ThemeCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThemeCustomizer({ open, onOpenChange }: ThemeCustomizerProps) {
  const {
    config: themeConfig,
    applyImportedTheme,
    isDarkMode,
    resetTheme,
    applyRadius,
    applyTheme,
    applyTweakcnTheme,
  } = useThemeManager();
  const { config: sidebarConfig, updateConfig: updateSidebarConfig } =
    useSidebarConfig();

  const [activeTab, setActiveTab] = React.useState("theme");
  const [importModalOpen, setImportModalOpen] = React.useState(false);

  const handleReset = () => {
    // 1. Reset theme and remove stored settings from localStorage
    resetTheme();

    // 2. Reset sidebar to defaults
    updateSidebarConfig({
      variant: "sidebar",
      collapsible: "icon",
      side: "left",
    });
  };

  const handleImport = (themeData: ImportedTheme) => {
    applyImportedTheme(themeData, isDarkMode);
  };

  const handleImportClick = () => {
    setImportModalOpen(true);
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(nextOpen, details) => {
          // Keep the sheet open while the import dialog is open
          if (
            !nextOpen &&
            importModalOpen &&
            details.reason === "outside-press"
          ) {
            details.cancel();
            return;
          }
          onOpenChange(nextOpen);
        }}
        modal={false}
      >
        <SheetContent
          showCloseButton={false}
          side={sidebarConfig.side === "left" ? "right" : "left"}
          className="w-[400px] p-0 gap-0 pointer-events-auto overflow-hidden flex flex-col bg-background"
        >
          <SheetHeader className="gap-0 p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Settings className="size-4" />
              </div>
              <SheetTitle className="text-lg font-semibold">
                Customizer
              </SheetTitle>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleReset}
                  className="cursor-pointer size-8"
                  title="Reset to defaults"
                >
                  <RotateCcw />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  className="cursor-pointer size-8"
                  title="Close customizer"
                >
                  <X />
                </Button>
              </div>
            </div>
            <SheetDescription className="text-sm text-muted-foreground sr-only">
              Customize the theme and layout of your dashboard.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="h-full flex flex-col"
            >
              <div className="py-2">
                <TabsList className="w-full rounded-none group-data-horizontal/tabs:h-10">
                  <TabsTrigger value="theme" className="cursor-pointer">
                    <Palette /> Theme
                  </TabsTrigger>
                  <TabsTrigger value="layout" className="cursor-pointer">
                    <Layout /> Layout
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="theme" className="flex-1 mt-0">
                <ThemeTab
                  selectedTheme={themeConfig.selectedTheme}
                  setSelectedTheme={(value) => applyTheme(value, isDarkMode)}
                  selectedTweakcnTheme={themeConfig.selectedTweakcnTheme}
                  setSelectedTweakcnTheme={(value) => {
                    const selectedPreset = tweakcnThemes.find(
                      (t) => t.value === value
                    )?.preset;
                    if (selectedPreset) {
                      applyTweakcnTheme(selectedPreset, value, isDarkMode);
                    }
                  }}
                  selectedRadius={themeConfig.selectedRadius}
                  setSelectedRadius={(radius) => applyRadius(radius)}
                  setImportedTheme={(themeData) => {
                    if (themeData) {
                      applyImportedTheme(themeData, isDarkMode);
                    } else {
                      resetTheme();
                    }
                  }}
                  onImportClick={handleImportClick}
                />
              </TabsContent>

              <TabsContent value="layout" className="flex-1 mt-0">
                <LayoutTab />
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      <ImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImport={handleImport}
      />
    </>
  );
}

// Floating trigger button - positioned dynamically based on sidebar side
export function ThemeCustomizerTrigger({ onClick }: { onClick: () => void }) {
  const { config: sidebarConfig } = useSidebarConfig();

  return (
    <Button
      onClick={onClick}
      size="icon"
      className={cn(
        "fixed top-1/2 -mt-6 size-12 rounded-full shadow-lg z-50 active:not-aria-[haspopup]:translate-y-0 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer",
        sidebarConfig.side === "left" ? "right-4" : "left-4"
      )}
    >
      <Settings className="size-5" />
    </Button>
  );
}
