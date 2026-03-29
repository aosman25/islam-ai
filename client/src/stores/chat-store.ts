import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Chat, ChatMessage } from "@/types";
import { generateId } from "@/lib/utils";

interface ChatStore {
  chats: Chat[];
  activeChatId: string | null;

  // Getters
  getActiveChat: () => Chat | undefined;

  // Actions
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
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      chats: [],
      activeChatId: null,

      getActiveChat: () => {
        const { chats, activeChatId } = get();
        return chats.find((c) => c.id === activeChatId);
      },

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

      deleteChat: (id) =>
        set((state) => ({
          chats: state.chats.filter((c) => c.id !== id),
          activeChatId:
            state.activeChatId === id ? null : state.activeChatId,
        })),

      clearChats: () => set({ chats: [], activeChatId: null }),

      setActiveChat: (id) => set({ activeChatId: id }),

      addMessage: (chatId, message) =>
        set((state) => ({
          chats: state.chats.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  messages: [...c.messages, message],
                  updatedAt: Date.now(),
                }
              : c
          ),
        })),

      updateMessage: (chatId, messageId, updates) =>
        set((state) => ({
          chats: state.chats.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === messageId ? { ...m, ...updates } : m
                  ),
                  updatedAt: Date.now(),
                }
              : c
          ),
        })),

      updateChatTitle: (chatId, title) =>
        set((state) => ({
          chats: state.chats.map((c) =>
            c.id === chatId ? { ...c, title } : c
          ),
        })),
    }),
    {
      name: "athars-chat-store",
    }
  )
);
