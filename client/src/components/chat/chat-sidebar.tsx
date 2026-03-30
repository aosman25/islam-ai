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
        className="fixed top-20 left-3 z-40 p-2 rounded-lg bg-card border border-border shadow-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all md:hidden"
        aria-label="Toggle sidebar"
      >
        {open ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-30 md:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-16 left-0 z-30 h-[calc(100dvh-4rem)] w-72 bg-card border-r border-border flex flex-col transition-transform duration-300 ease-spring",
          "md:relative md:top-0 md:translate-x-0 md:z-auto",
          open ? "translate-x-0" : "-translate-x-full md:-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            Conversations
          </h2>
          <div className="flex items-center gap-1">
            {chats.length > 0 && (
              <button
                onClick={() => {
                  if (confirm("Clear all conversations?")) clearChats();
                }}
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Clear all"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={() => createChat()}
              className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
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
                className="mx-auto text-border mb-3"
              />
              <p className="text-xs text-muted-foreground">No conversations yet</p>
              <p className="text-xs text-muted-foreground mt-1">
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
                      ? "bg-accent border border-accent"
                      : "hover:bg-muted"
                  )}
                >
                  <MessageSquare
                    size={14}
                    className={cn(
                      "flex-shrink-0 mt-0.5",
                      chat.id === activeChatId
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm truncate",
                        chat.id === activeChatId
                          ? "text-accent-foreground font-medium"
                          : "text-foreground"
                      )}
                    >
                      {truncate(chat.title, 40)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatTime(chat.updatedAt)} &middot;{" "}
                      {chat.messages.length} msg
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                    className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Desktop toggle */}
        <div className="hidden md:flex p-3 border-t border-border">
          <button
            onClick={onToggle}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full"
          >
            <PanelLeftClose size={14} />
            Hide sidebar
          </button>
        </div>
      </aside>
    </>
  );
}
