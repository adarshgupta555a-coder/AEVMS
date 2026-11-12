"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { useCurrentUser } from "@/features/auth/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";

const ADMIN_ROUTE_PREFIXES = [
  "/(admin)",
  "/dashboard",
  "/clients",
  "/events",
  "/quotations",
  "/invoices",
  "/payments",
  "/calendar",
  "/inventory",
  "/expenses",
  "/tie-ups",
];

const CLIENT_ROUTE_PREFIXES = ["/(client)", "/portal"];

const PUBLIC_ROUTES = ["/", "/login", "/activate-portal"];

export function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isClientRoute(pathname: string): boolean {
  return CLIENT_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/activate-portal")
  );
}

function AuthLoadingSkeleton() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center max-w-sm w-full space-y-6">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-pulse">
          <Sparkles className="size-6 animate-spin duration-1000" />
        </div>
        <div className="space-y-2 text-center w-full">
          <Skeleton className="h-5 w-48 mx-auto" />
          <Skeleton className="h-3.5 w-64 mx-auto" />
        </div>
        <div className="w-full space-y-3 pt-2">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

const emptySubscribe = () => () => {};

function useMounted() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const hasMounted = useMounted();

  // Restore session via TanStack Query on mount
  const { isLoading: isQueryLoading } = useCurrentUser();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isStoreLoading = useAuthStore((s) => s.isLoading);

  const isResolving = isStoreLoading || isQueryLoading;

  React.useEffect(() => {
    if (!hasMounted || isResolving) return;

    const isAdminPath = isAdminRoute(pathname);
    const isClientPath = isClientRoute(pathname);
    const isAuthPath =
      pathname === "/login" ||
      pathname.startsWith("/login") ||
      pathname === "/activate-portal" ||
      pathname.startsWith("/activate-portal");

    // Case 1: Unauthenticated user attempting to access protected route
    if (!isAuthenticated || !user) {
      if (isAdminPath || isClientPath) {
        router.replace("/login");
      }
      return;
    }

    // Case 2: Authenticated user attempting to visit login or activation page
    if (isAuthPath) {
      if (user.role === "ADMIN") {
        router.replace("/dashboard");
      } else if (user.role === "CLIENT") {
        router.replace("/portal/dashboard");
      }
      return;
    }

    // Case 3: Role boundary enforcement
    if (isAdminPath && user.role !== "ADMIN") {
      // Non-admin attempting to access admin route
      router.replace("/portal/dashboard");
      return;
    }

    if (isClientPath && user.role !== "CLIENT") {
      // Non-client attempting to access client portal route
      router.replace("/dashboard");
      return;
    }
  }, [hasMounted, isResolving, isAuthenticated, user, pathname, router]);

  // While mounting or resolving session on protected routes, show subtle loading skeleton
  if (!hasMounted) {
    return <AuthLoadingSkeleton />;
  }

  const isAdminPath = isAdminRoute(pathname);
  const isClientPath = isClientRoute(pathname);

  if (isResolving && (isAdminPath || isClientPath)) {
    return <AuthLoadingSkeleton />;
  }

  // If unauthenticated on protected route after session resolution, keep skeleton while redirecting
  if (!isResolving && (!isAuthenticated || !user) && (isAdminPath || isClientPath)) {
    return <AuthLoadingSkeleton />;
  }

  // If role mismatch on protected route after session resolution, keep skeleton while redirecting
  if (!isResolving && isAuthenticated && user) {
    if (isAdminPath && user.role !== "ADMIN") {
      return <AuthLoadingSkeleton />;
    }
    if (isClientPath && user.role !== "CLIENT") {
      return <AuthLoadingSkeleton />;
    }
  }

  return <>{children}</>;
}
