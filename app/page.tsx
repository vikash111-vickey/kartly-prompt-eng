"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ChatMessage, Product } from "@/types/product";
import type { SafetyCheckResult } from "@/lib/safety/check";
import { Hero } from "@/components/kartly/hero";
import { ChatView } from "@/components/kartly/chat-view";
import { WishlistHeaderButton } from "@/components/kartly/wishlist";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (text: string) => {
    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    const userMessage: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: text,
    };

    // Update conversation state with user message
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const historyToSend = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: text },
    ];

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyToSend }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Server responded with status ${response.status}`
        );
      }

      if (!response.body) {
        throw new Error("No response stream received from the server.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantCreated = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const event = JSON.parse(trimmed);

            if (event.type === "text") {
              // Hide typing indicator as soon as the first text delta arrives
              setIsLoading(false);

              if (!assistantCreated) {
                assistantCreated = true;
                setMessages((prev) => [
                  ...prev,
                  {
                    id: assistantMsgId,
                    role: "assistant",
                    content: event.delta || "",
                  },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: msg.content + (event.delta || "") }
                      : msg
                  )
                );
              }
            } else if (event.type === "products") {
              const incomingProducts = (event.products || []) as Product[];
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, products: incomingProducts }
                    : msg
                )
              );
            } else if (event.type === "notice") {
              const noticeMsg = (event.message as string) || "";
              if (!assistantCreated) {
                assistantCreated = true;
                setMessages((prev) => [
                  ...prev,
                  {
                    id: assistantMsgId,
                    role: "assistant",
                    content: "",
                    notice: noticeMsg,
                  },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId ? { ...msg, notice: noticeMsg } : msg
                  )
                );
              }
            } else if (event.type === "safety_check") {
              const incomingSafety = event.safetyCheck as SafetyCheckResult;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, safetyCheck: incomingSafety }
                    : msg
                )
              );
            } else if (event.type === "error") {
              setIsLoading(false);
              const code = event.code || "unknown";
              const userMessage =
                event.message || "Something went wrong on my side.";

              if (code === "model" && assistantCreated) {
                // Stream cut off: keep existing partial content and mark as cut off
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, isCutOff: true, errorCode: "model" }
                      : msg
                  )
                );
              } else if (!assistantCreated) {
                assistantCreated = true;
                setMessages((prev) => [
                  ...prev,
                  {
                    id: assistantMsgId,
                    role: "assistant",
                    content: userMessage,
                    errorCode: code,
                  },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, errorCode: code }
                      : msg
                  )
                );
              }
            }
          } catch (e) {
            console.error("Error parsing NDJSON line:", line, e);
          }
        }
      }
    } catch {
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
          content: "Something went wrong on my side.",
          errorCode: "unknown",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    // Find the last user message to resend
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMessage) {
      handleSendMessage(lastUserMessage.content);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 selection:bg-gray-100 flex flex-col justify-center">
      <AnimatePresence mode="wait">
        {messages.length === 0 ? (
          <motion.div
            key="hero-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20, transition: { duration: 0.25 } }}
            className="w-full min-h-screen flex flex-col"
          >
            <header className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-gray-100 bg-white/90 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-950 text-base tracking-tight">
                  Kartly
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                  AI Shopping
                </span>
              </div>
              <WishlistHeaderButton />
            </header>
            <div className="flex-1 flex items-center justify-center">
              <Hero onSubmit={handleSendMessage} disabled={isLoading} />
            </div>
            <footer className="w-full py-4 px-4 text-center border-t border-gray-50 bg-white/50">
              <p className="text-[11px] text-gray-400 max-w-xl mx-auto leading-relaxed">
                Kartly compares prices from public shopping listings. Prices and availability can change; always confirm on the store before paying. Kartly never asks for payment details.
              </p>
            </footer>
          </motion.div>
        ) : (
          <motion.div
            key="chat-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full h-screen"
          >
            <ChatView
              messages={messages}
              isLoading={isLoading}
              onSubmit={handleSendMessage}
              onReset={handleReset}
              onRetry={handleRetry}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
