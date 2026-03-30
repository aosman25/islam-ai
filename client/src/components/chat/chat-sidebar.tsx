"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useChatStore } from "@/stores/chat-store";
import type { Chat } from "@/types";
import { cn, truncate } from "@/lib/utils";
import {
  PenSquare,
  MessageSquare,
  Pencil,
  Trash2,
  Check,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface ChatSidebarProps {
  open: boolean;
  onToggle: () => void;
}

export function ChatSidebar({ open, onToggle }: ChatSidebarProps) {
  const { chats, activeChatId, setActiveChat, deleteChat, updateChatTitle } =
    useChatStore();

  return (
    <>
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
          "fixed top-16 left-0 z-30 h-[calc(100dvh-4rem)] bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out",
          "md:relative md:top-0 md:z-auto md:flex-shrink-0",
          open
            ? "translate-x-0 md:translate-x-0 md:w-72 w-72"
            : "-translate-x-full md:translate-x-0 md:w-12 md:overflow-hidden"
        )}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center border-b border-border p-4",
          open ? "justify-between" : "justify-center"
        )}>
          {open ? (
            <>
              <h2 className="text-sm font-semibold text-foreground whitespace-nowrap">
                Conversations
              </h2>
              <button
                onClick={onToggle}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close sidebar"
              >
                <PanelLeftClose size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={onToggle}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Open sidebar"
            >
              <PanelLeftOpen size={16} />
            </button>
          )}
        </div>

        {/* New Chat */}
        <button
          onClick={() => setActiveChat(null)}
          className={cn(
            "flex items-center gap-2.5 mt-3 mb-1 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap",
            open ? "mx-3 px-3 py-2.5" : "mx-auto p-1.5 justify-center"
          )}
        >
          <PenSquare size={15} className="flex-shrink-0" />
          {open && "New Chat"}
        </button>

        {/* Chat List */}
        <div className={cn("flex-1 overflow-y-auto py-2", !open && "hidden")}>
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
                <ChatItem
                  key={chat.id}
                  chat={chat}
                  isActive={chat.id === activeChatId}
                  onSelect={() => setActiveChat(chat.id)}
                  onDelete={() => deleteChat(chat.id)}
                  onRename={(title) => updateChatTitle(chat.id, title)}
                />
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function ChatItem({
  chat,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  chat: Chat;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const [editValue, setEditValue] = useState(chat.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "edit") {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [mode]);

  const handleRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== chat.title) {
      onRename(trimmed);
    }
    setMode("view");
  };

  return (
    <>
      {mode === "confirmDelete" && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setMode("view")}
        >
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
          <div
            className="relative bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-foreground mb-2">Delete conversation</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Are you sure you want to delete &ldquo;{truncate(chat.title, 40)}&rdquo;? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setMode("view")}
                className="px-4 py-2 rounded-lg text-sm font-medium text-foreground bg-muted hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setMode("view");
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-destructive hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mode === "edit" ? (
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-muted">
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setMode("view");
            }}
            className="flex-1 min-w-0 text-sm bg-transparent outline-none text-foreground px-1"
          />
          <button
            onClick={handleRename}
            className="flex-shrink-0 p-1 rounded text-primary hover:bg-primary/10 transition-colors"
          >
            <Check size={12} />
          </button>
          <button
            onClick={() => setMode("view")}
            className="flex-shrink-0 p-1 rounded text-muted-foreground hover:bg-muted transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={onSelect}
          className={cn(
            "w-full text-left group flex items-center px-3 py-2.5 rounded-lg transition-all duration-150",
            isActive ? "bg-muted" : "hover:bg-muted"
          )}
        >
          <p className="text-sm truncate min-w-0 flex-1 text-foreground">
            {truncate(chat.title, 40)}
          </p>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditValue(chat.title);
                setMode("edit");
              }}
              className="flex-shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMode("confirmDelete");
              }}
              className="flex-shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </button>
      )}
    </>
  );
}
