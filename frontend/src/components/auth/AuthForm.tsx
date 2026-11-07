"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { applicationRoutes } from "@/utils/applicationRoutes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useLogin } from "@/hooks/useUser";
import { getErrorMessage } from "@/lib/errorMessage";

export function AuthForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = useLogin();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    loginMutation.mutate(
      { email, password },
      { onSuccess: () => router.push(applicationRoutes.dashboard) }
    );
  }

  const error = getErrorMessage(loginMutation, "An unexpected error occurred.");

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-white lg:flex">
        <div
          aria-hidden
          className="absolute -right-32 -bottom-32 size-[28rem] rounded-full bg-primary/25 blur-3xl"
        />
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-md bg-primary font-heading text-sm font-bold">
            EO
          </span>
          <span className="font-heading text-lg font-semibold tracking-wide">
            ExtendOut <span className="font-normal text-white/60">Portal</span>
          </span>
        </div>
        <div className="relative flex max-w-md flex-col gap-4">
          <h1 className="font-heading text-4xl leading-tight font-semibold">
            Your build, <span className="text-primary">in one place.</span>
          </h1>
          <p className="text-white/70">
            Plans, progress photos and documents for every ExtendOut extension,
            loft conversion and renovation.
          </p>
        </div>
        <span className="relative text-xs text-white/40">
          ExtendOut Design &amp; Build · Surrey &amp; London
        </span>
      </section>

      <div className="flex items-center justify-center bg-muted px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Sign in</CardTitle>
            <p className="text-sm text-muted-foreground">
              Welcome back to the ExtendOut Portal.
            </p>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-4">
              <ErrorAlert message={error} />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
              >
                Sign in
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  );
}
