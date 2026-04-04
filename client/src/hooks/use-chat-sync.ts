"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { useChatStore } from "@/stores/chat-store";
import { getConversations, getConversation, fetchChunks } from "@/lib/api";
import { getCachedSources, cacheSources } from "@/lib/source-cache";
import type { Chat, ChatMessage, SourceData } from "@/types";

const CITATION_REGEX = /\[(\d+(?:\s*[,،]\s*\d+)*)\]/g;

/** Extract all chunk IDs referenced as [id] in text */
function extractChunkIds(content: string): number[] {
  const ids = new Set<number>();
  for (const match of content.matchAll(CITATION_REGEX)) {
    for (const s of match[1].split(/[,،]/)) {
      const n = parseInt(s.trim(), 10);
      if (!isNaN(n)) ids.add(n);
    }
  }
  return [...ids];
}

/** Resolve sources for a batch of messages */
async function resolveSources(messages: ChatMessage[]) {
  const allChunkIds = new Set<number>();
  for (const msg of messages) {
    if (msg.role === "assistant") {
      for (const id of extractChunkIds(msg.content)) {
        allChunkIds.add(id);
      }
    }
  }

  if (allChunkIds.size === 0) return;

  const ids = [...allChunkIds];
  const { cached, missing } = getCachedSources(ids);
  const sourceMap = new Map<number, SourceData>();
  for (const s of cached) sourceMap.set(s.id, s);

  if (missing.length > 0) {
    try {
      const fetched = await fetchChunks(missing);
      cacheSources(fetched);
      for (const s of fetched) sourceMap.set(s.id, s);
    } catch (error) {
      console.error("Failed to fetch chunk sources:", error);
    }
  }

  for (const msg of messages) {
    if (msg.role === "assistant") {
      const chunkIds = extractChunkIds(msg.content);
      if (chunkIds.length > 0) {
        msg.sources = chunkIds
          .map((id) => sourceMap.get(id))
          .filter((s): s is SourceData => !!s);
      }
    }
  }
}

/**
 * Syncs chat store with auth state and handles pagination.
 */
export function useChatSync() {
  const session = authClient.useSession();
  const user = session.data?.user;
  const sessionPending = session.isPending;
  const syncingRef = useRef(false);
  const [synced, setSynced] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const { setAuth, loadChats, clearChats, isAuthenticated } = useChatStore();

  // Keep auth state in sync
  useEffect(() => {
    if (user?.id && !isAuthenticated) {
      setAuth(user.id);
    } else if (!user && isAuthenticated) {
      setAuth(null);
    }
  }, [user, isAuthenticated, setAuth]);

  // Load first page of conversations on auth
  useEffect(() => {
    if (sessionPending) return;

    if (!user?.id) {
      // Use a microtask to avoid synchronous setState in effect
      queueMicrotask(() => setSynced(true));
      return;
    }

    if (syncingRef.current) return;
    syncingRef.current = true;

    const sync = async () => {
      clearChats();

      try {
        const page = await getConversations(user.id, { limit: 20 });
        const chats: Chat[] = page.data.map((conv) => ({
          id: conv.id,
          title: conv.title,
          messages: [],
          createdAt: new Date(conv.created_at).getTime(),
          updatedAt: new Date(conv.updated_at).getTime(),
          hasMoreMessages: false,
        }));
        loadChats(chats, page.nextCursor, page.hasMore);
      } catch (error) {
        console.error("Failed to load conversations:", error);
      }

      syncingRef.current = false;
      setSynced(true);
    };

    sync();
  }, [user?.id, sessionPending, clearChats, loadChats]);

  // Load more conversations (for sidebar infinite scroll)
  const loadMoreConversations = useCallback(async () => {
    const { userId, conversationsCursor, hasMoreConversations } =
      useChatStore.getState();
    if (!userId || !hasMoreConversations || !conversationsCursor) return;

    try {
      const page = await getConversations(userId, {
        limit: 20,
        cursor: conversationsCursor,
      });
      const newChats: Chat[] = page.data.map((conv) => ({
        id: conv.id,
        title: conv.title,
        messages: [],
        createdAt: new Date(conv.created_at).getTime(),
        updatedAt: new Date(conv.updated_at).getTime(),
        hasMoreMessages: false,
      }));
      useChatStore.getState().appendChats(newChats, page.nextCursor, page.hasMore);
    } catch (error) {
      console.error("Failed to load more conversations:", error);
    }
  }, []);

  // Load messages for a conversation (last 10)
  const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const loadMessages = useCallback(async (chatId: string) => {
    const { userId } = useChatStore.getState();
    if (!userId || !isUuid(chatId)) return;

    const chat = useChatStore.getState().chats.find((c) => c.id === chatId);
    if (!chat || chat.messages.length > 0) return; // Already loaded

    setLoadingMessages(true);
    try {
      const detail = await getConversation(userId, chatId, {
        messagesLimit: 10,
      });
      const messages: ChatMessage[] = detail.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: undefined,
        categories: undefined,
        timestamp: Number(m.timestamp),
      }));

      await resolveSources(messages);

      useChatStore.setState((state) => ({
        chats: state.chats.map((c) =>
          c.id === chatId
            ? { ...c, messages, hasMoreMessages: detail.hasMoreMessages }
            : c
        ),
      }));
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Fetch older messages for a conversation (does NOT commit to store — caller does that)
  const fetchOlderMessages = useCallback(async (chatId: string) => {
    const { userId } = useChatStore.getState();
    if (!userId || !isUuid(chatId)) return null;

    const chat = useChatStore.getState().chats.find((c) => c.id === chatId);
    if (!chat || !chat.hasMoreMessages || chat.messages.length === 0) return null;

    const oldestTimestamp = Math.min(
      ...chat.messages.map((m) => m.timestamp)
    );

    try {
      const detail = await getConversation(userId, chatId, {
        messagesLimit: 10,
        before: oldestTimestamp,
      });
      const olderMessages: ChatMessage[] = detail.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: undefined,
        categories: undefined,
        timestamp: Number(m.timestamp),
      }));

      await resolveSources(olderMessages);

      return { messages: olderMessages, hasMore: detail.hasMoreMessages };
    } catch (error) {
      console.error("Failed to load older messages:", error);
      return null;
    }
  }, []);

  return { synced, loadingMessages, loadMoreConversations, loadMessages, fetchOlderMessages };
}
