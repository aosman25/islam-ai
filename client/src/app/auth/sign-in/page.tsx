"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthInput } from "@/components/auth/auth-input";
import { GoogleButton } from "@/components/auth/google-button";

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    setError("");
    setIsPending(true);

    // Try sign-in first
    try {
      const signInResult = await authClient.signIn.email({ email, password });
      if (!signInResult.error) {
        router.push("/chat");
        router.refresh();
        return;
      }
    } catch {
      // Sign-in failed (401) — expected for new users, fall through to sign-up
    }

    // User doesn't exist — try sign-up
    try {
      const signUpResult = await authClient.signUp.email({
        email,
        password,
        name: email.split("@")[0],
      });

      if (signUpResult.error) {
        setIsPending(false);
        setError(signUpResult.error.message || "Invalid email or password");
        return;
      }

      // New account — send verification OTP
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });

      setIsPending(false);
      router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
    } catch {
      // Sign-up also failed — user exists but wrong password
      setIsPending(false);
      setError("Invalid email or password");
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Welcome to Athars</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in or create an account to continue
          </p>
        </div>

        <GoogleButton />

        <div className="divider-diamond">
          <span className="diamond" />
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <AuthInput
            icon={Mail}
            label="Email"
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
          />

          <AuthInput
            icon={Lock}
            label="Password"
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="********"
          />

          <div className="flex justify-end">
            <Link
              href="/auth/forgot-password"
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive animate-fade-in">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending && <Loader2 size={16} className="animate-spin" />}
            {isPending ? "Please wait..." : "Continue"}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}
