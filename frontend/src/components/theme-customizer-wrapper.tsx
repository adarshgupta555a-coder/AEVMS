"use client";

import * as React from "react";
import {
  ThemeCustomizer,
  ThemeCustomizerTrigger,
} from "@/components/theme-customizer";

export function openThemeCustomizer() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-theme-customizer"));
  }
}

export function ThemeCustomizerWrapper() {
  const [open, setOpen] = React.useState(false);
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-theme-customizer", handler);
    return () => window.removeEventListener("open-theme-customizer", handler);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <ThemeCustomizerTrigger onClick={() => setOpen(true)} />
      <ThemeCustomizer open={open} onOpenChange={setOpen} />
    </>
  );
}
