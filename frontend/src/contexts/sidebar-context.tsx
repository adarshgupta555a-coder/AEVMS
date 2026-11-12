"use client"

import * as React from "react"
import { SidebarContext, type SidebarConfig } from "@/contexts/sidebar-config"

const STORAGE_KEY = "ems_sidebar_layout_config"

const DEFAULT_CONFIG: SidebarConfig = {
  variant: "sidebar",
  collapsible: "icon",
  side: "left",
}

function getStoredConfig(): SidebarConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) }
    }
  } catch {
    // fallback
  }
  return DEFAULT_CONFIG
}

const listeners = new Set<() => void>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

let currentConfig = getStoredConfig()

function emitChange(newConfig: SidebarConfig) {
  currentConfig = newConfig
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig))
  } catch {
    // ignore storage errors
  }
  listeners.forEach((listener) => listener())
}

export function SidebarConfigProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const config = React.useSyncExternalStore(
    subscribe,
    () => currentConfig,
    () => DEFAULT_CONFIG
  )

  const updateConfig = React.useCallback(
    (newConfig: Partial<SidebarConfig>) => {
      emitChange({ ...currentConfig, ...newConfig })
    },
    []
  )

  const value = React.useMemo(
    () => ({ config, updateConfig }),
    [config, updateConfig]
  )

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  )
}
