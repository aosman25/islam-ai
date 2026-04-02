"use client";

import { useState, useCallback, useRef } from "react";
import { useChatStore } from "@/stores/chat-store";
import { gatewayQuery, createConversation, addMessages } from "@/lib/api";
import { cacheSources } from "@/lib/source-cache";
import { generateId } from "@/lib/utils";
import type {
  ChatMessage,
  ChatHistoryMessage,
  SourceData,
  GatewayStreamChunk,
} from "@/types";

export function useChat() {
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pendingPersistRef = useRef<(() => void) | null>(null);

  const {
    chats,
    activeChatId,
    getActiveChat,
    createChat,
    addMessage,
    updateMessage,
    updateChatTitle,
    setActiveChat,
    isAuthenticated,
    userId,
  } = useChatStore();

  const activeChat = getActiveChat();
  const messages = activeChat?.messages ?? [];

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      // Block anonymous users at char limit
      if (useChatStore.getState().shouldBlockAnonymous()) return;

      // Create or get chat
      let chatId = activeChatId;
      if (!chatId) {
        chatId = createChat(content);
      }

      // Capture prior messages BEFORE adding new ones (use getState for fresh store state)
      const freshChat = useChatStore
        .getState()
        .chats.find((c) => c.id === chatId);
      const priorMessages = freshChat?.messages ?? [];
      const chatHistory: ChatHistoryMessage[] = priorMessages
        .filter((m) => m.content.trim())
        .map((m) => ({ role: m.role, content: m.content }));

      // Add user message
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };
      addMessage(chatId, userMsg);

      // Update title if first message
      if (priorMessages.length === 0) {
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

      const abortController = new AbortController();
      abortRef.current = abortController;

      let accumulatedContent = "";
      let sources: SourceData[] = [];
      let categories: string[] = [];

      // Set up persist callback so stopGeneration can call it
      pendingPersistRef.current = () => {
        if (isAuthenticated && userId && accumulatedContent) {
          if (sources.length > 0) cacheSources(sources);
          persistMessages(userId, chatId!, priorMessages.length === 0, content.trim(), {
            userMsg,
            assistantContent: accumulatedContent,
          });
        }
      };

      await gatewayQuery(
        {
          query: content.trim(),
          chat_history: chatHistory.length > 0 ? chatHistory : undefined,
          stream: true,
          top_k: 20,
          temperature: 1,
          max_tokens: 65536,
          reranker: "RRF",
          reranker_params: [60],
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

            // Persist to DB and cache sources
            pendingPersistRef.current?.();
            pendingPersistRef.current = null;
          }
        },
        // onError
        (error: Error) => {
          if (error.name === "AbortError") return;
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
          abortRef.current = null;
        },
        abortController.signal
      );
    },
    [
      activeChatId,
      isLoading,
      chats,
      isAuthenticated,
      userId,
      createChat,
      addMessage,
      updateMessage,
      updateChatTitle,
    ]
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setIsThinking(false);

    // Finalize any streaming message
    const chat = getActiveChat();
    if (chat) {
      const streamingMsg = chat.messages.find((m) => m.isStreaming);
      if (streamingMsg) {
        updateMessage(chat.id, streamingMsg.id, {
          isStreaming: false,
          content: streamingMsg.content || "*Answer generation was stopped.*",
        });
      }
    }

    // Persist truncated answer
    pendingPersistRef.current?.();
    pendingPersistRef.current = null;
  }, [getActiveChat, updateMessage]);

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

/**
 * Persist user + assistant messages to the DB in the background.
 */
async function persistMessages(
  userId: string,
  chatId: string,
  isNewChat: boolean,
  userContent: string,
  data: {
    userMsg: ChatMessage;
    assistantContent: string;
  }
) {
  try {
    const chat = useChatStore.getState().chats.find((c) => c.id === chatId);

    if (isNewChat) {
      await createConversation(userId, {
        title: chat?.title || userContent.slice(0, 60),
        messages: [
          {
            role: "user" as const,
            content: userContent,
            timestamp: data.userMsg.timestamp,
          },
          {
            role: "assistant" as const,
            content: data.assistantContent,
            timestamp: Date.now(),
          },
        ],
      });
    } else {
      await addMessages(userId, chatId, [
        {
          role: "user",
          content: userContent,
          timestamp: data.userMsg.timestamp,
        },
        {
          role: "assistant",
          content: data.assistantContent,
          timestamp: Date.now(),
        },
      ]);
    }
  } catch (error) {
    console.error("Failed to persist messages:", error);
  }
}
