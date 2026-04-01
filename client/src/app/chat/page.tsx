"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { MessageBubble } from "@/components/chat/message-bubble";
import { CitationOverlayProvider } from "@/components/chat/citation-renderer";
import { useChat } from "@/hooks/use-chat";
import { cn, detectDirection } from "@/lib/utils";
import {
  Send,
  Square,
  BookOpen,
  Sparkles,
  Lightbulb,
  Compass,
  ArrowDown,
  MessageSquare,
} from "lucide-react";

const SUGGESTED_ACTIONS = [
  {
    icon: BookOpen,
    label: "Explain a Verse",
    query:
      "What does the Quran say about patience and how scholars have interpreted it?",
  },
  {
    icon: Sparkles,
    label: "Find a Hadith",
    query:
      "What are the most authentic hadith about the virtues of seeking knowledge?",
  },
  {
    icon: Lightbulb,
    label: "Explore a Concept",
    query:
      "Explain the concept of Ihsan in Islam and its significance in worship.",
  },
  {
    icon: Compass,
    label: "Compare Opinions",
    query:
      "What are the different scholarly opinions on the definition of Bid'ah?",
  },
];

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialQuerySent = useRef(false);

  const { messages, isLoading, sendMessage, stopGeneration } = useChat();

  // Handle initial query from URL
  useEffect(() => {
    if (initialQuery && !initialQuerySent.current) {
      initialQuerySent.current = true;
      sendMessage(initialQuery);
    }
  }, [initialQuery, sendMessage]);

  // Scroll to bottom when user sends a message
  const prevMsgCount = useRef(0);
  useEffect(() => {
    const userMsgCount = messages.filter((m) => m.role === "user").length;
    if (userMsgCount > prevMsgCount.current) {
      prevMsgCount.current = userMsgCount;
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight + 2, 300) + "px";
    }
  }, [input]);

  // Scroll-to-bottom visibility
  const [isAtBottom, setIsAtBottom] = useState(true);
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const threshold = 100;
      setIsAtBottom(
        container.scrollHeight - container.scrollTop - container.clientHeight <
          threshold
      );
    };
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const dir = detectDirection(input);
  const isEmpty = messages.length === 0;

  return (
    <CitationOverlayProvider>
    <div className="flex h-screen flex-col bg-background">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <ChatSidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Main Chat Area */}
        <main className="flex flex-1 flex-col min-w-0">
          {/* Messages / Greeting */}
          <div
            ref={messagesContainerRef}
            className="relative flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto pt-10"
          >
            {isEmpty ? (
              <Greeting sendMessage={sendMessage} />
            ) : (
              <div className="mx-auto w-full max-w-3xl px-5 space-y-6">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
              </div>
            )}
            <div ref={messagesEndRef} className="min-h-6 shrink-0" />
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="mx-auto flex w-full min-h-0 flex-col px-4 md:max-w-3xl"
          >
            <div className="relative flex w-full flex-col gap-4">
              {/* Scroll to bottom */}
              {!isAtBottom && !isEmpty && (
                <div className="absolute -top-12 left-1/2 z-50 -translate-x-1/2">
                  <button
                    type="button"
                    className="rounded-full border border-border bg-background p-2 shadow-md hover:bg-muted transition-colors"
                    onClick={scrollToBottom}
                  >
                    <ArrowDown className="size-4" />
                  </button>
                </div>
              )}

              {/* Textarea */}
              <div className="relative shrink-0">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={1500}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about Islamic knowledge..."
                  dir={dir}
                  rows={2}
                  autoFocus
                  className={cn(
                    "w-full resize-none rounded-3xl border border-border bg-background px-5 pt-5 pb-16 text-base shadow-[0px_16px_32px_0px_#0000000A] placeholder:text-muted-foreground focus:outline-none focus-visible:!outline-none focus-visible:!rounded-3xl focus:shadow-[0px_16px_32px_0px_#0000001A] min-h-24 max-h-[65dvh] overflow-y-auto transition-shadow duration-300",
                    "md:rounded-b-3xl rounded-b-none border-b-0 md:border-b",
                    dir === "rtl" && "text-right"
                  )}
                />

                {/* Action buttons inside textarea */}
                <div className="absolute right-0 bottom-0 left-0 flex flex-row justify-end gap-3 px-5 py-4">
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={stopGeneration}
                      className="flex items-center justify-center size-9 rounded-full bg-primary text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
                    >
                      <Square size={14} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="flex items-center justify-center size-9 rounded-full bg-primary text-primary-foreground disabled:opacity-30 shadow-sm hover:opacity-90 transition-opacity"
                    >
                      <Send size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <p className="text-muted-foreground my-3 hidden text-center text-xs md:block">
              AI can make mistakes. Verify important information with scholars.
            </p>
          </form>
        </main>
      </div>
    </div>
    </CitationOverlayProvider>
  );
}

function Greeting({ sendMessage }: { sendMessage: (q: string) => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center">
        <div className="mb-10 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary shadow-md mb-6">
            <MessageSquare size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            Assalamu Alaikum
          </h1>
          <p className="text-muted-foreground text-base max-w-md mx-auto">
            Ask any question about Islamic knowledge. I&apos;ll search through
            classical texts and provide answers with source citations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUGGESTED_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => sendMessage(action.query)}
              className="group text-left p-3 rounded-xl border border-border bg-card hover:border-accent hover:bg-accent/30 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <action.icon
                  size={14}
                  className="text-primary group-hover:text-secondary"
                />
                <span className="text-sm font-medium text-foreground">
                  {action.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {action.query}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

