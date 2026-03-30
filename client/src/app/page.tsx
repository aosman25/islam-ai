"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import {
  Search,
  ArrowRight,
  BookOpen,
  MessageSquare,
  Library,
  GraduationCap,
  Scroll,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTED_QUERIES = [
  "What does the Quran say about patience?",
  "Explain the concept of Tawakkul",
  "What are the pillars of Islamic jurisprudence?",
  "Hadith about seeking knowledge",
];

const FEATURES = [
  {
    icon: MessageSquare,
    title: "AI-Powered Chat",
    description:
      "Ask questions in natural language and receive answers grounded in classical Islamic texts with full source citations.",
    href: "/chat",
    label: "Start a conversation",
  },
  {
    icon: Library,
    title: "Books Library",
    description:
      "Browse and read from a curated collection of Islamic scholarly works spanning centuries of scholarship.",
    href: "/books",
    label: "Browse collection",
  },
  {
    icon: Search,
    title: "Deep Search",
    description:
      "Search across the entire corpus using semantic and keyword search to find exactly what you need.",
    href: "/search",
    label: "Search texts",
  },
];

const CATEGORIES = [
  { name: "Hadith", nameAr: "الحديث", icon: Scroll, count: "8,200+" },
  { name: "Fiqh", nameAr: "الفقه", icon: GraduationCap, count: "5,400+" },
  { name: "Tafsir", nameAr: "التفسير", icon: BookOpen, count: "3,100+" },
  { name: "Aqeedah", nameAr: "العقيدة", icon: Star, count: "2,800+" },
];

/* ------------------------------------------------------------------ */
/*  Islamic 8-fold geometric SVG for hero backdrop                     */
/* ------------------------------------------------------------------ */
function GeometricPattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 800 800"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
          {/* 8-pointed star at each intersection */}
          <path
            d="M50 10 L58 30 L78 22 L70 42 L90 50 L70 58 L78 78 L58 70 L50 90 L42 70 L22 78 L30 58 L10 50 L30 42 L22 22 L42 30 Z"
            stroke="currentColor"
            strokeWidth="0.5"
            fill="none"
          />
          {/* Inner octagon */}
          <path
            d="M50 25 L65 35 L75 50 L65 65 L50 75 L35 65 L25 50 L35 35 Z"
            stroke="currentColor"
            strokeWidth="0.3"
            fill="none"
          />
          {/* Connecting lines */}
          <line x1="50" y1="0" x2="50" y2="10" stroke="currentColor" strokeWidth="0.3" />
          <line x1="50" y1="90" x2="50" y2="100" stroke="currentColor" strokeWidth="0.3" />
          <line x1="0" y1="50" x2="10" y2="50" stroke="currentColor" strokeWidth="0.3" />
          <line x1="90" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect width="800" height="800" fill="url(#grid)" className="text-primary" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Floating decorative arcs                                           */
/* ------------------------------------------------------------------ */
function FloatingArcs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Top-right arc cluster */}
      <svg
        className="absolute -top-20 -right-20 w-[500px] h-[500px] text-primary/[0.06] animate-spin-slow"
        viewBox="0 0 400 400"
        fill="none"
      >
        <circle cx="200" cy="200" r="180" stroke="currentColor" strokeWidth="0.8" />
        <circle cx="200" cy="200" r="150" stroke="currentColor" strokeWidth="0.5" strokeDasharray="8 12" />
        <circle cx="200" cy="200" r="120" stroke="currentColor" strokeWidth="0.5" />
      </svg>
      {/* Bottom-left glow */}
      <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-[100px]" />
      {/* Top accent glow */}
      <div className="absolute -top-20 left-1/3 w-[400px] h-[300px] rounded-full bg-secondary/[0.05] blur-[80px]" />
    </div>
  );
}

function useCountUp(target: number, duration = 1500, start = false) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (!start) return;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, start]);

  return value;
}

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const chunksCount = useCountUp(650, 1800, mounted);
  const booksCount = useCountUp(2500, 2000, mounted);

  const handleSearch = (q?: string) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    router.push(`/chat?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* ============================================================
          HERO SECTION
          ============================================================ */}
      <section className="relative overflow-hidden min-h-[calc(100vh-5rem)] flex items-center">
        {/* Layered background */}
        <div className="absolute inset-0 bg-gradient-to-b from-muted/80 via-background to-background" />
        <div className="absolute inset-0 opacity-[0.035]">
          <GeometricPattern />
        </div>
        <FloatingArcs />

        {/* Grain texture overlay */}
        <div className="absolute inset-0 opacity-[0.015] mix-blend-multiply" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
        }} />

        <div className="relative mx-auto max-w-7xl w-full px-page py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

            {/* Left column: text + search */}
            <div className="lg:col-span-7 space-y-8">
              {/* Heading */}
              <div>
                <h1
                  className={cn(
                    "font-heading font-bold text-2xl sm:text-3xl md:text-4xl leading-[1.12] tracking-tight text-foreground whitespace-nowrap transition-all duration-700 delay-100",
                    mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  )}
                >
                  AI-Powered Islamic <span className="hero-gradient-text">Scholarship</span>
                </h1>
                <p
                  className={cn(
                    "mt-6 text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl transition-all duration-700 delay-200",
                    mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  )}
                >
                  Explore centuries of Islamic scholarship through AI. Ask questions,
                  read classical texts, and discover insights grounded in authentic sources.
                </p>
              </div>

              {/* Search Box */}
              <div
                className={cn(
                  "max-w-xl transition-all duration-700 delay-300",
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                )}
              >
                <div className="relative group">
                  <div className="absolute -inset-[2px] bg-gradient-to-r from-primary/40 via-secondary/30 to-primary/40 rounded-2xl opacity-0 group-focus-within:opacity-100 blur-md transition-opacity duration-500" />
                  <div className="relative flex items-center bg-card/90 backdrop-blur-sm border border-border rounded-xl shadow-lg group-focus-within:shadow-xl group-focus-within:border-primary/30 transition-all duration-300">
                    <Search
                      size={18}
                      className="ml-5 text-muted-foreground flex-shrink-0"
                    />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder="Ask any question about Islamic knowledge..."
                      className="flex-1 px-4 py-4 bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none text-base"
                    />
                    <button
                      onClick={() => handleSearch()}
                      disabled={!query.trim()}
                      className="mr-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:shadow-md hover:brightness-110 disabled:opacity-30 disabled:shadow-none transition-all duration-300 flex items-center gap-2 cursor-pointer"
                    >
                      <span className="hidden sm:inline">Ask</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>

                {/* Suggested Queries */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {SUGGESTED_QUERIES.map((q, i) => (
                    <button
                      key={q}
                      onClick={() => handleSearch(q)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-full border border-border/60 bg-background/60 backdrop-blur-sm text-xs text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/[0.04] transition-all duration-200 cursor-pointer",
                        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                      )}
                      style={{ transitionDelay: mounted ? `${400 + i * 60}ms` : "0ms" }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column: simple stats */}
            <div
              className={cn(
                "lg:col-span-5 hidden lg:flex items-center justify-center transition-all duration-1000 delay-500",
                mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
              )}
            >
              <div className="flex gap-8">
                <div className="text-center px-8 py-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm">
                  <p className="text-4xl font-bold text-primary mb-1 tabular-nums">
                    {chunksCount.toLocaleString()}k+
                  </p>
                  <p className="text-sm text-muted-foreground">Text chunks</p>
                </div>
                <div className="text-center px-8 py-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm">
                  <p className="text-4xl font-bold text-primary mb-1 tabular-nums">
                    {booksCount.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Books</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FEATURES SECTION
          ============================================================ */}
      <section className="py-24 md:py-32 bg-background relative">
        {/* Subtle top border gradient */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="mx-auto max-w-7xl px-page">
          {/* Section Header */}
          <div className="max-w-2xl mb-16 md:mb-20">
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-primary mb-4">
              Tools for scholarship
            </p>
            <h2 className="text-3xl md:text-4xl font-heading text-foreground mb-5 leading-tight">
              Your Research, Elevated
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Powerful tools designed for scholars, students, and seekers of
              Islamic knowledge.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
            {FEATURES.map((feature) => (
              <Link
                key={feature.title}
                href={feature.href}
                className="group relative rounded-2xl border border-border/70 bg-card/50 backdrop-blur-sm p-8 hover:border-primary/20 hover:shadow-xl transition-all duration-500"
              >
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary/[0.08] text-primary mb-6 group-hover:bg-primary/[0.14] group-hover:scale-105 transition-all duration-300">
                  <feature.icon size={20} strokeWidth={1.6} />
                </div>

                <h3 className="text-lg font-semibold text-foreground mb-3 group-hover:text-primary transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  {feature.description}
                </p>

                <span className="inline-flex items-center gap-2 text-sm font-medium text-primary opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                  {feature.label}
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-200" />
                </span>

                {/* Hover gradient overlay */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          CATEGORIES SECTION
          ============================================================ */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-muted/50 to-muted/30" />
        <div className="absolute inset-0 opacity-[0.02]">
          <GeometricPattern />
        </div>

        <div className="relative mx-auto max-w-7xl px-page">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14">
            <div className="max-w-lg">
              <p className="text-xs font-medium tracking-[0.2em] uppercase text-primary mb-4">
                Disciplines
              </p>
              <h2 className="text-3xl md:text-4xl font-heading text-foreground mb-4 leading-tight">
                Browse by Subject
              </h2>
              <p className="text-muted-foreground text-base">
                Explore the rich traditions of Islamic scholarship across major
                disciplines.
              </p>
            </div>
            <Link
              href="/books"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:gap-3 transition-all duration-200 self-start md:self-auto"
            >
              View all subjects
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-5">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.name}
                href={`/search?category=${cat.name.toLowerCase()}`}
                className="group relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-6 lg:p-8 hover:border-primary/20 hover:shadow-lg transition-all duration-400"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/[0.07] text-primary group-hover:bg-primary/[0.14] transition-colors duration-300">
                    <cat.icon size={18} strokeWidth={1.6} />
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground/0 group-hover:text-primary transition-all duration-300 -translate-x-2 group-hover:translate-x-0" />
                </div>

                <h3 className="text-base font-semibold text-foreground mb-1">
                  {cat.name}
                </h3>
                <p className="font-arabic text-sm text-muted-foreground/70 mb-3">
                  {cat.nameAr}
                </p>
                <p className="text-xs text-muted-foreground font-medium tracking-wide">
                  {cat.count} texts
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          CTA SECTION
          ============================================================ */}
      <section className="py-28 md:py-36 bg-background relative overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-primary/[0.04] blur-[120px] pointer-events-none" />

        <div className="relative mx-auto max-w-3xl px-page text-center">
          <div className="w-10 h-px bg-primary mx-auto mb-8" />
          <h2 className="text-3xl md:text-[2.75rem] font-heading text-foreground mb-6 leading-tight">
            Start Your Research
          </h2>
          <p className="text-muted-foreground mb-12 text-lg leading-relaxed max-w-xl mx-auto">
            Join scholars and students using Athars to explore Islamic knowledge
            in a new way.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-medium shadow-md hover:shadow-xl hover:brightness-110 transition-all duration-300"
            >
              <MessageSquare size={17} />
              Start a Conversation
            </Link>
            <Link
              href="/books"
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl border border-border text-foreground font-medium hover:bg-muted/60 transition-all duration-200"
            >
              <BookOpen size={17} />
              Browse Library
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
