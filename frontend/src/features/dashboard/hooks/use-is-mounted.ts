"use client";

import * as React from "react";

const emptySubscribe = () => () => {};

/**
 * React 19 idiomatic hook to determine if component is mounted on the client.
 * Uses useSyncExternalStore to avoid synchronous setState inside useEffect.
 */
export function useIsMounted(): boolean {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
