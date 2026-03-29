"use client";

import type { ChatMessage } from "@/types";
import { cn, detectDirection } from "@/lib/utils";
import { User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CitationRenderer, SourcesPanel } from "./citation-renderer";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const dir = detectDirection(message.content);

  return (
    <div
      className={cn(
        "flex gap-3 animate-slide-up",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {/* Assistant avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center shadow-soft mt-1">
          <Bot size={16} className="text-white" />
        </div>
      )}

      {/* Message content */}
      <div
        className={cn(
          "max-w-[80%] md:max-w-[70%] rounded-2xl px-5 py-4",
          isUser
            ? "bg-gradient-to-br from-gold-600 to-gold-700 text-white rounded-tr-md shadow-md"
            : "bg-card border border-border/50 text-ink-800 rounded-tl-md shadow-soft"
        )}
      >
        {isUser ? (
          <p
            className="text-sm leading-relaxed whitespace-pre-wrap"
            dir={dir}
            style={{ textAlign: dir === "rtl" ? "right" : "left" }}
          >
            {message.content}
          </p>
        ) : (
          <div className="chat-markdown text-sm">
            {message.sources && message.sources.length > 0 ? (
              <CitationRenderer
                content={message.content}
                sources={message.sources}
              />
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            )}

            {/* Streaming cursor */}
            {message.isStreaming && (
              <span className="inline-block w-2 h-4 bg-gold-500 ml-0.5 animate-pulse-gentle rounded-sm" />
            )}
          </div>
        )}

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourcesPanel sources={message.sources} />
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-parchment-200 flex items-center justify-center mt-1">
          <User size={16} className="text-ink-500" />
        </div>
      )}
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center shadow-soft">
        <Bot size={16} className="text-white" />
      </div>
      <div className="bg-card border border-border/50 rounded-2xl rounded-tl-md px-5 py-4 shadow-soft">
        <div className="flex items-center gap-1.5">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}
