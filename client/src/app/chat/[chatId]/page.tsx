"use client";

import { useEffect } from "react";
import { useParams, redirect } from "next/navigation";
import { useChatStore } from "@/stores/chat-store";

export default function ChatByIdPage() {
  const params = useParams();
  const chatId = params.id as string;
  const { chats, setActiveChat } = useChatStore();

  useEffect(() => {
    const chat = chats.find((c) => c.id === chatId);
    if (chat) {
      setActiveChat(chatId);
    } else {
      redirect("/chat");
    }
  }, [chatId, chats, setActiveChat]);

  // Redirect to main chat page with active chat set
  redirect("/chat");
}
