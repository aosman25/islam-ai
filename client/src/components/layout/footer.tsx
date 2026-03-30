import Link from "next/link";
import Image from "next/image";
import { BookOpen, MessageSquare, Search } from "lucide-react";

const FOOTER_LINKS = [
  {
    title: "Explore",
    links: [
      { href: "/chat", label: "AI Chat", icon: MessageSquare },
      { href: "/books", label: "Library", icon: BookOpen },
      { href: "/search", label: "Search", icon: Search },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/about", label: "About Athars" },
      { href: "/methodology", label: "Our Methodology" },
      { href: "/sources", label: "Source Texts" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/50">
      <div className="mx-auto max-w-7xl px-page py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Brand Column */}
          <div className="space-y-4">
            <Image
              src="/logos/logo_en.png"
              alt="Athars"
              width={120}
              height={40}
              className="h-8 w-auto"
            />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Tracing the paths of Islamic knowledge through AI-powered
              research. Explore centuries of scholarship with modern tools.
            </p>
            <p className="font-arabic text-base text-muted-foreground">
              آثار &mdash; تتبع مسارات المعرفة
            </p>
          </div>

          {/* Link Columns */}
          {FOOTER_LINKS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
                {group.title}
              </h3>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {"icon" in link && link.icon && (
                        <link.icon size={14} />
                      )}
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Athars. All rights reserved.
          </p>
          <div className="accent-line w-24" />
        </div>
      </div>
    </footer>
  );
}
