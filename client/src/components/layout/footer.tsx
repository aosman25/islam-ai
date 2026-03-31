import Link from "next/link";
import Image from "next/image";
import { BookOpen, MessageSquare } from "lucide-react";

const FOOTER_LINKS = [
  {
    title: "Explore",
    links: [
      { href: "/chat", label: "AI Chat", icon: MessageSquare },
      { href: "/books", label: "Library", icon: BookOpen },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-border bg-muted/50 overflow-hidden">
      {/* Geometric background */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none"
        viewBox="0 0 800 400"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Large 8-pointed star — right side */}
        {(() => {
          const cx = 650, cy = 200, r1 = 160, r2 = 70;
          const points = Array.from({ length: 8 }, (_, i) => {
            const angle = (Math.PI / 4) * i - Math.PI / 2;
            const r = i % 2 === 0 ? r1 : r2;
            return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
          }).join(" ");
          return <polygon points={points} stroke="currentColor" strokeWidth="1" />;
        })()}

        {/* Concentric circles — left */}
        {Array.from({ length: 6 }, (_, i) => (
          <circle
            key={`c${i}`}
            cx="120"
            cy="320"
            r={30 + i * 35}
            stroke="currentColor"
            strokeWidth="0.6"
          />
        ))}

        {/* Interlocking diamonds — center */}
        {Array.from({ length: 3 }, (_, row) =>
          Array.from({ length: 5 }, (_, col) => {
            const cx = col * 80 + 250 + (row % 2 === 0 ? 0 : 40);
            const cy = row * 70 + 60;
            return (
              <polygon
                key={`d${row}-${col}`}
                points={`${cx},${cy - 28} ${cx + 28},${cy} ${cx},${cy + 28} ${cx - 28},${cy}`}
                stroke="currentColor"
                strokeWidth="0.5"
              />
            );
          })
        )}

        {/* Radial lines from bottom-right corner */}
        {Array.from({ length: 8 }, (_, i) => {
          const angle = Math.PI + (Math.PI / 2) * (i / 7);
          return (
            <line
              key={`r${i}`}
              x1="800"
              y1="400"
              x2={800 + 300 * Math.cos(angle)}
              y2={400 + 300 * Math.sin(angle)}
              stroke="currentColor"
              strokeWidth="0.4"
            />
          );
        })}
      </svg>

      <div className="relative mx-auto max-w-7xl px-page py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Brand Column */}
          <div className="space-y-4">
            <Image
              src="/logos/logo_en.png"
              alt="Athars"
              width={120}
              height={40}
              className="h-8 w-auto dark:invert"
            />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Tracing the paths of Islamic knowledge through AI-powered
              research. Explore centuries of scholarship with modern tools.
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
