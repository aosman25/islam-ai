"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import {
  Search,
  ArrowRight,
  BookOpen,
  MessageSquare,
  Sparkles,
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
    accent: "from-gold-500 to-gold-700",
  },
  {
    icon: Library,
    title: "Books Library",
    description:
      "Browse and read from a curated collection of Islamic scholarly works spanning centuries of scholarship.",
    href: "/books",
    accent: "from-teal-600 to-teal-800",
  },
  {
    icon: Search,
    title: "Deep Search",
    description:
      "Search across the entire corpus using semantic and keyword search to find exactly what you need.",
    href: "/search",
    accent: "from-ink-600 to-ink-800",
  },
];

const CATEGORIES = [
  { name: "Hadith", nameAr: "الحديث", icon: Scroll, count: "8,200+" },
  { name: "Fiqh", nameAr: "الفقه", icon: GraduationCap, count: "5,400+" },
  { name: "Tafsir", nameAr: "التفسير", icon: BookOpen, count: "3,100+" },
  { name: "Aqeedah", nameAr: "العقيدة", icon: Star, count: "2,800+" },
];

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");

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
      <section className="relative overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-b from-parchment-100 via-parchment-50 to-background" />
        <div className="absolute inset-0 pattern-overlay" />

        {/* Decorative geometric element */}
        <div className="absolute top-20 right-0 w-96 h-96 opacity-[0.04] pointer-events-none">
          <svg viewBox="0 0 400 400" fill="none">
            <circle cx="200" cy="200" r="180" stroke="currentColor" strokeWidth="0.5" className="text-gold-700" />
            <circle cx="200" cy="200" r="140" stroke="currentColor" strokeWidth="0.5" className="text-gold-700" />
            <circle cx="200" cy="200" r="100" stroke="currentColor" strokeWidth="0.5" className="text-gold-700" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <line
                key={angle}
                x1="200"
                y1="20"
                x2="200"
                y2="380"
                stroke="currentColor"
                strokeWidth="0.3"
                className="text-gold-700"
                transform={`rotate(${angle} 200 200)`}
              />
            ))}
          </svg>
        </div>

        <div className="relative mx-auto max-w-7xl px-page pt-24 pb-20 md:pt-32 md:pb-28">
          {/* Badge */}
          <div className="flex justify-center mb-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold-50 border border-gold-200/60 text-gold-700 text-xs font-medium">
              <Sparkles size={13} />
              AI-Powered Islamic Research Platform
            </div>
          </div>

          {/* Heading */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-ink-900 leading-[1.1] tracking-tight mb-6 animate-slide-up">
              Trace the Paths of
              <span className="block mt-1">
                <span className="bg-gradient-to-r from-gold-600 via-gold-500 to-gold-700 bg-clip-text text-transparent">
                  Islamic Knowledge
                </span>
              </span>
            </h1>
            <p className="text-lg md:text-xl text-ink-500 leading-relaxed animate-slide-up stagger-2 max-w-2xl mx-auto">
              Explore centuries of Islamic scholarship through AI. Ask questions,
              read classical texts, and discover insights grounded in authentic sources.
            </p>
          </div>

          {/* Search Box */}
          <div className="max-w-2xl mx-auto animate-slide-up stagger-3">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-gold-200 via-gold-300 to-gold-200 rounded-2xl opacity-0 group-focus-within:opacity-60 blur-lg transition-opacity duration-500" />
              <div className="relative flex items-center bg-card border border-border/80 rounded-xl shadow-md group-focus-within:shadow-lg group-focus-within:border-gold-300 transition-all duration-300">
                <Search
                  size={18}
                  className="ml-5 text-ink-400 flex-shrink-0"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Ask any question about Islamic knowledge..."
                  className="flex-1 px-4 py-4 bg-transparent text-ink-800 placeholder:text-ink-400 focus:outline-none text-base"
                />
                <button
                  onClick={() => handleSearch()}
                  disabled={!query.trim()}
                  className="mr-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-gold-600 to-gold-700 text-white text-sm font-medium shadow-soft hover:shadow-glow disabled:opacity-40 disabled:shadow-none transition-all duration-300 flex items-center gap-2"
                >
                  <span className="hidden sm:inline">Ask</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>

            {/* Suggested Queries */}
            <div className="mt-5 flex flex-wrap justify-center gap-2 animate-fade-in stagger-4">
              {SUGGESTED_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSearch(q)}
                  className="px-3 py-1.5 rounded-full bg-parchment-100 border border-border/60 text-xs text-ink-500 hover:text-gold-700 hover:border-gold-200 hover:bg-gold-50/50 transition-all duration-200"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FEATURES SECTION
          ============================================================ */}
      <section className="py-20 md:py-28 bg-background relative">
        <div className="mx-auto max-w-7xl px-page">
          {/* Section Header */}
          <div className="text-center mb-16">
            <div className="divider-diamond justify-center max-w-xs mx-auto mb-6">
              <div className="diamond" />
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-ink-900 mb-4">
              Your Research, Elevated
            </h2>
            <p className="text-ink-500 max-w-lg mx-auto">
              Powerful tools designed for scholars, students, and seekers of
              Islamic knowledge.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {FEATURES.map((feature, i) => (
              <Link
                key={feature.title}
                href={feature.href}
                className={cn(
                  "group relative rounded-2xl border border-border/60 bg-card p-8 shadow-soft hover:shadow-lg transition-all duration-500",
                  "animate-slide-up",
                  `stagger-${i + 2}`
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br text-white mb-5 shadow-soft group-hover:shadow-glow transition-shadow duration-500",
                    feature.accent
                  )}
                >
                  <feature.icon size={22} />
                </div>

                <h3 className="font-display text-xl font-semibold text-ink-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-sm text-ink-500 leading-relaxed mb-5">
                  {feature.description}
                </p>

                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-700 group-hover:gap-3 transition-all duration-300">
                  Explore
                  <ArrowRight
                    size={14}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </span>

                {/* Hover glow */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gold-50/0 to-gold-50/0 group-hover:from-gold-50/40 group-hover:to-transparent transition-all duration-500 pointer-events-none" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          CATEGORIES SECTION
          ============================================================ */}
      <section className="py-20 md:py-28 bg-parchment-100/40 relative">
        <div className="mx-auto max-w-7xl px-page">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-ink-900 mb-4">
              Browse by Subject
            </h2>
            <p className="text-ink-500 max-w-lg mx-auto">
              Explore the rich traditions of Islamic scholarship across major
              disciplines.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
            {CATEGORIES.map((cat, i) => (
              <Link
                key={cat.name}
                href={`/search?category=${cat.name.toLowerCase()}`}
                className={cn(
                  "group relative rounded-xl border border-border/50 bg-card p-6 text-center shadow-soft hover:shadow-md transition-all duration-300",
                  "animate-slide-up",
                  `stagger-${i + 1}`
                )}
              >
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-parchment-100 text-gold-600 mb-3 group-hover:bg-gold-50 group-hover:text-gold-700 transition-colors">
                  <cat.icon size={20} />
                </div>
                <h3 className="font-display text-base font-semibold text-ink-800 mb-0.5">
                  {cat.name}
                </h3>
                <p className="font-arabic text-sm text-ink-400 mb-2">
                  {cat.nameAr}
                </p>
                <p className="text-xs text-ink-400 font-medium">
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
      <section className="py-24 bg-background relative overflow-hidden">
        <div className="absolute inset-0 pattern-overlay opacity-20" />
        <div className="relative mx-auto max-w-3xl px-page text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-ink-900 mb-5">
            Start Your Research
          </h2>
          <p className="text-ink-500 mb-10 text-lg">
            Join scholars and students using Athars to explore Islamic knowledge
            in a new way.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-gold-600 to-gold-700 text-white font-medium shadow-md hover:shadow-glow transition-all duration-300 hover:brightness-110"
            >
              <MessageSquare size={18} />
              Start a Conversation
            </Link>
            <Link
              href="/books"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-border text-ink-700 font-medium hover:bg-parchment-100 transition-all duration-200"
            >
              <BookOpen size={18} />
              Browse Library
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
