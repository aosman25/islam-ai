"use client";

import Link from "next/link";
import Image from "next/image";
import { GeometricPattern } from "@/components/ui/geometric-pattern";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12 overflow-hidden">
      {/* Geometric background */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]">
        <GeometricPattern />
      </div>

      {/* Decorative gradient orbs */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />

      {/* Corner accents */}
      <svg className="pointer-events-none absolute top-0 left-0 h-40 w-40 text-primary/10" viewBox="0 0 160 160">
        <path d="M0,0 L160,0 L0,160 Z" fill="currentColor" />
        <line x1="0" y1="0" x2="120" y2="0" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        <line x1="0" y1="0" x2="0" y2="120" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      </svg>
      <svg className="pointer-events-none absolute bottom-0 right-0 h-40 w-40 text-primary/10 rotate-180" viewBox="0 0 160 160">
        <path d="M0,0 L160,0 L0,160 Z" fill="currentColor" />
        <line x1="0" y1="0" x2="120" y2="0" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        <line x1="0" y1="0" x2="0" y2="120" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      </svg>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <Link href="/" className="mb-8 flex justify-center">
          <Image
            src="/logos/logo_en.png"
            alt="Athars"
            width={140}
            height={46}
            className="h-10 w-auto dark:invert"
            priority
          />
        </Link>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card/80 p-6 shadow-lg backdrop-blur-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
