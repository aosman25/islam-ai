"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Search,
  MessageSquare,
  BookOpen,
  Menu,
  X,
} from "lucide-react";

const NAV_LINKS = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/books", label: "Library", icon: BookOpen },
  { href: "/search", label: "Search", icon: Search },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      {/* Gold accent line */}
      <div className="accent-line" />

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-page">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center shadow-soft group-hover:shadow-glow transition-shadow duration-300">
              <span className="text-white font-display text-lg font-bold leading-none">
                A
              </span>
            </div>
          </div>
          <span className="font-display text-xl font-semibold tracking-tight text-ink-900">
            Athars
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                isActive(href)
                  ? "bg-gold-50 text-gold-700 shadow-soft"
                  : "text-ink-500 hover:text-ink-800 hover:bg-parchment-100"
              )}
            >
              <Icon size={16} strokeWidth={isActive(href) ? 2.2 : 1.8} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          {/* CTA Button - Desktop */}
          <Link
            href="/chat"
            className="hidden md:inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-gold-600 to-gold-700 text-white text-sm font-medium shadow-soft hover:shadow-glow transition-all duration-300 hover:brightness-110"
          >
            <MessageSquare size={15} />
            Ask a Question
          </Link>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-parchment-100 text-ink-600 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/60 bg-background animate-slide-down">
          <nav className="px-page py-4 space-y-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  isActive(href)
                    ? "bg-gold-50 text-gold-700"
                    : "text-ink-600 hover:bg-parchment-100"
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
            <div className="pt-3 border-t border-border/60 mt-3">
              <Link
                href="/chat"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-gradient-to-r from-gold-600 to-gold-700 text-white text-sm font-medium"
              >
                <MessageSquare size={15} />
                Ask a Question
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
