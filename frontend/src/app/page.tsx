"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function RootHomePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      router.replace("/login");
    } else if (user.role === "ADMIN") {
      router.replace("/dashboard");
    } else if (user.role === "CLIENT") {
      router.replace("/portal/dashboard");
    } else {
      router.replace("/login");
    }
  }, [user, isAuthenticated, isLoading, router]);

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
      </div>
    </div>
  );
}
