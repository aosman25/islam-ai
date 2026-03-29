"use client";

import { useMemo } from "react";
import type { ChatMessage } from "@/types";
import type { SourceData } from "@/types";
import { cn, detectDirection } from "@/lib/utils";
import { User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  stripIncompleteCitation,
  CitationRenderer,
  SourcesPanel,
} from "./citation-renderer";

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

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const dir = detectDirection(message.content);

  const displayContent = useMemo(() => {
    if (message.isStreaming) {
      return stripIncompleteCitation(message.content);
    }
    return message.content;
  }, [message.content, message.isStreaming]);

  const hasCitations =
    !isUser && message.sources && message.sources.length > 0;
  const isStreaming = !!message.isStreaming;

  // User message: right-aligned, compact grey bubble
  if (isUser) {
    return (
      <div className="flex justify-end animate-slide-up">
        <bdi
          className="flex flex-col gap-1 bg-muted text-foreground rounded-3xl px-4 py-2 font-medium max-w-[80%] md:max-w-[70%]"
          dir={dir}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </bdi>
      </div>
    );
  }

  // Assistant message: full-width, no bubble
  return (
    <div className="flex gap-3 animate-slide-up">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center shadow-soft mt-1">
        <Bot size={16} className="text-white" />
      </div>

      <div className="flex-1 min-w-0 pt-1">
        <div
          className="chat-markdown text-sm text-ink-800"
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
                  }
                : undefined
            }
          >
            {displayContent}
          </ReactMarkdown>

          {message.isStreaming && (
            <span className="inline-block w-2 h-4 bg-gold-500 ml-0.5 animate-pulse-gentle rounded-sm" />
          )}
        </div>

        {hasCitations && <SourcesPanel sources={message.sources!} />}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-gold-500 to-gold-700 flex items-center justify-center shadow-soft">
        <Bot size={16} className="text-white" />
      </div>
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
