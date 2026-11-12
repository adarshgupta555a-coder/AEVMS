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
import { Sparkles, KeyRound, ArrowRight, Loader2, Lock, Key } from "lucide-react";
import {
  activatePortalSchema,
  ActivatePortalInput,
} from "@/features/auth/schemas/auth.schema";
import { useActivatePortalMutation } from "@/features/auth/hooks/use-auth";
import { extractErrorMessage } from "@/lib/utils";

function ActivatePortalForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ActivatePortalInput>({
    resolver: zodResolver(activatePortalSchema),
    defaultValues: {
      token: tokenFromUrl,
      password: "",
      confirmPassword: "",
    },
  });

  React.useEffect(() => {
    if (tokenFromUrl) {
      setValue("token", tokenFromUrl, { shouldValidate: true });
    }
  }, [tokenFromUrl, setValue]);

  const activateMutation = useActivatePortalMutation();

  const onSubmit = (values: ActivatePortalInput) => {
    activateMutation.mutate(values, {
      onSuccess: () => {
        toast.success("Portal activated successfully!");
        router.push("/portal/dashboard");
      },
      onError: (err) => {
        toast.error(
          extractErrorMessage(err, "Failed to activate portal account")
        );
      },
    });
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="size-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Activate Client Portal
        </h1>
        <p className="text-xs text-muted-foreground">
          Set your password to activate your self-service event portal
        </p>
      </div>

      {/* Activation Card */}
      <Card className="border-border/80 shadow-md">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Account Activation</CardTitle>
          <CardDescription className="text-xs">
            Enter your invitation token and create a secure password
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="token" className="text-xs flex items-center gap-1.5">
                <Key className="size-3.5 text-muted-foreground" />
                Activation Token
              </Label>
              <Input
                id="token"
                placeholder="Paste token from invitation email"
                className="text-xs font-mono"
                disabled={activateMutation.isPending}
                {...register("token")}
              />
              {errors.token?.message && (
                <p className="text-[11px] text-destructive font-medium">
                  {errors.token.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs flex items-center gap-1.5">
                <Lock className="size-3.5 text-muted-foreground" />
                Create New Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimum 8 characters"
                className="text-xs"
                autoComplete="new-password"
                disabled={activateMutation.isPending}
                {...register("password")}
              />
              {errors.password?.message && (
                <p className="text-[11px] text-destructive font-medium">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="confirmPassword"
                className="text-xs flex items-center gap-1.5"
              >
                <Lock className="size-3.5 text-muted-foreground" />
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                className="text-xs"
                autoComplete="new-password"
                disabled={activateMutation.isPending}
                {...register("confirmPassword")}
              />
              {errors.confirmPassword?.message && (
                <p className="text-[11px] text-destructive font-medium">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              className="w-full gap-2 text-xs font-semibold"
              disabled={activateMutation.isPending}
            >
              {activateMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Activating Account...
                </>
              ) : (
                <>
                  <KeyRound className="size-3.5" />
                  Activate & Sign In
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Footer Navigation */}
      <div className="text-center text-xs text-muted-foreground">
        Already activated?{" "}
        <Link
          href="/login"
          className="text-primary hover:underline font-medium underline-offset-4"
        >
          Sign in to your account
        </Link>
      </div>
    </div>
  );
}

export default function ActivatePortalPage() {
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
        <ActivatePortalForm />
      </React.Suspense>
    </div>
  );
}
