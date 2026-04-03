"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { MessageBubble } from "@/components/chat/message-bubble";
import { GeometricBotIcon } from "@/components/chat/geometric-bot-icon";
import { CitationOverlayProvider } from "@/components/chat/citation-renderer";
import { useChat } from "@/hooks/use-chat";
import { useChatSync } from "@/hooks/use-chat-sync";
import { useChatStore } from "@/stores/chat-store";
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
  LogIn,
  PenSquare,
  PanelLeftOpen,
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
  const router = useRouter();
  const initialQuery = searchParams.get("q");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [sidebarInitialized, setSidebarInitialized] = useState(false);
  if (!sidebarInitialized && typeof window !== "undefined") {
    if (window.innerWidth >= 768) setSidebarOpen(true);
    setSidebarInitialized(true);
  }
  const [input, setInput] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialQuerySent = useRef(false);

  // Sync auth state and load conversations
  const { synced, loadMoreConversations, loadMessages, loadOlderMessages } = useChatSync();

  const { messages, isLoading, sendMessage, stopGeneration } = useChat();
  const shouldBlock = useChatStore((s) => s.shouldBlockAnonymous());
  const activeChatId = useChatStore((s) => s.activeChatId);
  const activeChat = useChatStore((s) => s.getActiveChat());
  const loadingOlderRef = useRef(false);

  // Load messages when a chat is selected
  useEffect(() => {
    if (activeChatId) {
      loadMessages(activeChatId);
    }
  }, [activeChatId, loadMessages]);

  // Handle initial query from URL (wait for auth sync to avoid race condition)
  useEffect(() => {
    if (synced && initialQuery && !initialQuerySent.current) {
      initialQuerySent.current = true;
      // Start a fresh chat so the query doesn't go into an existing conversation
      useChatStore.getState().setActiveChat(null);
      sendMessage(initialQuery);
      // Remove q param so refreshing doesn't re-send
      router.replace("/chat", { scroll: false });
    }
  }, [synced, initialQuery, sendMessage, router]);

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

  // Scroll-to-bottom visibility + load older messages on scroll up
  const [isAtBottom, setIsAtBottom] = useState(true);
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const onScroll = async () => {
      const threshold = 100;
      setIsAtBottom(
        container.scrollHeight - container.scrollTop - container.clientHeight <
          threshold
      );

      // Load older messages when scrolling near top
      if (
        container.scrollTop < 100 &&
        !loadingOlderRef.current &&
        activeChat?.hasMoreMessages &&
        activeChatId
      ) {
        loadingOlderRef.current = true;
        const prevHeight = container.scrollHeight;
        await loadOlderMessages(activeChatId);
        // Maintain scroll position after prepending
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight - prevHeight;
        });
        loadingOlderRef.current = false;
      }
    };
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, [activeChatId, activeChat?.hasMoreMessages, loadOlderMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = () => {
    if (!input.trim() || isLoading || shouldBlock) return;
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
    <div className="flex h-dvh flex-col bg-background overflow-hidden">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <ChatSidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          onLoadMore={loadMoreConversations}
        />

        {/* Main Chat Area */}
        <main className="flex flex-1 flex-col min-w-0">
          {/* Mobile sidebar toggle */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden fixed top-[4.5rem] left-3 z-20 p-2 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground shadow-sm transition-colors"
              aria-label="Open sidebar"
            >
              <PanelLeftOpen size={18} />
            </button>
          )}

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
            <div ref={messagesEndRef} className="min-h-32 md:min-h-6 shrink-0" />
          </div>

          {/* Auth Prompt — replaces input when blocked */}
          {shouldBlock ? (
            <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                <MessageSquare size={22} className="text-primary" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-foreground mb-1">
                  Chat limit reached
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  You&apos;ve reached the conversation limit. Start a new chat or sign in for unlimited access and saved history.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    useChatStore.getState().clearChats();
                    useChatStore.getState().setActiveChat(null);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border bg-background text-foreground text-sm font-medium shadow-sm hover:bg-muted transition-colors"
                >
                  <PenSquare size={15} />
                  New Chat
                </button>
                <a
                  href="/auth/sign-in"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:opacity-90 transition-opacity"
                >
                  <LogIn size={15} />
                  Sign In
                </a>
              </div>
            </div>
          ) : (
          <>
          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="mx-auto flex w-full min-h-0 flex-col px-4 md:max-w-3xl fixed bottom-0 left-0 right-0 md:static md:pb-[env(safe-area-inset-bottom)]"
          >
            <div className="relative flex w-full flex-col gap-0 md:gap-4">
              {/* Scroll to bottom */}
              {!isAtBottom && !isEmpty && (
                <div className="absolute -top-12 left-1/2 z-20 -translate-x-1/2">
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
                  autoFocus={typeof window !== "undefined" && window.innerWidth >= 768}
                  className={cn(
                    "w-full resize-none rounded-3xl border border-border bg-background px-5 pt-5 pb-16 text-base placeholder:text-muted-foreground focus:outline-none focus-visible:!outline-none min-h-24 max-h-[65dvh] overflow-y-auto transition-shadow duration-300",
                    "md:rounded-b-3xl rounded-b-none border-b-0 md:border-b md:shadow-[0px_16px_32px_0px_#0000000A] md:focus:shadow-[0px_16px_32px_0px_#0000001A] focus-visible:!rounded-3xl md:focus-visible:!rounded-3xl focus-visible:!rounded-b-none md:focus-visible:!rounded-b-3xl",
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
          </>
          )}
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
          <GeometricBotIcon size={72} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">
            Ask me anything about Islam
          </h1>
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

