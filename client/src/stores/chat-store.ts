import { create } from "zustand";
import type { Chat, ChatMessage } from "@/types";
import { generateId } from "@/lib/utils";
import {
  deleteConversation,
  updateConversationTitle,
} from "@/lib/api";

// Max characters of message content to keep in memory per chat.
// Oldest messages are evicted when exceeded; scroll up reloads from DB.
// Anonymous users see a banner when they hit this limit.
const MAX_CHAT_CHARS = 200_000;

/** Measure total character size of messages in a chat (content + serialized sources) */
function chatCharSize(messages: ChatMessage[]): number {
  let size = 0;
  for (const m of messages) {
    size += m.content.length;
    if (m.sources) size += JSON.stringify(m.sources).length;
  }
  return size;
}

/**
 * Trim oldest messages from the front of the array until total size is under
 * the limit. Always keeps at least the last 4 messages (current exchange).
 * Returns the trimmed array and whether messages were evicted.
 */
function trimMessages(messages: ChatMessage[]): {
  trimmed: ChatMessage[];
  evicted: boolean;
} {
  if (chatCharSize(messages) <= MAX_CHAT_CHARS || messages.length <= 4) {
    return { trimmed: messages, evicted: false };
  }

  let start = 0;
  const minKeep = 4;
  const maxStart = messages.length - minKeep;

  while (start < maxStart && chatCharSize(messages.slice(start)) > MAX_CHAT_CHARS) {
    // Evict in pairs (user + assistant) to keep coherent history
    start += 2;
  }

  if (start === 0) return { trimmed: messages, evicted: false };
  return { trimmed: messages.slice(start), evicted: true };
}

interface ChatStore {
  chats: Chat[];
  activeChatId: string | null;
  isAuthenticated: boolean;
  userId: string | null;
  conversationsCursor: string | null;
  hasMoreConversations: boolean;

  // Getters
  getActiveChat: () => Chat | undefined;
  shouldBlockAnonymous: () => boolean;

  // Actions
  setAuth: (userId: string | null) => void;
  createChat: (firstMessage?: string) => string;
  deleteChat: (id: string) => void;
  clearChats: () => void;
  setActiveChat: (id: string | null) => void;
  addMessage: (chatId: string, message: ChatMessage) => void;
  updateMessage: (
    chatId: string,
    messageId: string,
    updates: Partial<ChatMessage>
  ) => void;
  updateChatTitle: (chatId: string, title: string) => void;
  loadChats: (chats: Chat[], cursor: string | null, hasMore: boolean) => void;
  appendChats: (chats: Chat[], cursor: string | null, hasMore: boolean) => void;
  prependMessages: (chatId: string, messages: ChatMessage[], hasMore: boolean) => void;
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  chats: [],
  activeChatId: null,
  isAuthenticated: false,
  userId: null,
  conversationsCursor: null,
  hasMoreConversations: false,

  getActiveChat: () => {
    const { chats, activeChatId } = get();
    return chats.find((c) => c.id === activeChatId);
  },

  shouldBlockAnonymous: () => {
    const { isAuthenticated, chats } = get();
    if (isAuthenticated) return false;
    const chat = chats.find((c) => c.id === get().activeChatId);
    if (!chat) return false;
    return chatCharSize(chat.messages) >= MAX_CHAT_CHARS;
  },

  setAuth: (userId) =>
    set({
      isAuthenticated: !!userId,
      userId,
    }),

  createChat: (firstMessage?: string) => {
    const id = generateId();
    const now = Date.now();
    const title = firstMessage
      ? firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "..." : "")
      : "New Conversation";
    const chat: Chat = {
      id,
      title,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      chats: [chat, ...state.chats],
      activeChatId: id,
    }));
    return id;
  },

  deleteChat: (id) => {
    const { isAuthenticated, userId } = get();
    set((state) => ({
      chats: state.chats.filter((c) => c.id !== id),
      activeChatId: state.activeChatId === id ? null : state.activeChatId,
    }));
    if (isAuthenticated && userId) {
      deleteConversation(userId, id).catch((e) =>
        console.error("Failed to delete conversation:", e)
      );
    }
  },

  clearChats: () =>
    set({
      chats: [],
      activeChatId: null,
      conversationsCursor: null,
      hasMoreConversations: false,
    }),

  setActiveChat: (id) => set({ activeChatId: id }),

  addMessage: (chatId, message) =>
    set((state) => ({
      chats: state.chats.map((c) => {
        if (c.id !== chatId) return c;
        const messages = [...c.messages, message];
        const { trimmed, evicted } = trimMessages(messages);
        return {
          ...c,
          messages: trimmed,
          updatedAt: Date.now(),
          hasMoreMessages: evicted || c.hasMoreMessages,
        };
      }),
    })),

  updateMessage: (chatId, messageId, updates) =>
    set((state) => ({
      chats: state.chats.map((c) => {
        if (c.id !== chatId) return c;
        const messages = c.messages.map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        );
        const { trimmed, evicted } = trimMessages(messages);
        return {
          ...c,
          messages: trimmed,
          updatedAt: Date.now(),
          hasMoreMessages: evicted || c.hasMoreMessages,
        };
      }),
    })),

  updateChatTitle: (chatId, title) => {
    const { isAuthenticated, userId } = get();
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, title } : c
      ),
    }));
    if (isAuthenticated && userId) {
      updateConversationTitle(userId, chatId, title).catch((e) =>
        console.error("Failed to update conversation title:", e)
      );
    }
  },

  loadChats: (chats, cursor, hasMore) =>
    set({
      chats,
      conversationsCursor: cursor,
      hasMoreConversations: hasMore,
    }),

  appendChats: (newChats, cursor, hasMore) =>
    set((state) => ({
      chats: [...state.chats, ...newChats],
      conversationsCursor: cursor,
      hasMoreConversations: hasMore,
    })),

  prependMessages: (chatId, messages, hasMore) =>
    set((state) => ({
      chats: state.chats.map((c) => {
        if (c.id !== chatId) return c;
        const allMessages = [...messages, ...c.messages];
        const { trimmed } = trimMessages(allMessages);
        return {
          ...c,
          messages: trimmed,
          hasMoreMessages: hasMore,
        };
      }),
    })),
}));
