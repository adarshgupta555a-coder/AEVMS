"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { loginSchema, LoginInput } from "@/features/auth/schemas/auth.schema";
import { useLoginMutation } from "@/features/auth/hooks/use-auth";
import { extractErrorMessage } from "@/lib/utils";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSessionExpired = searchParams.get("session_expired") === "true";

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useLoginMutation();

  const onSubmit = (values: LoginInput) => {
    loginMutation.mutate(values, {
      onSuccess: (data) => {
        toast.success(`Welcome back, ${data.user.name}`);
        if (data.user.role === "ADMIN") {
          router.push("/dashboard");
        } else {
          router.push("/portal/dashboard");
        }
      },
      onError: (err) => {
        toast.error(extractErrorMessage(err, "Invalid email or password"));
      },
    });
  };

  const handleDemoFill = (email: string, pass: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", pass, { shouldValidate: true });
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="size-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Sign in to EMS
        </h1>
        <p className="text-xs text-muted-foreground">
          Enter your credentials to access the Event Management Platform
        </p>
      </div>

      {/* Session Expired Alert */}
      {isSessionExpired && (
        <div
          role="alert"
          className="flex items-center gap-2.5 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs shadow-xs"
        >
          <AlertCircle className="size-4 shrink-0 text-amber-500" />
          <span>Your session has expired. Please sign in again.</span>
        </div>
      )}

      {/* Login Card */}
      <Card className="border-border/80 shadow-md">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Authentication</CardTitle>
          <CardDescription className="text-xs">
            Sign in with your verified administrator or client credentials
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted-foreground" />
                Email or Username
              </Label>
              <Input
                id="email"
                type="text"
                placeholder="admin.ems or admin@ems.local"
                className="text-xs"
                autoComplete="username"
                disabled={loginMutation.isPending}
                {...register("email")}
              />
              {errors.email?.message && (
                <p className="text-[11px] text-destructive font-medium">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs flex items-center gap-1.5"
                >
                  <Lock className="size-3.5 text-muted-foreground" />
                  Password
                </Label>
                <span className="text-[11px] text-primary hover:underline cursor-pointer">
                  Forgot password?
                </span>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="text-xs"
                autoComplete="current-password"
                disabled={loginMutation.isPending}
                {...register("password")}
              />
              {errors.password?.message && (
                <p className="text-[11px] text-destructive font-medium">
                  {errors.password.message}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              className="w-full gap-2 text-xs font-semibold"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>

            {/* Demo Credentials Section */}
            <div className="w-full space-y-2 pt-2 border-t border-border/60">
              <p className="text-[11px] font-medium text-muted-foreground text-center">
                Quick Demo Autofill
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    handleDemoFill("admin.ems", "ems")
                  }
                  disabled={loginMutation.isPending}
                  className="text-[11px]"
                >
                  Admin (admin.ems)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    handleDemoFill("admin@ems.local", "Admin@123456")
                  }
                  disabled={loginMutation.isPending}
                  className="text-[11px]"
                >
                  Admin (admin@ems.local)
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mt-1">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              <span>Secured with JWT HTTP-only cookies</span>
            </div>
          </CardFooter>
        </form>
      </Card>

      {/* Direct Helpers */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <Link
          href="/"
          className="hover:text-primary transition-colors underline underline-offset-4"
        >
          Return to Home
        </Link>
        <span>&bull;</span>
        <Link
          href="/activate-portal"
          className="hover:text-primary transition-colors underline underline-offset-4"
        >
          Activate Portal Account
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/20">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <React.Suspense
        fallback={
          <div className="flex items-center justify-center p-8">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        }
      >
        <LoginForm />
      </React.Suspense>
    </div>
  );
}
