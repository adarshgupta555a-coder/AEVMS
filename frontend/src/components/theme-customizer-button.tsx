"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Palette } from "lucide-react";
import { openThemeCustomizer } from "@/components/theme-customizer-wrapper";

export function ThemeCustomizerButton({
  variant = "outline",
  size = "sm",
  className,
}: {
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
}) {
  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={openThemeCustomizer}
      title="Open Shadcn Theme Customizer"
    >
      <Palette className="size-4" />
      {size !== "icon" && <span>Theme Customizer</span>}
    </Button>
  );
}
