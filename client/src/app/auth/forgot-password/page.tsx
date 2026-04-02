"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, KeyRound, Loader2, ArrowLeft } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthInput } from "@/components/auth/auth-input";

type Step = "email" | "reset";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (!email) return;

    setError("");
    setIsLoading(true);

    const { error } = await authClient.forgetPassword.emailOtp({ email });

    setIsLoading(false);

    if (error) {
      setError(error.message || "Failed to send reset code");
      return;
    }

    setStep("reset");
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (!otp || !password) return;

    setError("");
    setIsLoading(true);

    const { error } = await authClient.emailOtp.resetPassword({
      email,
      otp,
      password,
    });

    setIsLoading(false);

    if (error) {
      setError(error.message || "Failed to reset password");
      return;
    }

    router.push("/auth/sign-in");
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound size={24} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {step === "email" ? "Reset your password" : "Enter new password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === "email"
              ? "We'll send a verification code to your email"
              : `Enter the code sent to ${email}`}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleSendOtp} noValidate className="space-y-4">
            <AuthInput
              icon={Mail}
              label="Email"
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive animate-fade-in">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !email}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading && <Loader2 size={16} className="animate-spin" />}
              {isLoading ? "Sending..." : "Send Reset Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="otp" className="block text-sm font-medium text-foreground">
                Verification code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter code"
                className="w-full rounded-lg border border-input bg-card py-2.5 px-4 text-center text-lg tracking-widest text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>

            <AuthInput
              icon={Lock}
              label="New password"
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
            />

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive animate-fade-in">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !otp || !password}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading && <Loader2 size={16} className="animate-spin" />}
              {isLoading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        <p className="text-center">
          <Link
            href="/auth/sign-in"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} />
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
