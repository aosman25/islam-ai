"use client";

import { useState, useCallback, useRef } from "react";
import { useChatStore } from "@/stores/chat-store";
import { gatewayQuery } from "@/lib/api";
import { generateId } from "@/lib/utils";
import type { ChatMessage, SourceData, GatewayStreamChunk } from "@/types";

export function useChat() {
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const {
    chats,
    activeChatId,
    getActiveChat,
    createChat,
    addMessage,
    updateMessage,
    updateChatTitle,
    setActiveChat,
  } = useChatStore();

  const activeChat = getActiveChat();
  const messages = activeChat?.messages ?? [];

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      // Create or get chat
      let chatId = activeChatId;
      if (!chatId) {
        chatId = createChat(content);
      }

      // Add user message
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };
      addMessage(chatId, userMsg);

      // Update title if first message
      const chat = chats.find((c) => c.id === chatId);
      if (chat && chat.messages.length === 0) {
        updateChatTitle(chatId, content.trim().slice(0, 60));
      }

      // Create assistant message placeholder
      const assistantMsgId = generateId();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };
      addMessage(chatId, assistantMsg);

      setIsLoading(true);
      setIsThinking(true);

      let accumulatedContent = "";
      let sources: SourceData[] = [];
      let categories: string[] = [];

      await gatewayQuery(
        {
          query: content.trim(),
          stream: true,
          top_k: 10,
          temperature: 0.7,
          max_tokens: 4096,
        },
        // onChunk
        (chunk: GatewayStreamChunk) => {
          setIsThinking(false);

          if (chunk.type === "metadata") {
            if (chunk.sources) sources = chunk.sources;
            if (chunk.categories) categories = chunk.categories;
            updateMessage(chatId!, assistantMsgId, {
              sources,
              categories,
            });
          }

          if (chunk.type === "content" && chunk.delta) {
            accumulatedContent += chunk.delta;
            updateMessage(chatId!, assistantMsgId, {
              content: accumulatedContent,
            });
          }

          if (chunk.type === "done") {
            updateMessage(chatId!, assistantMsgId, {
              isStreaming: false,
              content: accumulatedContent,
              sources,
              categories,
            });
          }
        },
        // onError
        (error: Error) => {
          updateMessage(chatId!, assistantMsgId, {
            content:
              accumulatedContent ||
              "I apologize, but I encountered an error processing your question. Please try again.",
            isStreaming: false,
          });
          console.error("Chat error:", error);
          setIsLoading(false);
          setIsThinking(false);
        },
        // onComplete
        () => {
          setIsLoading(false);
          setIsThinking(false);
        }
      );
    },
    [
      activeChatId,
      isLoading,
      chats,
      createChat,
      addMessage,
      updateMessage,
      updateChatTitle,
    ]
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
    setIsThinking(false);
  }, []);

  const startNewChat = useCallback(() => {
    setActiveChat(null);
  }, [setActiveChat]);

  return {
    messages,
    isLoading,
    isThinking,
    sendMessage,
    stopGeneration,
    startNewChat,
  };
}
