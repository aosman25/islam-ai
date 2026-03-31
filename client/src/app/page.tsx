"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { GeometricPattern } from "@/components/ui/geometric-pattern";
import { Footer } from "@/components/layout/footer";
import {
  Search,
  ArrowRight,
  BookOpen,
  MessageSquare,
  GraduationCap,
  Scroll,
  Star,
  Bot,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CitationGroupBadge, CitationOverlayProvider } from "@/components/chat/citation-renderer";
import { PREVIEW_SOURCE_MAP } from "@/data/preview-sources";

const SUGGESTED_QUERIES = [
  "What does the Quran say about patience?",
  "Explain the concept of Tawakkul",
  "What are the pillars of Islamic jurisprudence?",
  "Hadith about seeking knowledge",
];


const CATEGORIES = [
  { name: "Aqeedah", nameAr: "العقيدة", icon: Star, palette: { bg: "#c8d8ec", pattern: "#4a6fa0", text: "#1e3050" }, categories: ["العقيدة", "الفرق والردود"] },
  { name: "Hadith", nameAr: "الحديث", icon: Scroll, palette: { bg: "#c2e0cc", pattern: "#38845a", text: "#14301e" }, categories: ["كتب السنة", "شروح الحديث", "علوم الحديث", "التخريج والأطراف", "العلل والسؤلات الحديثية"] },
  { name: "Fiqh", nameAr: "الفقه", icon: GraduationCap, palette: { bg: "#dcc8e0", pattern: "#7a4a82", text: "#2e1434" }, categories: ["الفقه العام", "الفقه الحنفي", "الفقه المالكي", "الفقه الشافعي", "الفقه الحنبلي", "أصول الفقه", "علوم الفقه والقواعد الفقهية", "مسائل فقهية", "الفتاوى", "الفرائض والوصايا"] },
  { name: "Tafsir", nameAr: "التفسير", icon: BookOpen, palette: { bg: "#e4d5c2", pattern: "#7a5c38", text: "#2e1e0e" }, categories: ["التفسير", "علوم القرآن وأصول التفسير", "التجويد والقراءات"] },
];


/* ------------------------------------------------------------------ */
/*  Animated hero background — drifting geometric particle mesh        */
/* ------------------------------------------------------------------ */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;          // base radius
  phase: number;      // for pulsing
  speed: number;      // pulse speed
}

function AnimatedHeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const raf = useRef<number>(0);
  const dpr = useRef(1);

  const initParticles = useCallback((w: number, h: number) => {
    const count = Math.min(Math.floor((w * h) / 16000), 70);
    const arr: Particle[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        r: Math.random() * 2 + 1.2,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.6 + 0.4,
      });
    }
    particles.current = arr;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    dpr.current = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      canvas.width = w * dpr.current;
      canvas.height = h * dpr.current;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr.current, 0, 0, dpr.current, 0, 0);
      initParticles(w, h);
    };

    resize();
    window.addEventListener("resize", resize);

    // Green that matches the primary theme color
    const dotColor = "rgba(56,142,60,";
    const lineColor = "rgba(56,142,60,";
    const CONNECTION_DIST = 180;

    const draw = (t: number) => {
      const w = canvas.width / dpr.current;
      const h = canvas.height / dpr.current;
      ctx.clearRect(0, 0, w, h);

      const pts = particles.current;

      // Update positions
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;
      }

      // Draw connections
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.35;
            ctx.strokeStyle = `${lineColor}${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw dots
      for (const p of pts) {
        const pulse = Math.sin(t * 0.001 * p.speed + p.phase) * 0.3 + 0.7;
        const alpha = 0.55 * pulse;
        ctx.fillStyle = `${dotColor}${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.8 + pulse * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }

      raf.current = requestAnimationFrame(draw);
    };

    raf.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
    };
  }, [initParticles]);

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0" />
      {/* Ambient glows */}
      <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/[0.08] blur-[100px] animate-[float_8s_ease-in-out_infinite]" />
      <div className="absolute -top-20 right-1/4 w-[400px] h-[300px] rounded-full bg-secondary/[0.10] blur-[80px] animate-[float_10s_ease-in-out_2s_infinite]" />
      <div className="absolute top-1/3 left-1/2 w-[300px] h-[300px] rounded-full bg-primary/[0.06] blur-[120px] animate-[float_12s_ease-in-out_4s_infinite]" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Answer Preview with scroll-triggered animations                    */
/* ------------------------------------------------------------------ */
const QUESTION_TEXT = "What is the meaning of sincerity (ikhlāṣ) in Islam?";
const TYPING_SPEED = 18; // ms per character
const PARAGRAPH_DELAY = 350; // ms between paragraphs appearing

// Helper to create a clickable citation badge from source IDs
function PreviewCitationBadge({ ids }: { ids: number[] }) {
  const sources = ids
    .map((id) => PREVIEW_SOURCE_MAP.get(id))
    .filter((s): s is NonNullable<typeof s> => !!s);
  if (sources.length === 0) return null;
  return <CitationGroupBadge ids={ids} sources={sources} />;
}

function AnswerPreviewSection({ skipAnimations = false }: { skipAnimations?: boolean }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const hasTriggered = useRef(false);

  // Animation phases
  const [phase, setPhase] = useState<
    "idle" | "question" | "thinking" | "streaming" | "done"
  >(skipAnimations ? "done" : "idle");
  const [typedChars, setTypedChars] = useState(skipAnimations ? QUESTION_TEXT.length : 0);
  const [visibleParagraphs, setVisibleParagraphs] = useState(skipAnimations ? 4 : 0);
  const [showCta, setShowCta] = useState(skipAnimations);
  const [showSources, setShowSources] = useState(skipAnimations);

  // Intersection Observer — trigger once when section is ~30% visible
  useEffect(() => {
    if (skipAnimations) return;
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTriggered.current) {
          hasTriggered.current = true;
          setPhase("question");
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [skipAnimations]);

  // Phase: typing the question
  useEffect(() => {
    if (phase !== "question") return;
    if (typedChars >= QUESTION_TEXT.length) {
      const t = setTimeout(() => setPhase("thinking"), 200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => setTypedChars((c) => c + 1),
      TYPING_SPEED + Math.random() * 12
    );
    return () => clearTimeout(t);
  }, [phase, typedChars]);

  // Phase: thinking dots (brief pause)
  useEffect(() => {
    if (phase !== "thinking") return;
    const t = setTimeout(() => setPhase("streaming"), 600);
    return () => clearTimeout(t);
  }, [phase]);

  // Phase: reveal answer paragraphs one by one
  useEffect(() => {
    if (phase !== "streaming") return;
    if (visibleParagraphs >= 4) {
      const t = setTimeout(() => setPhase("done"), 200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => setVisibleParagraphs((p) => p + 1),
      visibleParagraphs === 0 ? 100 : PARAGRAPH_DELAY
    );
    return () => clearTimeout(t);
  }, [phase, visibleParagraphs]);

  // Phase: done — show CTA and sources
  useEffect(() => {
    if (phase !== "done" || skipAnimations) return;
    const t1 = setTimeout(() => setShowCta(true), 100);
    const t2 = setTimeout(() => setShowSources(true), 250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase, skipAnimations]);

  // Cursor component
  const Cursor = () => (
    <span className="inline-block w-[2px] h-[1.1em] bg-primary align-middle ml-0.5 animate-[cursor-blink_0.8s_step-end_infinite]" />
  );

  // Paragraph wrapper with enter animation
  const AnimatedParagraph = ({
    index,
    children,
  }: {
    index: number;
    children: React.ReactNode;
  }) => {
    const isVisible = visibleParagraphs > index;
    const isLast = index === visibleParagraphs - 1 && phase === "streaming";
    return (
      <p
        className="transition-all duration-500 ease-out"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(12px)",
          filter: isVisible ? "blur(0)" : "blur(4px)",
        }}
      >
        {children}
        {isLast && <Cursor />}
      </p>
    );
  };

  return (
    <section ref={sectionRef} className="py-24 md:py-32 relative overflow-hidden">
      {/* Background atmosphere */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />
      <div className="absolute inset-0 opacity-[0.018]">
        <GeometricPattern />
      </div>
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/[0.03] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-secondary/[0.04] blur-[100px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-page">
        {/* Section header */}
        <div className="max-w-2xl mb-14 md:mb-18">
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-primary mb-4">
            See it in action
          </p>
          <h2 className="text-3xl md:text-4xl font-heading text-foreground mb-5 leading-tight">
            Answers Grounded in Scholarship
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            Every response draws from classical Islamic texts with full source
            citations, so you can verify and explore further.
          </p>
        </div>

        {/* Answer preview card */}
        <div className="relative rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm shadow-xl overflow-hidden">
          {/* Top decorative bar */}
          <div className="h-1 bg-gradient-to-r from-primary/60 via-secondary/40 to-primary/60" />

          {/* Question header */}
          <div className="px-6 md:px-10 pt-8 pb-6 border-b border-border/40">
            <div className="flex items-start gap-4">
              <div
                className="flex-shrink-0 w-9 h-9 rounded-xl bg-muted flex items-center justify-center transition-all duration-500"
                style={{
                  opacity: phase !== "idle" ? 1 : 0,
                  transform: phase !== "idle" ? "scale(1)" : "scale(0.8)",
                }}
              >
                <Sparkles size={16} className="text-primary" />
              </div>
              <div className="min-h-[3.5rem]">
                <p
                  className="text-xs font-medium text-muted-foreground mb-2 tracking-wide uppercase transition-opacity duration-400"
                  style={{ opacity: phase !== "idle" ? 1 : 0 }}
                >
                  Sample Question
                </p>
                <h3 className="text-lg md:text-xl font-semibold text-foreground leading-snug">
                  {phase === "idle" ? (
                    <span className="invisible">{QUESTION_TEXT}</span>
                  ) : (
                    <>
                      {QUESTION_TEXT.slice(0, typedChars)}
                      {phase === "question" && <Cursor />}
                    </>
                  )}
                </h3>
              </div>
            </div>
          </div>

          {/* Answer body */}
          <div className="relative px-6 md:px-10 pt-8 pb-0">
            {/* Bot avatar + label */}
            <div
              className="flex items-center gap-3 mb-6 transition-all duration-500"
              style={{
                opacity: phase === "thinking" || phase === "streaming" || phase === "done" ? 1 : 0,
                transform:
                  phase === "thinking" || phase === "streaming" || phase === "done"
                    ? "translateY(0)"
                    : "translateY(8px)",
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-sm">
                <Bot size={15} className="text-white" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Athars AI</span>
              {/* Thinking indicator */}
              {phase === "thinking" && (
                <span className="flex items-center gap-1 ml-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-[typing-dot_1.2s_ease-in-out_infinite]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-[typing-dot_1.2s_ease-in-out_0.2s_infinite]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-[typing-dot_1.2s_ease-in-out_0.4s_infinite]" />
                </span>
              )}
            </div>

            {/* Answer content with fade */}
            <div className="relative max-h-[480px] overflow-hidden">
              <div
                className="chat-markdown text-sm text-foreground leading-[1.8] space-y-5"
                style={{ direction: "ltr", textAlign: "left" }}
              >
                <AnimatedParagraph index={0}>
                  Sincerity (<em>ikhlāṣ</em>) in Islam is a fundamental concept
                  deeply rooted in the Quran and Sunnah, encompassing the
                  purification of one&apos;s intentions and actions for God
                  alone. It is intricately linked with the idea of{" "}
                  <em>iḥsān</em> (excellence) and forms one of the core
                  conditions for the acceptance of deeds, as articulated by
                  various scholars.
                </AnimatedParagraph>

                <AnimatedParagraph index={1}>
                  The essence of <em>ikhlāṣ</em> lies in directing one&apos;s
                  obedience and worship solely towards God, without seeking any
                  worldly gains or human recognition. Abū al-Qāsim al-Qushayrī
                  defines <em>ikhlāṣ</em> as &ldquo;إفراد الحق بالطاعة في
                  القصد&rdquo; (singling out God in obedience with intention),
                  further explaining that the servant desires God&apos;s
                  countenance above all else, shunning pretense before creatures,
                  seeking praise from people, or any other motive apart from
                  drawing closer to God{" "}
                  <PreviewCitationBadge ids={[205870000055, 205870000172]} />
                  . This definition is echoed by Ibn Taymiyyah, who adds that{" "}
                  <em>ikhlāṣ</em> can also be understood as &ldquo;تصفية الفعل
                  عن ملاحظة المخلوقين&rdquo; (purifying the action from the
                  observation of creatures){" "}
                  <PreviewCitationBadge ids={[205870000055, 205870000172]} />
                  . Therefore, sincerity demands a complete detachment from the
                  desire for human approval or worldly benefit in one&apos;s
                  religious practices.
                </AnimatedParagraph>

                <AnimatedParagraph index={2}>
                  The profound significance of <em>ikhlāṣ</em> is further
                  elucidated in the context of accepting actions. Imām Abū
                  Zakariyyā Yaḥyā al-Nawawī, narrating from Abū al-Qāsim
                  al-Qushayrī, reports that al-Fuḍayl ibn &apos;Iyāḍ, when
                  asked about the Quranic verse, &ldquo;لِيَبْلُوَكُمْ
                  أَيُّكُمْ أَحْسَنُ عَمَلًا&rdquo; [الملك: 2] (that He might
                  test you, which of you is best in deed), responded,
                  &ldquo;أخلصه وأصوبه&rdquo; (the most sincere and the most
                  correct){" "}
                  <PreviewCitationBadge ids={[205870000055, 205870000172, 118170000028]} />
                  . When pressed to clarify what this meant, al-Fuḍayl
                  explained, &ldquo;إن العمل لا يكون مقبولًا حتى يكون خالصًا
                  صوابًا، فالخالص ما كان لله، والصواب ما كان على سنة رسول
                  الله&rdquo; (Indeed, an action is not accepted unless it is
                  sincere and correct. Sincere is that which is for God, and
                  correct is that which is in accordance with the Sunnah of the
                  Messenger of God){" "}
                  <PreviewCitationBadge ids={[205870000055, 205870000172, 118170000028]} />
                  .
                </AnimatedParagraph>

                <AnimatedParagraph index={3}>
                  This highlights that <em>ikhlāṣ</em> (being for God) and
                  adherence to the Sunnah (correctness) are the twin conditions
                  for any action to be accepted, forming the very essence of the
                  religion of Islam. The commitment to these two principles
                  reflects the purpose of the two declarations of faith (
                  <em>shahādatayn</em>): &ldquo;لا إله إلا الله&rdquo; (there
                  is no god but God) signifies the exclusivity of worship for
                  God, thus embodying <em>ikhlāṣ</em>, while &ldquo;محمد رسول
                  الله&rdquo; (Muḥammad is the Messenger of God) entails
                  following his teachings and Sunnah, ensuring the correctness of
                  actions{" "}
                  <PreviewCitationBadge ids={[2910000016]} />
                  .
                </AnimatedParagraph>
              </div>

              {/* Fade-out gradient */}
              <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-card/70 via-card/70 to-transparent pointer-events-none" />
            </div>

            {/* CTA overlay at bottom */}
            <div
              className="relative -mt-16 pb-8 flex flex-col items-center gap-4 z-10 transition-all duration-700"
              style={{
                opacity: showCta ? 1 : 0,
                transform: showCta ? "translateY(0)" : "translateY(12px)",
              }}
            >
              <Link
                href="/chat?q=What%20is%20the%20meaning%20of%20sincerity%20(ikhl%C4%81%E1%B9%A3)%20in%20Islam%3F"
                className="inline-flex items-center gap-2.5 px-7 py-3 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg hover:shadow-xl hover:brightness-110 transition-all duration-300"
              >
                <MessageSquare size={16} />
                Continue in Chat
                <ArrowRight size={14} />
              </Link>
              <p className="text-xs text-muted-foreground">
                Try this question yourself or ask your own
              </p>
            </div>
          </div>

          {/* Source chips at the bottom */}
          <div
            className="px-6 md:px-10 py-5 border-t border-border/40 bg-muted/20 transition-all duration-700"
            style={{
              opacity: showSources ? 1 : 0,
              transform: showSources ? "translateY(0)" : "translateY(8px)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={13} className="text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Sources referenced
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                { label: "الإيمان الأوسط - ط ابن الجوزي", ids: [205870000055, 205870000172] },
                { label: "النبوات لابن تيمية", ids: [118170000028] },
                { label: "جواب الاعتراضات المصرية على الفتيا الحموية", ids: [2910000016] },
                { label: "مجموع رسائل ابن رجب", ids: [957350000154] },
                { label: "تفسير ابن كثير", ids: [84730000644] },
                { label: "تفسير العثيمين: جزء عم", ids: [1511680000042] },
              ] as const).map((source, i) => {
                const resolved = source.ids
                  .map((id) => PREVIEW_SOURCE_MAP.get(id))
                  .filter((s): s is NonNullable<typeof s> => !!s);
                return (
                  <span
                    key={source.label}
                    className="transition-all duration-500"
                    style={{
                      opacity: showSources ? 1 : 0,
                      transform: showSources ? "translateY(0)" : "translateY(6px)",
                      transitionDelay: `${i * 60}ms`,
                    }}
                  >
                    <CitationGroupBadge ids={source.ids as unknown as number[]} sources={resolved} />
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Browse by Subject — fade-up on scroll                              */
/* ------------------------------------------------------------------ */
function BrowseBySubjectSection({ skipAnimations = false }: { skipAnimations?: boolean }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(skipAnimations);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 md:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-muted/50 to-muted/30" />
      <div className="absolute inset-0 opacity-[0.02]">
        <GeometricPattern />
      </div>

      <div className="relative mx-auto max-w-7xl px-page">
        <div
          className={cn(
            "flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14",
            !skipAnimations && "transition-all duration-700",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
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
          {CATEGORIES.map((cat, i) => (
            <Link
              key={cat.name}
              href={`/books?categories=${encodeURIComponent(cat.categories.join(","))}`}
              className={cn(
                "group relative rounded-2xl overflow-hidden border border-black/[0.06] hover:shadow-xl hover:scale-[1.02]",
                !skipAnimations && "transition-[opacity,translate] duration-500",
                "hover:transition-[transform,box-shadow] hover:duration-150 hover:ease-out",
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
              )}
              style={{
                backgroundColor: cat.palette.bg,
                transitionDelay: !skipAnimations && visible ? `${150 + i * 100}ms` : "0ms",
              }}
            >
              {/* Decorative SVG pattern */}
              <svg
                className="absolute inset-0 w-full h-full opacity-[0.25] group-hover:opacity-[0.35] transition-opacity duration-500"
                viewBox="0 0 200 200"
                preserveAspectRatio="xMidYMid slice"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {i === 0 && /* 8-pointed star grid for Aqeedah */
                  Array.from({ length: 4 }, (_, row) =>
                    Array.from({ length: 4 }, (_, col) => {
                      const cx = col * 55 + 25;
                      const cy = row * 55 + 20;
                      const r1 = 22;
                      const r2 = 10;
                      const points = Array.from({ length: 8 }, (_, k) => {
                        const angle = (Math.PI / 4) * k - Math.PI / 2;
                        const r = k % 2 === 0 ? r1 : r2;
                        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
                      }).join(" ");
                      return (
                        <polygon
                          key={`${row}-${col}`}
                          points={points}
                          stroke={cat.palette.pattern}
                          strokeWidth="0.5"
                        />
                      );
                    })
                  )
                }
                {i === 1 && /* Concentric circles for Hadith */
                  <>
                    {Array.from({ length: 8 }, (_, k) => (
                      <circle
                        key={k}
                        cx="100"
                        cy="100"
                        r={15 + k * 14}
                        stroke={cat.palette.pattern}
                        strokeWidth="0.4"
                      />
                    ))}
                    {Array.from({ length: 12 }, (_, k) => {
                      const angle = (Math.PI * 2 * k) / 12;
                      return (
                        <line
                          key={k}
                          x1="100"
                          y1="100"
                          x2={100 + 130 * Math.cos(angle)}
                          y2={100 + 130 * Math.sin(angle)}
                          stroke={cat.palette.pattern}
                          strokeWidth="0.3"
                        />
                      );
                    })}
                  </>
                }
                {i === 2 && /* Diamond lattice for Fiqh */
                  Array.from({ length: 5 }, (_, row) =>
                    Array.from({ length: 5 }, (_, col) => {
                      const cx = col * 45 + (row % 2 === 0 ? 10 : 32);
                      const cy = row * 45 + 15;
                      return (
                        <polygon
                          key={`${row}-${col}`}
                          points={`${cx},${cy - 18} ${cx + 18},${cy} ${cx},${cy + 18} ${cx - 18},${cy}`}
                          stroke={cat.palette.pattern}
                          strokeWidth="0.4"
                        />
                      );
                    })
                  )
                }
                {i === 3 && /* Nested arches for Tafsir */
                  <>
                    {Array.from({ length: 7 }, (_, k) => (
                      <path
                        key={k}
                        d={`M ${20 + k * 5} 200 Q 100 ${-20 + k * 20} ${180 - k * 5} 200`}
                        stroke={cat.palette.pattern}
                        strokeWidth="0.5"
                      />
                    ))}
                    <line x1="100" y1="0" x2="100" y2="200" stroke={cat.palette.pattern} strokeWidth="0.3" />
                  </>
                }
              </svg>

              {/* Gradient overlay at bottom */}
              <div
                className="absolute inset-x-0 bottom-0 h-2/3"
                style={{
                  background: `linear-gradient(to top, ${cat.palette.bg} 20%, transparent)`,
                }}
              />

              {/* Content */}
              <div className="relative p-6 lg:p-8 flex flex-col h-full min-h-[160px] justify-end">
                <div className="absolute top-5 right-5">
                  <ArrowRight size={14} className="opacity-0 group-hover:opacity-70 transition-all duration-300 -translate-x-2 group-hover:translate-x-0" style={{ color: cat.palette.text }} />
                </div>

                <h3 className="text-base font-semibold mb-1" style={{ color: cat.palette.text }}>
                  {cat.name}
                </h3>
                <p className="font-arabic text-sm opacity-60" style={{ color: cat.palette.text }}>
                  {cat.nameAr}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function useCountUp(target: number, duration = 1500, start = false, instant = false) {
  const [value, setValue] = useState(instant ? target : 0);
  const rafRef = useRef<number>(undefined);

  useEffect(() => {
    if (!start || instant) return;
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
  const [skipAnimations] = useState(() => {
    if (typeof window === "undefined") return false;
    if (sessionStorage.getItem("homepage-visited")) return true;
    sessionStorage.setItem("homepage-visited", "1");
    return false;
  });
  const [mounted, setMounted] = useState(skipAnimations);

  useEffect(() => {
    if (!mounted) setMounted(true);
  }, []);

  const chunksCount = useCountUp(650, 1800, mounted, skipAnimations);
  const booksCount = useCountUp(2500, 2000, mounted, skipAnimations);

  const handleSearch = (q?: string) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    router.push(`/chat?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <CitationOverlayProvider>
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* ============================================================
          HERO SECTION
          ============================================================ */}
      <section className="relative overflow-hidden min-h-[calc(100vh-5rem)] flex items-center">
        {/* Layered background */}
        <div className="absolute inset-0 bg-gradient-to-b from-muted/80 via-background to-background" />
        <div className="absolute inset-0 opacity-[0.07]">
          <GeometricPattern />
        </div>

        <div className="relative mx-auto max-w-7xl w-full px-page py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

            {/* Left column: text + search */}
            <div className="lg:col-span-7 space-y-8">
              {/* Heading */}
              <div>
                <h1
                  className={cn(
                    "font-heading font-bold text-2xl sm:text-3xl md:text-4xl leading-[1.12] tracking-tight text-foreground whitespace-nowrap",
                    !skipAnimations && "transition-all duration-700 delay-100",
                    mounted || skipAnimations ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  )}
                >
                  AI-Powered Islamic <span className="hero-gradient-text">Scholarship</span>
                </h1>
                <p
                  className={cn(
                    "mt-6 text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl",
                    !skipAnimations && "transition-all duration-700 delay-200",
                    mounted || skipAnimations ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  )}
                >
                  Explore centuries of Islamic scholarship through AI. Ask questions,
                  read classical texts, and discover insights grounded in authentic sources.
                </p>
              </div>

              {/* Search Box */}
              <div
                className={cn(
                  "max-w-xl",
                  !skipAnimations && "transition-all duration-700 delay-300",
                  mounted || skipAnimations ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
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
                      className="mr-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:shadow-md hover:brightness-110 disabled:opacity-30 disabled:shadow-none transition-all duration-300 flex items-center gap-2"
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
                        mounted || skipAnimations ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                      )}
                      style={{ transitionDelay: !skipAnimations && mounted ? `${400 + i * 60}ms` : "0ms" }}
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
                "lg:col-span-5 hidden lg:flex items-center justify-center",
                !skipAnimations && "transition-all duration-1000 delay-500",
                mounted || skipAnimations ? "opacity-100 scale-100" : "opacity-0 scale-95"
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
          ANSWER PREVIEW SECTION
          ============================================================ */}
      <AnswerPreviewSection skipAnimations={skipAnimations} />

      {/* ============================================================
          CATEGORIES SECTION
          ============================================================ */}
      <BrowseBySubjectSection skipAnimations={skipAnimations} />

      <Footer />
    </div>
    </CitationOverlayProvider>
  );
}
