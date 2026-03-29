"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { MessageBubble, TypingIndicator } from "@/components/chat/message-bubble";
import { useChat } from "@/hooks/use-chat";
import { cn, detectDirection } from "@/lib/utils";
import {
  Send,
  Square,
  Sparkles,
  BookOpen,
  MessageSquare,
  Lightbulb,
  Compass,
} from "lucide-react";

const SUGGESTED_ACTIONS = [
  {
    icon: BookOpen,
    label: "Explain a Verse",
    query: "What does the Quran say about patience and how scholars have interpreted it?",
  },
  {
    icon: Sparkles,
    label: "Find a Hadith",
    query: "What are the most authentic hadith about the virtues of seeking knowledge?",
  },
  {
    icon: Lightbulb,
    label: "Explore a Concept",
    query: "Explain the concept of Ihsan in Islam and its significance in worship.",
  },
  {
    icon: Compass,
    label: "Compare Opinions",
    query: "What are the different scholarly opinions on the definition of Bid'ah?",
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialQuerySent = useRef(false);

  const { messages, isLoading, isThinking, sendMessage, stopGeneration } =
    useChat();

  // Handle initial query from URL
  useEffect(() => {
    if (initialQuery && !initialQuerySent.current) {
      initialQuerySent.current = true;
      sendMessage(initialQuery);
    }
  }, [initialQuery, sendMessage]);

  // Scroll to bottom only when user sends a new message, not during streaming
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
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

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
    <div className="h-screen flex flex-col bg-background">
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <ChatSidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col min-w-0">
          {isEmpty ? (
            /* ============================================================
               EMPTY STATE
               ============================================================ */
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="max-w-2xl w-full text-center">
                {/* Welcome */}
                <div className="mb-10 animate-fade-in">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-500 to-gold-700 shadow-glow mb-6">
                    <MessageSquare size={28} className="text-white" />
                  </div>
                  <h1 className="font-display text-3xl font-bold text-ink-900 mb-3">
                    Assalamu Alaikum
                  </h1>
                  <p className="text-ink-500 text-base max-w-md mx-auto">
                    Ask any question about Islamic knowledge. I&apos;ll search through
                    classical texts and provide answers with source citations.
                  </p>
                </div>

                {/* Suggested Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-slide-up stagger-2">
                  {SUGGESTED_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => sendMessage(action.query)}
                      className="group text-left p-4 rounded-xl border border-border/50 bg-card hover:border-gold-200 hover:bg-gold-50/30 shadow-soft hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <action.icon
                          size={16}
                          className="text-gold-600 group-hover:text-gold-700"
                        />
                        <span className="text-sm font-medium text-ink-800">
                          {action.label}
                        </span>
                      </div>
                      <p className="text-xs text-ink-400 leading-relaxed line-clamp-2">
                        {action.query}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================
               MESSAGES
               ============================================================ */
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                {isThinking && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {/* ============================================================
             INPUT BAR
             ============================================================ */}
          <div className="border-t border-border/40 bg-background/80 backdrop-blur-lg">
            <div className="max-w-3xl mx-auto px-4 py-4">
              <div className="relative flex items-end gap-2 bg-card border border-border/60 rounded-xl shadow-soft focus-within:shadow-md focus-within:border-gold-300 transition-all duration-200">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about Islamic knowledge..."
                  dir={dir}
                  rows={1}
                  className={cn(
                    "flex-1 resize-none bg-transparent px-4 py-3.5 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none min-h-[48px] max-h-[200px]",
                    dir === "rtl" && "text-right"
                  )}
                />
                <div className="flex items-center gap-1 pr-2 pb-2">
                  {isLoading ? (
                    <button
                      onClick={stopGeneration}
                      className="p-2 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
                      title="Stop generating"
                    >
                      <Square size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={!input.trim()}
                      className="p-2 rounded-lg bg-gradient-to-r from-gold-600 to-gold-700 text-white disabled:opacity-30 disabled:shadow-none shadow-soft hover:shadow-glow transition-all duration-200"
                      title="Send message"
                    >
                      <Send size={16} />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-center text-[10px] text-ink-400 mt-2.5">
                AI can make mistakes. Verify important information with scholars.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
