"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "../services/auth.service";
import { LoginInput, ActivatePortalInput } from "../schemas/auth.schema";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Hook to retrieve and cache the currently authenticated user
 */
export function useCurrentUser() {
  const setUser = useAuthStore((s) => s.setUser);
  const clearSession = useAuthStore((s) => s.clearSession);
  const setLoading = useAuthStore((s) => s.setLoading);

  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        const data = await authService.getCurrentUser();
        setUser(data.user);
        return data;
      } catch (error) {
        clearSession();
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  React.useEffect(() => {
    if (query.data?.user) {
      setUser(query.data.user);
    } else if (query.isError) {
      clearSession();
    }
    if (!query.isLoading) {
      setLoading(false);
    }
  }, [
    query.data,
    query.isError,
    query.isLoading,
    setUser,
    clearSession,
    setLoading,
  ]);

  return query;
}

/**
 * Mutation hook for standard email/password authentication
 */
export function useLoginMutation() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (payload: LoginInput) => authService.login(payload),
    onSuccess: (data) => {
      setUser(data.user);
      queryClient.setQueryData(["auth", "me"], { user: data.user });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}

/**
 * Mutation hook to log out and clear all client caches & session cookies
 */
export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((s) => s.clearSession);
  const router = useRouter();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      clearSession();
      queryClient.clear();
      router.push("/login");
    },
    onError: () => {
      clearSession();
      queryClient.clear();
      router.push("/login");
    },
  });
}

/**
 * Mutation hook for first-time client portal password activation
 */
export function useActivatePortalMutation() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (payload: ActivatePortalInput) =>
      authService.activatePortal(payload),
    onSuccess: (data) => {
      setUser(data.user);
      queryClient.setQueryData(["auth", "me"], { user: data.user });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}

/**
 * Unified auth helper hook for components
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const logoutMutation = useLogoutMutation();

  return {
    user,
    isAuthenticated,
    isLoading,
    isAdmin: user?.role === "ADMIN",
    isClient: user?.role === "CLIENT",
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
