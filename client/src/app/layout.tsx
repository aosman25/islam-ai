import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const notoSans = localFont({
  src: "../../public/fonts/noto-sans.ttf",
  variable: "--font-noto-sans",
  display: "swap",
});

const notoSansArabic = localFont({
  src: "../../public/fonts/noto-sans-arabic.ttf",
  variable: "--font-noto-arabic",
  display: "swap",
});

const notoSerif = localFont({
  src: [
    { path: "../../public/fonts/noto-serif.ttf", style: "normal" },
    { path: "../../public/fonts/noto-serif-italic.ttf", style: "italic" },
  ],
  variable: "--font-noto-serif",
  display: "swap",
});

const amiri = localFont({
  src: [
    { path: "../../public/fonts/amiri-regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/amiri-italic.ttf", weight: "400", style: "italic" },
    { path: "../../public/fonts/amiri-bold.ttf", weight: "700", style: "normal" },
    { path: "../../public/fonts/amiri-bold-italic.ttf", weight: "700", style: "italic" },
  ],
  variable: "--font-amiri",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Athars - AI-Powered Islamic Research",
  description:
    "Explore centuries of Islamic scholarship through AI-powered research. Search, read, and discover insights across a vast corpus of classical Islamic texts.",
  keywords: [
    "Islamic research",
    "AI",
    "Islamic texts",
    "Quran",
    "Hadith",
    "Islamic scholarship",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${notoSans.variable} ${notoSansArabic.variable} ${amiri.variable} ${notoSerif.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
