"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
import { useRequestCode, useUser, useVerifyCode } from "@/hooks/useUser";
import { getErrorMessage } from "@/lib/errorMessage";

/** Passwordless sign-in: enter your email, get a 6-digit code by email, enter
 * it. The session then lasts 400 days on this browser. */
export function AuthForm() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);
  const requestCode = useRequestCode();
  const verifyCode = useVerifyCode();
  const currentUser = useUser();
  useEffect(() => {
    if (currentUser.data) router.replace(applicationRoutes.dashboard);
  }, [currentUser.data, router]);

  function sendCode(e: React.FormEvent) {
    e.preventDefault();
    requestCode.mutate(email.trim(), {
      onSuccess: () => {
        setStep("code");
        setCode("");
      },
    });
  }

  function resendCode() {
    verifyCode.reset();
    requestCode.mutate(email.trim(), {
      onSuccess: () => {
        setCode("");
        setResent(true);
      },
    });
  }

  function changeEmail() {
    setStep("email");
    setCode("");
    setResent(false);
    requestCode.reset();
    verifyCode.reset();
  }

  function signIn(e: React.FormEvent) {
    e.preventDefault();
    verifyCode.mutate(
      { email: email.trim(), code },
      { onSuccess: () => router.push(applicationRoutes.dashboard) }
    );
  }

  const error =
    getErrorMessage(verifyCode, "Couldn't sign in. Try again.") ??
    getErrorMessage(requestCode, "Couldn't send the code. Try again.");

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-white lg:flex">
        <div
          aria-hidden
          className="absolute -right-32 -bottom-32 size-[28rem] rounded-full bg-primary/25 blur-3xl"
        />
        <div className="relative flex flex-col gap-1.5">
          <Image
            src="/extendout-logo.png"
            alt="ExtendOut Design | Build"
            width={621}
            height={182}
            priority
            className="h-auto w-56"
          />
          <span className="pl-1 text-xs uppercase tracking-[0.18em] text-white/50">
            Portal
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

      <div className="flex flex-col items-center justify-center gap-6 bg-muted px-4">
        {/* The dark panel with the full logo is hidden on small screens. */}
        <Image
          src="/extendout-mark.png"
          alt="ExtendOut"
          width={130}
          height={132}
          priority
          className="size-14 rounded-xl lg:hidden"
        />
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="font-heading text-xl">
              {step === "email" ? "Sign in" : "Check your email"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {step === "email" ? (
                "Enter your email and we'll send you a sign-in code."
              ) : (
                <>
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-foreground">
                    {email.trim()}
                  </span>
                  . It expires in 10 minutes.
                </>
              )}
            </p>
          </CardHeader>

          {step === "email" ? (
            <form onSubmit={sendCode}>
              <CardContent className="flex flex-col gap-4">
                <ErrorAlert message={error} />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!email.trim() || requestCode.isPending}
                >
                  {requestCode.isPending ? "Sending…" : "Send code"}
                </Button>
              </CardFooter>
            </form>
          ) : (
            <form onSubmit={signIn}>
              <CardContent className="flex flex-col gap-4">
                <ErrorAlert message={error} />
                {resent && !error && (
                  <p role="status" className="text-sm text-muted-foreground">
                    New code sent. Use the latest email.
                  </p>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    autoFocus
                    className="text-center text-lg tracking-[0.5em]"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={code.length !== 6 || verifyCode.isPending}
                >
                  {verifyCode.isPending ? "Signing in…" : "Sign in"}
                </Button>
                <div className="flex w-full justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={changeEmail}
                  >
                    Use a different email
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={requestCode.isPending}
                    onClick={resendCode}
                  >
                    {requestCode.isPending ? "Sending…" : "Send a new code"}
                  </Button>
                </div>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
