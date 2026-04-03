"use client";

import { useMemo, useState, useEffect } from "react";
import type { ChatMessage } from "@/types";
import type { SourceData } from "@/types";
import { cn, detectDirection } from "@/lib/utils";
import { GeometricBotIcon } from "./geometric-bot-icon";
import { Search, BookOpen, Sparkles, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  stripIncompleteCitation,
  CitationRenderer,
  SourcesPanel,
} from "./citation-renderer";

const DETAILED_ANSWER_MARKER = "<!-- DETAILED_ANSWER -->";

function splitAnswer(content: string): { simple: string; scholarly: string | null } {
  const idx = content.indexOf(DETAILED_ANSWER_MARKER);
  if (idx === -1) return { simple: content, scholarly: null };
  return {
    simple: content.slice(0, idx).trim(),
    scholarly: content.slice(idx + DETAILED_ANSWER_MARKER.length).trim() || null,
  };
}

interface MessageBubbleProps {
  message: ChatMessage;
}

function processChildren(
  children: React.ReactNode,
  sources: SourceData[],
  isStreaming: boolean
): React.ReactNode {
  if (!Array.isArray(children)) {
    if (typeof children === "string") {
      return (
        <CitationRenderer
          text={children}
          sources={sources}
          isStreaming={isStreaming}
        />
      );
    }
    return children;
  }

  return children.map((child, i) => {
    if (typeof child === "string") {
      return (
        <CitationRenderer
          key={i}
          text={child}
          sources={sources}
          isStreaming={isStreaming}
        />
      );
    }
    return child;
  });
}

/* ── Elapsed timer ── */
function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (elapsed < 1) return null;
  return (
    <span className="text-xs tabular-nums text-muted-foreground/60 ml-2">
      {elapsed}s
    </span>
  );
}

/* ── Phase indicator ── */
const PHASE_CONFIG = {
  searching: { icon: Search, label: "Searching sources..." },
  reading: { icon: BookOpen, label: "Reading documents..." },
  generating: { icon: Sparkles, label: "Generating answer..." },
} as const;

function StreamPhaseIndicator({
  phase,
  startedAt,
}: {
  phase: "searching" | "reading" | "generating";
  startedAt?: number;
}) {
  const config = PHASE_CONFIG[phase];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 pt-0.5">
      <Icon
        size={14}
        className="text-primary animate-pulse-gentle"
      />
      <span className="text-sm italic bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer">
        {config.label}
      </span>
      {startedAt && <ElapsedTime startedAt={startedAt} />}
    </div>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const dir = detectDirection(message.content);
  const [scholarlyExpanded, setScholarlyExpanded] = useState(false);

  const displayContent = useMemo(() => {
    if (message.isStreaming) {
      return stripIncompleteCitation(message.content);
    }
    return message.content;
  }, [message.content, message.isStreaming]);

  const { simple, scholarly } = useMemo(
    () => splitAnswer(displayContent),
    [displayContent]
  );

  const hasCitations =
    !isUser && message.sources && message.sources.length > 0;
  const isStreaming = !!message.isStreaming;

  // User message: right-aligned, compact grey bubble
  if (isUser) {
    return (
      <div className="flex justify-end animate-slide-up">
        <bdi
          className={cn("flex flex-col gap-1 bg-muted text-foreground rounded-3xl px-4 py-2 font-medium max-w-[80%] md:max-w-[70%]", dir === "rtl" && "font-arabic")}
          dir={dir}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </bdi>
      </div>
    );
  }

  // Assistant message
  return (
    <div
      className={cn(
        "flex gap-3 animate-slide-up rounded-xl transition-all duration-500",
        isStreaming && !displayContent.trim() ? "items-center py-2 -mx-2 px-2 bg-primary/[0.07] shadow-[0_0_24px_-2px] shadow-primary/25" : isStreaming && !scholarly ? "items-start py-2 -mx-2 px-2 bg-primary/[0.07] shadow-[0_0_24px_-2px] shadow-primary/25" : "items-start"
      )}
    >
      <GeometricBotIcon isAnimating={isStreaming} className={cn(displayContent.trim() && "mt-1")} />

      <div className={cn("flex-1 min-w-0", displayContent.trim() && "pt-1")}>
        {/* Phase indicator — shown before content arrives */}
        {isStreaming && !displayContent.trim() && message.streamPhase && (
          <StreamPhaseIndicator
            phase={message.streamPhase}
            startedAt={message.streamStartedAt}
          />
        )}

        {/* Phase badge + timer — shown alongside content while generating (only before scholarly) */}
        {isStreaming && displayContent.trim() && !scholarly && message.streamPhase && (
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs text-primary/70 font-medium flex items-center gap-1">
              <Sparkles size={10} className="animate-pulse-gentle" />
              Generating
            </span>
            {message.streamStartedAt && (
              <ElapsedTime startedAt={message.streamStartedAt} />
            )}
          </div>
        )}

        {simple.trim() && (
          <>
            <div
              className={cn(
                "chat-markdown text-sm text-foreground",
                dir === "rtl" && "font-arabic",
                isStreaming && !scholarly && "[&>*:last-child]:animate-[token-reveal_0.15s_ease-out]"
              )}
              style={{
                direction: dir,
                textAlign: dir === "rtl" ? "right" : "left",
              }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={
                  hasCitations
                    ? {
                        p: ({ children }) => (
                          <p>
                            {processChildren(
                              children,
                              message.sources!,
                              isStreaming
                            )}
                          </p>
                        ),
                        li: ({ children }) => (
                          <li>
                            {processChildren(
                              children,
                              message.sources!,
                              isStreaming
                            )}
                          </li>
                        ),
                        h2: ({ children }) => (
                          <h2>
                            {processChildren(
                              children,
                              message.sources!,
                              isStreaming
                            )}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3>
                            {processChildren(
                              children,
                              message.sources!,
                              isStreaming
                            )}
                          </h3>
                        ),
                      }
                    : undefined
                }
              >
                {simple}
              </ReactMarkdown>

              {isStreaming && !scholarly && (
                <span className="inline-block w-2 h-4 bg-primary ml-0.5 animate-pulse-gentle rounded-sm" />
              )}
            </div>

            {/* Scholarly detailed answer — collapsible */}
            {scholarly && (
              <div className={cn(
                "mt-3 rounded-lg transition-all duration-500",
                dir === "rtl" && "flex flex-col items-end",
                isStreaming && "py-2 -mx-2 px-2 bg-primary/[0.05] shadow-[0_0_20px_-4px] shadow-primary/20 animate-pulse-gentle"
              )}>
                <button
                  onClick={() => setScholarlyExpanded((v) => !v)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-medium transition-colors px-2 py-1 rounded-md",
                    isStreaming
                      ? "text-primary bg-gradient-to-r from-primary/80 via-primary to-primary/80 bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    dir === "rtl" && "flex-row-reverse"
                  )}
                >
                  <BookOpen size={13} className={cn(isStreaming && "text-primary animate-pulse-gentle")} />
                  <span>{dir === "rtl" ? "عرض الإجابة التفصيلية" : "Show detailed answer"}</span>
                  <ChevronDown
                    size={13}
                    className={cn(
                      "transition-transform duration-200",
                      scholarlyExpanded && "rotate-180",
                      isStreaming && "text-primary animate-pulse-gentle"
                    )}
                  />
                  {isStreaming && (
                    <span className="text-xs text-primary/60 flex items-center gap-1 ml-1.5">
                      <Sparkles size={10} className="animate-pulse-gentle" />
                    </span>
                  )}
                </button>

                {scholarlyExpanded && (
                  <div
                    className={cn(
                      "mt-2 chat-markdown text-sm text-foreground",
                      dir === "rtl" ? "font-arabic border-r-2 border-primary/20 pr-4" : "border-l-2 border-primary/20 pl-4",
                      isStreaming && "[&>*:last-child]:animate-[token-reveal_0.15s_ease-out]"
                    )}
                    style={{
                      direction: dir,
                      textAlign: dir === "rtl" ? "right" : "left",
                    }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={
                        hasCitations
                          ? {
                              p: ({ children }) => (
                                <p>
                                  {processChildren(
                                    children,
                                    message.sources!,
                                    isStreaming
                                  )}
                                </p>
                              ),
                              li: ({ children }) => (
                                <li>
                                  {processChildren(
                                    children,
                                    message.sources!,
                                    isStreaming
                                  )}
                                </li>
                              ),
                              h2: ({ children }) => (
                                <h2>
                                  {processChildren(
                                    children,
                                    message.sources!,
                                    isStreaming
                                  )}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3>
                                  {processChildren(
                                    children,
                                    message.sources!,
                                    isStreaming
                                  )}
                                </h3>
                              ),
                            }
                          : undefined
                      }
                    >
                      {scholarly}
                    </ReactMarkdown>

                    {isStreaming && (
                      <span className="inline-block w-2 h-4 bg-primary ml-0.5 animate-pulse-gentle rounded-sm" />
                    )}
                  </div>
                )}
              </div>
            )}

            {hasCitations && !isStreaming && (
              <SourcesPanel sources={message.sources!} content={message.content} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <GeometricBotIcon isAnimating />
      <div className="pt-1">
        <div className="flex items-center gap-1.5 py-2">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}
