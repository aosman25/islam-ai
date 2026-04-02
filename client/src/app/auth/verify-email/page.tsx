"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Mail, ShieldCheck, Loader2, RotateCw } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { AuthLayout } from "@/components/auth/auth-layout";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "";

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !email) return;

    setError("");
    setIsVerifying(true);

    const { error } = await authClient.emailOtp.verifyEmail({ email, otp });

    setIsVerifying(false);

    if (error) {
      setError(error.message || "Invalid verification code");
      return;
    }

    router.push("/chat");
    router.refresh();
  };

  const handleResend = async () => {
    if (!email) return;

    setIsResending(true);
    setError("");

    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });

    setIsResending(false);

    if (error) {
      setError(error.message || "Failed to resend code");
      return;
    }

    setResent(true);
    setTimeout(() => setResent(false), 3000);
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck size={24} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Verify your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a verification code to
          </p>
          {email && (
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm font-medium text-foreground">
              <Mail size={14} className="text-muted-foreground" />
              {email}
            </p>
          )}
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
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

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive animate-fade-in">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isVerifying || !otp}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isVerifying && <Loader2 size={16} className="animate-spin" />}
            {isVerifying ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={handleResend}
            disabled={isResending}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RotateCw size={14} className={isResending ? "animate-spin" : ""} />
            {resent ? "Code sent!" : "Resend code"}
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
