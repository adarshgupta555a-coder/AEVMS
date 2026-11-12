"use client";

import * as React from "react";
import { create } from "zustand";

interface BreadcrumbStore {
  customTitle: string | null;
  setBreadcrumbTitle: (title: string | null) => void;
}

export const useBreadcrumbStore = create<BreadcrumbStore>((set) => ({
  customTitle: null,
  setBreadcrumbTitle: (title) => set({ customTitle: title }),
}));

/**
 * Hook to set a dynamic breadcrumb title for the current record
 * (e.g. Client Name, Invoice Number, Event Title).
 * Clears the custom title automatically when navigating away.
 */
export function useSetBreadcrumbTitle(title?: string | null) {
  const setBreadcrumbTitle = useBreadcrumbStore((s) => s.setBreadcrumbTitle);

  React.useEffect(() => {
    if (title && title.trim()) {
      setBreadcrumbTitle(title.trim());
    }
    return () => {
      setBreadcrumbTitle(null);
    };
  }, [title, setBreadcrumbTitle]);
}
