"use client";

import * as React from "react";
import { useTheme } from "@/hooks/use-theme";
import { baseColors } from "@/config/theme-customizer-constants";
import { colorThemes, tweakcnThemes } from "@/config/theme-data";
import type { ThemePreset, ImportedTheme } from "@/types/theme-customizer";

export interface ThemeCustomizerConfig {
  selectedTheme: string;
  selectedTweakcnTheme: string;
  selectedRadius: string;
  importedTheme: ImportedTheme | null;
  brandColors: Record<string, string>;
}

export const DEFAULT_THEME_CUSTOMIZER_CONFIG: ThemeCustomizerConfig = {
  selectedTheme: "default",
  selectedTweakcnTheme: "",
  selectedRadius: "0.5rem",
  importedTheme: null,
  brandColors: {},
};

const STORAGE_KEY = "ems_theme_customizer_config";

export function getStoredThemeConfig(): ThemeCustomizerConfig {
  if (typeof window === "undefined") return DEFAULT_THEME_CUSTOMIZER_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_THEME_CUSTOMIZER_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return DEFAULT_THEME_CUSTOMIZER_CONFIG;
}

export function saveStoredThemeConfig(cfg: ThemeCustomizerConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

export function clearStoredThemeConfig(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Module-level reactive store for synchronization across all theme customizer consumers
let currentThemeConfig: ThemeCustomizerConfig = getStoredThemeConfig();
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function emitThemeConfigChange(newConfig: ThemeCustomizerConfig) {
  currentThemeConfig = newConfig;
  saveStoredThemeConfig(newConfig);
  listeners.forEach((listener) => listener());
}

export function resetCssVariables(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const allPossibleVars = [
    "background",
    "foreground",
    "card",
    "card-foreground",
    "popover",
    "popover-foreground",
    "primary",
    "primary-foreground",
    "secondary",
    "secondary-foreground",
    "muted",
    "muted-foreground",
    "accent",
    "accent-foreground",
    "destructive",
    "destructive-foreground",
    "border",
    "input",
    "ring",
    "radius",
    "chart-1",
    "chart-2",
    "chart-3",
    "chart-4",
    "chart-5",
    "sidebar",
    "sidebar-background",
    "sidebar-foreground",
    "sidebar-primary",
    "sidebar-primary-foreground",
    "sidebar-accent",
    "sidebar-accent-foreground",
    "sidebar-border",
    "sidebar-ring",
    "font-sans",
    "font-serif",
    "font-mono",
    "shadow-2xs",
    "shadow-xs",
    "shadow-sm",
    "shadow",
    "shadow-md",
    "shadow-lg",
    "shadow-xl",
    "shadow-2xl",
    "spacing",
    "tracking-normal",
    "card-header",
    "card-content",
    "card-footer",
    "muted-background",
    "accent-background",
    "destructive-background",
    "warning",
    "warning-foreground",
    "success",
    "success-foreground",
    "info",
    "info-foreground",
  ];

  allPossibleVars.forEach((varName) => {
    root.style.removeProperty(`--${varName}`);
  });

  const inlineStyles = root.style;
  for (let i = inlineStyles.length - 1; i >= 0; i--) {
    const property = inlineStyles[i];
    if (property.startsWith("--")) {
      root.style.removeProperty(property);
    }
  }
}

export function applyThemeConfigToDom(
  cfg: ThemeCustomizerConfig,
  darkMode: boolean
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // 1. If using default theme and no custom imported/tweakcn theme
  if (
    (!cfg.selectedTheme || cfg.selectedTheme === "default") &&
    !cfg.selectedTweakcnTheme &&
    !cfg.importedTheme
  ) {
    resetCssVariables();
    if (cfg.selectedRadius) {
      root.style.setProperty("--radius", cfg.selectedRadius);
    }
    if (cfg.brandColors && Object.keys(cfg.brandColors).length > 0) {
      Object.entries(cfg.brandColors).forEach(([key, val]) => {
        if (val) root.style.setProperty(key, val);
      });
    }
    return;
  }

  // 2. Reset existing custom variables before applying new preset
  resetCssVariables();

  // 3. If imported theme
  if (cfg.importedTheme) {
    const themeVars = darkMode
      ? cfg.importedTheme.dark
      : cfg.importedTheme.light;
    if (themeVars) {
      Object.entries(themeVars).forEach(([k, v]) => {
        root.style.setProperty(`--${k}`, v);
      });
    }
  }
  // 4. If shadcn color preset
  else if (cfg.selectedTheme && cfg.selectedTheme !== "default") {
    const selected = colorThemes.find((t) => t.value === cfg.selectedTheme);
    if (selected) {
      const styles = darkMode
        ? selected.preset.styles.dark
        : selected.preset.styles.light;
      Object.entries(styles).forEach(([k, v]) => {
        root.style.setProperty(`--${k}`, v);
      });
    }
  }
  // 5. If tweakcn preset
  else if (cfg.selectedTweakcnTheme) {
    const selected = tweakcnThemes.find(
      (t) => t.value === cfg.selectedTweakcnTheme
    );
    if (selected) {
      const styles = darkMode
        ? selected.preset.styles.dark
        : selected.preset.styles.light;
      Object.entries(styles).forEach(([k, v]) => {
        root.style.setProperty(`--${k}`, v);
      });
    }
  }

  // 6. Apply radius
  if (cfg.selectedRadius) {
    root.style.setProperty("--radius", cfg.selectedRadius);
  }

  // 7. Apply custom brand color overrides
  if (cfg.brandColors && Object.keys(cfg.brandColors).length > 0) {
    Object.entries(cfg.brandColors).forEach(([key, val]) => {
      if (val) root.style.setProperty(key, val);
    });
  }
}

export function useThemeManager() {
  const { theme, setTheme } = useTheme();
  const config = React.useSyncExternalStore(
    subscribe,
    () => currentThemeConfig,
    () => DEFAULT_THEME_CUSTOMIZER_CONFIG
  );

  const isDarkMode = React.useMemo(() => {
    if (theme === "dark") return true;
    if (theme === "light") return false;
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  }, [theme]);

  // Apply saved theme on mount and whenever config or darkMode changes
  React.useEffect(() => {
    applyThemeConfigToDom(config, isDarkMode);
  }, [config, isDarkMode]);

  const resetTheme = React.useCallback(() => {
    clearStoredThemeConfig();
    emitThemeConfigChange(DEFAULT_THEME_CUSTOMIZER_CONFIG);
    resetCssVariables();
    applyThemeConfigToDom(DEFAULT_THEME_CUSTOMIZER_CONFIG, isDarkMode);
  }, [isDarkMode]);

  const applyTheme = React.useCallback(
    (themeValue: string, darkMode: boolean) => {
      const newConfig: ThemeCustomizerConfig = {
        ...currentThemeConfig,
        selectedTheme: themeValue,
        selectedTweakcnTheme: "",
        importedTheme: null,
        brandColors: {},
      };
      emitThemeConfigChange(newConfig);
      applyThemeConfigToDom(newConfig, darkMode);
    },
    []
  );

  const applyTweakcnTheme = React.useCallback(
    (
      themePreset: ThemePreset,
      themeValueOrDarkMode: string | boolean,
      maybeDarkMode?: boolean
    ) => {
      let val = "";
      let dark = false;
      if (typeof themeValueOrDarkMode === "string") {
        val = themeValueOrDarkMode;
        dark = Boolean(maybeDarkMode);
      } else {
        dark = Boolean(themeValueOrDarkMode);
        const match = tweakcnThemes.find((t) => t.preset === themePreset);
        val = match?.value || "";
      }

      const newConfig: ThemeCustomizerConfig = {
        ...currentThemeConfig,
        selectedTweakcnTheme: val,
        selectedTheme: "",
        importedTheme: null,
        brandColors: {},
      };
      emitThemeConfigChange(newConfig);
      applyThemeConfigToDom(newConfig, dark);
    },
    []
  );

  const applyImportedTheme = React.useCallback(
    (themeData: ImportedTheme, darkMode: boolean) => {
      const newConfig: ThemeCustomizerConfig = {
        ...currentThemeConfig,
        importedTheme: themeData,
        selectedTheme: "",
        selectedTweakcnTheme: "",
      };
      emitThemeConfigChange(newConfig);
      applyThemeConfigToDom(newConfig, darkMode);
    },
    []
  );

  const applyRadius = React.useCallback((radius: string) => {
    const newConfig: ThemeCustomizerConfig = {
      ...currentThemeConfig,
      selectedRadius: radius,
    };
    emitThemeConfigChange(newConfig);
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--radius", radius);
    }
  }, []);

  const handleColorChange = React.useCallback(
    (cssVar: string, value: string) => {
      const newBrandColors = {
        ...currentThemeConfig.brandColors,
        [cssVar]: value,
      };
      const newConfig: ThemeCustomizerConfig = {
        ...currentThemeConfig,
        brandColors: newBrandColors,
      };
      emitThemeConfigChange(newConfig);
      if (typeof document !== "undefined") {
        document.documentElement.style.setProperty(cssVar, value);
      }
    },
    []
  );

  const setBrandColorsValues = React.useCallback(
    (newValues: Record<string, string>) => {
      const newConfig: ThemeCustomizerConfig = {
        ...currentThemeConfig,
        brandColors: newValues,
      };
      emitThemeConfigChange(newConfig);
    },
    []
  );

  const updateBrandColorsFromTheme = React.useCallback(
    (styles: Record<string, string>) => {
      const newValues: Record<string, string> = {};
      baseColors.forEach((color) => {
        const cssVar = color.cssVar.replace("--", "");
        if (styles[cssVar]) {
          newValues[color.cssVar] = styles[cssVar];
        }
      });
      setBrandColorsValues(newValues);
    },
    [setBrandColorsValues]
  );

  return {
    theme,
    setTheme,
    isDarkMode,
    config,
    brandColorsValues: config.brandColors,
    setBrandColorsValues,
    resetTheme,
    applyTheme,
    applyTweakcnTheme,
    applyImportedTheme,
    applyRadius,
    handleColorChange,
    updateBrandColorsFromTheme,
  };
}
