"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth/client";
import {
  MessageSquare,
  BookOpen,
  Menu,
  X,
  LogIn,
  LogOut,
  User,
} from "lucide-react";

const NAV_LINKS = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/books", label: "Library", icon: BookOpen },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const session = authClient.useSession();

  const user = session.data?.user;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="accent-line" />

      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-page">
        {/* Logo - left */}
        <Link href="/" className="flex items-center gap-1 flex-shrink-0">
          <Image
            src="/logos/logo_en.png"
            alt="Athars"
            width={120}
            height={40}
            className="h-8 w-auto dark:invert"
            priority
          />
        </Link>

        {/* Desktop Nav - absolutely centered to viewport */}
        <nav className="hidden md:flex items-center gap-1 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                isActive(href)
                  ? "bg-accent text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon size={16} strokeWidth={isActive(href) ? 2.2 : 1.8} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {user ? (
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {user.image ? (
                    <Image
                      src={user.image}
                      alt={user.name || ""}
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                  ) : (
                    <User size={14} />
                  )}
                </div>
                <span className="max-w-[120px] truncate font-medium text-foreground">
                  {user.name || user.email}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/auth/sign-in"
              className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
            >
              <LogIn size={15} />
              Sign In / Sign Up
            </Link>
          )}

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background animate-slide-down">
          <nav className="px-page py-4 space-y-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  isActive(href)
                    ? "bg-accent text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
            <div className="pt-3 border-t border-border mt-3">
              {user ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-4 py-2 text-sm text-foreground">
                    <User size={16} />
                    <span className="truncate">{user.name || user.email}</span>
                  </div>
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      handleSignOut();
                    }}
                    className="flex w-full items-center justify-center gap-2 px-5 py-3 rounded-lg border border-border text-sm font-medium text-muted-foreground"
                  >
                    <LogOut size={15} />
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  href="/auth/sign-in"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-border text-sm font-medium text-muted-foreground"
                >
                  <LogIn size={15} />
                  Sign In / Sign Up
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
