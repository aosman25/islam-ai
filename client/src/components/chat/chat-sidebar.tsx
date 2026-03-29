"use client";

import { useChatStore } from "@/stores/chat-store";
import { cn, formatTime, truncate } from "@/lib/utils";
import {
  Plus,
  MessageSquare,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface ChatSidebarProps {
  open: boolean;
  onToggle: () => void;
}

export function ChatSidebar({ open, onToggle }: ChatSidebarProps) {
  const { chats, activeChatId, setActiveChat, createChat, deleteChat, clearChats } =
    useChatStore();

  return (
    <>
      {/* Toggle Button (always visible) */}
      <button
        onClick={onToggle}
        className="fixed top-20 left-3 z-40 p-2 rounded-lg bg-card border border-border/60 shadow-soft text-ink-500 hover:text-ink-800 hover:bg-parchment-100 transition-all md:hidden"
        aria-label="Toggle sidebar"
      >
        {open ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="fixed inset-0 bg-ink-950/20 backdrop-blur-sm z-30 md:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-16 left-0 z-30 h-[calc(100dvh-4rem)] w-72 bg-card border-r border-border/60 flex flex-col transition-transform duration-300 ease-spring",
          "md:relative md:top-0 md:translate-x-0 md:z-auto",
          open ? "translate-x-0" : "-translate-x-full md:-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/60">
          <h2 className="font-display text-sm font-semibold text-ink-700">
            Conversations
          </h2>
          <div className="flex items-center gap-1">
            {chats.length > 0 && (
              <button
                onClick={() => {
                  if (confirm("Clear all conversations?")) clearChats();
                }}
                className="p-1.5 rounded-md text-ink-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                title="Clear all"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={() => createChat()}
              className="p-1.5 rounded-md text-ink-400 hover:text-gold-700 hover:bg-gold-50 transition-colors"
              title="New chat"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto py-2">
          {chats.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <MessageSquare
                size={28}
                className="mx-auto text-parchment-400 mb-3"
              />
              <p className="text-xs text-ink-400">No conversations yet</p>
              <p className="text-xs text-ink-400 mt-1">
                Start by asking a question
              </p>
            </div>
          ) : (
            <div className="space-y-0.5 px-2">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setActiveChat(chat.id)}
                  className={cn(
                    "w-full text-left group flex items-start gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-150",
                    chat.id === activeChatId
                      ? "bg-gold-50 border border-gold-200/60"
                      : "hover:bg-parchment-100"
                  )}
                >
                  <MessageSquare
                    size={14}
                    className={cn(
                      "flex-shrink-0 mt-0.5",
                      chat.id === activeChatId
                        ? "text-gold-600"
                        : "text-ink-400"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm truncate",
                        chat.id === activeChatId
                          ? "text-gold-800 font-medium"
                          : "text-ink-700"
                      )}
                    >
                      {truncate(chat.title, 40)}
                    </p>
                    <p className="text-[10px] text-ink-400 mt-0.5">
                      {formatTime(chat.updatedAt)} &middot;{" "}
                      {chat.messages.length} msg
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                    className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 text-ink-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Desktop toggle */}
        <div className="hidden md:flex p-3 border-t border-border/60">
          <button
            onClick={onToggle}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-ink-500 hover:text-ink-700 hover:bg-parchment-100 transition-colors w-full"
          >
            <PanelLeftClose size={14} />
            Hide sidebar
          </button>
        </div>
      </aside>
    </>
  );
}
