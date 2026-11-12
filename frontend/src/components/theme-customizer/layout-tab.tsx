"use client"

import * as React from "react"
import {
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { useSidebarConfig } from "@/hooks/use-sidebar-config"
import { useSidebar } from "@/components/ui/sidebar"
import {
  sidebarVariants,
  sidebarCollapsibleOptions,
  sidebarSideOptions,
} from "@/config/theme-customizer-constants"
import { cn } from "@/lib/utils"

export function LayoutTab() {
  const { config: sidebarConfig, updateConfig: updateSidebarConfig } =
    useSidebarConfig()
  const { setOpen } = useSidebar()

  // Sidebar handler functions
  const handleSidebarVariantSelect = (
    variant: "sidebar" | "floating" | "inset"
  ) => {
    updateSidebarConfig({ variant })
  }

  const handleSidebarCollapsibleSelect = (
    collapsible: "offcanvas" | "icon" | "none"
  ) => {
    updateSidebarConfig({ collapsible })

    // Auto-adjust open state so user immediately sees the selected mode
    if (collapsible === "icon") {
      setOpen(false)
    } else {
      setOpen(true)
    }
  }

  const handleSidebarSideSelect = (side: "left" | "right") => {
    updateSidebarConfig({ side })
  }

  return (
    <div className="flex flex-col p-4 gap-6">
      {/* Sidebar Configuration */}
      <FieldSet>
        <FieldLegend variant="label">Sidebar Variant</FieldLegend>
        {sidebarConfig.variant && (
          <FieldDescription>
            {sidebarConfig.variant === "sidebar" &&
              "Default: Standard edge-to-edge sidebar layout"}
            {sidebarConfig.variant === "floating" &&
              "Floating: Modern floating island sidebar with border"}
            {sidebarConfig.variant === "inset" &&
              "Inset: Inset sidebar with card layout and rounded corners"}
          </FieldDescription>
        )}
        <RadioGroup
          value={sidebarConfig.variant}
          onValueChange={(value) =>
            handleSidebarVariantSelect(
              value as "sidebar" | "floating" | "inset"
            )
          }
          className="grid grid-cols-3 gap-3"
        >
          {sidebarVariants.map((variant) => {
            const isSelected = sidebarConfig.variant === variant.value
            return (
              <FieldLabel
                key={variant.value}
                htmlFor={`sidebar-variant-${variant.value}`}
                onClick={() => handleSidebarVariantSelect(variant.value)}
                className={cn(
                  "relative w-full cursor-pointer flex-col items-stretch gap-0 rounded-md border border-border p-3 transition-all hover:border-border/80",
                  isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary dark:border-primary dark:bg-primary/15"
                    : "hover:bg-muted/40"
                )}
              >
                <RadioGroupItem
                  id={`sidebar-variant-${variant.value}`}
                  value={variant.value}
                  className="sr-only absolute"
                />
                {/* Visual representation of sidebar variant */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{variant.name}</span>
                    {isSelected && (
                      <span className="size-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "flex h-12 rounded border",
                      variant.value === "inset" ? "bg-muted" : "bg-background"
                    )}
                  >
                    {/* Sidebar representation */}
                    <div
                      className={cn(
                        "w-3 flex-shrink-0 bg-muted flex flex-col gap-0.5 p-1",
                        variant.value === "floating"
                          ? "border-r m-1 rounded shadow-xs"
                          : variant.value === "inset"
                            ? "m-1 ms-0 rounded bg-muted/80"
                            : "border-r"
                      )}
                    >
                      <div className="h-0.5 w-full bg-foreground/60 rounded"></div>
                      <div className="h-0.5 w-3/4 bg-foreground/50 rounded"></div>
                      <div className="h-0.5 w-2/3 bg-foreground/40 rounded"></div>
                    </div>
                    {/* Main content area */}
                    <div
                      className={cn(
                        "flex-1",
                        variant.value === "inset"
                          ? "bg-background ms-0"
                          : "bg-background/50",
                        "m-1 rounded-sm border-dashed border border-muted-foreground/20"
                      )}
                    />
                  </div>
                </div>
              </FieldLabel>
            )
          })}
        </RadioGroup>
      </FieldSet>

      <Separator />

      {/* Sidebar Collapsible Mode */}
      <FieldSet>
        <FieldLegend variant="label">Sidebar Collapsible Mode</FieldLegend>
        {sidebarConfig.collapsible && (
          <FieldDescription>
            {sidebarConfig.collapsible === "offcanvas" &&
              "Off Canvas: Slides completely out of view on toggle"}
            {sidebarConfig.collapsible === "icon" &&
              "Icon: Collapses to an icon-only quick access rail"}
            {sidebarConfig.collapsible === "none" &&
              "None: Always fully visible and non-collapsible"}
          </FieldDescription>
        )}
        <RadioGroup
          value={sidebarConfig.collapsible}
          onValueChange={(value) =>
            handleSidebarCollapsibleSelect(
              value as "offcanvas" | "icon" | "none"
            )
          }
          className="grid grid-cols-3 gap-3"
        >
          {sidebarCollapsibleOptions.map((option) => {
            const isSelected = sidebarConfig.collapsible === option.value
            return (
              <FieldLabel
                key={option.value}
                htmlFor={`sidebar-collapsible-${option.value}`}
                onClick={() => handleSidebarCollapsibleSelect(option.value)}
                className={cn(
                  "relative w-full cursor-pointer flex-col items-stretch gap-0 rounded-md border border-border p-3 transition-all hover:border-border/80",
                  isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary dark:border-primary dark:bg-primary/15"
                    : "hover:bg-muted/40"
                )}
              >
                <RadioGroupItem
                  id={`sidebar-collapsible-${option.value}`}
                  value={option.value}
                  className="sr-only absolute"
                />
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{option.name}</span>
                    {isSelected && (
                      <span className="size-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex h-12 rounded border bg-background">
                    {option.value === "offcanvas" ? (
                      <div className="flex-1 bg-background/50 m-1 rounded-sm border-dashed border border-muted-foreground/20 flex items-center justify-start pl-2">
                        <div className="flex flex-col gap-0.5">
                          <div className="w-3 h-0.5 bg-foreground/60 rounded"></div>
                          <div className="w-3 h-0.5 bg-foreground/60 rounded"></div>
                          <div className="w-3 h-0.5 bg-foreground/60 rounded"></div>
                        </div>
                      </div>
                    ) : option.value === "icon" ? (
                      <>
                        <div className="w-4 flex-shrink-0 bg-muted flex flex-col gap-1 p-1 border-r items-center">
                          <div className="size-1.5 bg-foreground/60 rounded-xs"></div>
                          <div className="size-1.5 bg-foreground/40 rounded-xs"></div>
                          <div className="size-1.5 bg-foreground/30 rounded-xs"></div>
                        </div>
                        <div className="flex-1 bg-background/50 m-1 rounded-sm border-dashed border border-muted-foreground/20" />
                      </>
                    ) : (
                      <>
                        <div className="w-5 flex-shrink-0 bg-muted flex flex-col gap-0.5 p-1 border-r">
                          <div className="h-0.5 w-full bg-foreground/60 rounded"></div>
                          <div className="h-0.5 w-3/4 bg-foreground/50 rounded"></div>
                          <div className="h-0.5 w-2/3 bg-foreground/40 rounded"></div>
                        </div>
                        <div className="flex-1 bg-background/50 m-1 rounded-sm border-dashed border border-muted-foreground/20" />
                      </>
                    )}
                  </div>
                </div>
              </FieldLabel>
            )
          })}
        </RadioGroup>
      </FieldSet>

      <Separator />

      {/* Sidebar Side */}
      <FieldSet>
        <FieldLegend variant="label">Sidebar Position</FieldLegend>
        {sidebarConfig.side && (
          <FieldDescription>
            {sidebarConfig.side === "left" &&
              "Left: Sidebar positioned on the left side (standard)"}
            {sidebarConfig.side === "right" &&
              "Right: Sidebar positioned on the right side"}
          </FieldDescription>
        )}
        <RadioGroup
          value={sidebarConfig.side}
          onValueChange={(value) =>
            handleSidebarSideSelect(value as "left" | "right")
          }
          className="grid grid-cols-2 gap-3"
        >
          {sidebarSideOptions.map((side) => {
            const isSelected = sidebarConfig.side === side.value
            return (
              <FieldLabel
                key={side.value}
                htmlFor={`sidebar-side-${side.value}`}
                onClick={() => handleSidebarSideSelect(side.value)}
                className={cn(
                  "relative w-full cursor-pointer flex-col items-stretch gap-0 rounded-md border border-border p-3 transition-all hover:border-border/80",
                  isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary dark:border-primary dark:bg-primary/15"
                    : "hover:bg-muted/40"
                )}
              >
                <RadioGroupItem
                  id={`sidebar-side-${side.value}`}
                  value={side.value}
                  className="sr-only absolute"
                />
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{side.name}</span>
                    {isSelected && (
                      <span className="size-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex h-12 rounded border bg-background">
                    {side.value === "left" ? (
                      <>
                        <div className="w-5 flex-shrink-0 bg-muted flex flex-col gap-0.5 p-1 border-r">
                          <div className="h-0.5 w-full bg-foreground/60 rounded"></div>
                          <div className="h-0.5 w-3/4 bg-foreground/50 rounded"></div>
                          <div className="h-0.5 w-2/3 bg-foreground/40 rounded"></div>
                        </div>
                        <div className="flex-1 bg-background/50 m-1 rounded-sm border-dashed border border-muted-foreground/20" />
                      </>
                    ) : (
                      <>
                        <div className="flex-1 bg-background/50 m-1 rounded-sm border-dashed border border-muted-foreground/20" />
                        <div className="w-5 flex-shrink-0 bg-muted flex flex-col gap-0.5 p-1 border-l">
                          <div className="h-0.5 w-full bg-foreground/60 rounded"></div>
                          <div className="h-0.5 w-3/4 bg-foreground/50 rounded"></div>
                          <div className="h-0.5 w-2/3 bg-foreground/40 rounded"></div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </FieldLabel>
            )
          })}
        </RadioGroup>
      </FieldSet>
    </div>
  )
}
