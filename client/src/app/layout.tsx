import type { Metadata } from "next";
import { Cormorant_Garamond, Source_Sans_3, Amiri } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display-face",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body-face",
  display: "swap",
});

const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-arabic-face",
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
        className={`${cormorant.variable} ${sourceSans.variable} ${amiri.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
