"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, AlertCircle, ChevronDown, ChevronUp, Info } from "lucide-react";
import type { ChatMessage, Product } from "@/types/product";
import { AskInput } from "./ask-input";
import { ProductCard } from "./product-card";
import { CompareBar } from "./compare-bar";
import { CompareDialog } from "./compare-dialog";
import { RefineChips, RefineSortKey, sortProductsByRefine } from "./refine-chips";
import { SafetyCard } from "./safety-card";
import { WishlistHeaderButton } from "./wishlist";

export interface ChatViewProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  onSubmit: (value: string) => void;
  onReset?: () => void;
  onRetry?: () => void;
}

/**
 * Renders the products attached to an assistant message with its own refine sort choice
 * and "Show more" pagination (5 default, expandable).
 */
function MessageProductsSection({
  products,
  compareIds,
  onToggleCompare,
}: {
  products: Product[];
  compareIds: string[];
  onToggleCompare: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<RefineSortKey>("default");
  const [showAll, setShowAll] = useState(false);

  const sortedProducts = useMemo(
    () => sortProductsByRefine(products, sortKey),
    [products, sortKey]
  );

  const visibleProducts = showAll ? sortedProducts : sortedProducts.slice(0, 3);
  const remainingCount = sortedProducts.length - 3;

  return (
    <div className="mt-4 pt-3.5 border-t border-gray-100 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Top picks
        </div>
      </div>

      {/* Refine Chips: Re-sorts products client-side for this message */}
      <RefineChips
        activeSort={sortKey}
        onSortChange={setSortKey}
        className="pt-1 pb-1"
      />

      {/* Product Cards List */}
      <div className="grid grid-cols-1 gap-2.5">
        {visibleProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            isCompared={compareIds.includes(product.id)}
            onToggleCompare={onToggleCompare}
          />
        ))}
      </div>

      {/* "Show more" button if more than 3 products */}
      {remainingCount > 0 && (
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 rounded-lg transition-colors cursor-pointer"
          >
            {showAll ? (
              <>
                <span>Show less</span>
                <ChevronUp className="size-3.5" />
              </>
            ) : (
              <>
                <span>Show more ({remainingCount})</span>
                <ChevronDown className="size-3.5" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export function ChatView({
  messages,
  isLoading = false,
  onSubmit,
  onReset,
  onRetry,
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Compare state: max 3 product IDs
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-clear toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Aggregate all products across messages for the comparison modal
  const allProductsMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const m of messages) {
      if (m.products) {
        for (const p of m.products) {
          map.set(p.id, p);
        }
      }
    }
    return map;
  }, [messages]);

  const comparedProducts = useMemo(() => {
    return compareIds
      .map((id) => allProductsMap.get(id))
      .filter((p): p is Product => Boolean(p));
  }, [compareIds, allProductsMap]);

  // Toggle compare selection with max 3 enforcement
  const handleToggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 3) {
        setToastMessage("You can compare up to 3 products");
        return prev;
      }
      return [...prev, id];
    });
  };

  // Reset handler (clears comparison and invokes parent onReset)
  const handleReset = () => {
    setCompareIds([]);
    setIsCompareOpen(false);
    setToastMessage(null);
    onReset?.();
  };

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-screen w-full bg-white">
      {/* Minimal Top Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-8 py-3.5 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-950 text-base tracking-tight">
            Kartly
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
            AI Shopping
          </span>
        </div>

        <div className="flex items-center gap-2">
          <WishlistHeaderButton />

          {onReset && (
            <button
              onClick={handleReset}
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 px-2.5 py-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              title="Start new shopping search"
            >
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">New search</span>
            </button>
          )}
        </div>
      </header>

      {/* Toast Notification (e.g. "You can compare up to 3 products") */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            role="status"
            aria-live="polite"
            className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-xs font-medium rounded-full shadow-lg border border-gray-800"
          >
            <AlertCircle className="size-3.5 text-amber-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message List */}
      <main
        className="flex-1 overflow-y-auto px-4 py-6 w-full max-w-2xl mx-auto space-y-4"
        aria-live="polite"
        role="log"
        aria-label="Shopping chat history"
      >
        <AnimatePresence initial={false}>
          {messages.map((message) => {
            const isUser = message.role === "user";
            const isError = !isUser && Boolean(message.errorCode && !message.isCutOff);

            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    isUser
                      ? "bg-gray-100 text-gray-900 rounded-tr-xs"
                      : isError
                      ? "bg-amber-50/50 border border-amber-200 text-gray-900 rounded-tl-xs shadow-xs w-full"
                      : "bg-white border border-gray-200 text-gray-900 rounded-tl-xs shadow-xs w-full"
                  }`}
                >
                  {/* Subtle info line if response is served from demo cache */}
                  {message.notice && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-2 text-xs text-amber-800 bg-amber-50/90 border border-amber-200/70 rounded-lg">
                      <Info className="size-3.5 text-amber-600 shrink-0" />
                      <span>{message.notice}</span>
                    </div>
                  )}

                  <p className="whitespace-pre-wrap">{message.content}</p>

                  {/* Safety Check Card Attachment */}
                  {message.safetyCheck && (
                    <SafetyCard safetyCheck={message.safetyCheck} />
                  )}

                  {/* Cut-off reply notice with retry */}
                  {message.isCutOff && (
                    <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                      <span className="text-xs text-amber-700 italic">
                        Reply was cut off.
                      </span>
                      {onRetry && (
                        <button
                          type="button"
                          onClick={onRetry}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 rounded-md transition-colors cursor-pointer"
                        >
                          <RotateCcw className="size-3" />
                          <span>Reply was cut off. Retry?</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Error bubble with Retry button */}
                  {isError && onRetry && (
                    <div className="mt-3 pt-2.5 border-t border-amber-200/50 flex items-center justify-between gap-2">
                      <span className="text-xs text-amber-800">
                        Connection issue occurred
                      </span>
                      <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                      >
                        <RotateCcw className="size-3.5" />
                        <span>Retry</span>
                      </button>
                    </div>
                  )}

                  {/* Product Cards Attachment */}
                  {message.products && message.products.length > 0 && (
                    <MessageProductsSection
                      products={message.products}
                      compareIds={compareIds}
                      onToggleCompare={handleToggleCompare}
                    />
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Typing Indicator */}
          {isLoading && (
            <motion.div
              key="typing-indicator"
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="flex justify-start w-full"
              aria-label="Kartly is searching and comparing products"
            >
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs">
                <div className="flex items-center gap-1.5 h-4">
                  <motion.span
                    animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0,
                    }}
                    className="size-1.5 rounded-full bg-gray-400"
                  />
                  <motion.span
                    animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.18,
                    }}
                    className="size-1.5 rounded-full bg-gray-400"
                  />
                  <motion.span
                    animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.36,
                    }}
                    className="size-1.5 rounded-full bg-gray-400"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} className="h-1" />
      </main>

      {/* Sticky Compare Bar (visible only when 2+ products are selected) */}
      <CompareBar
        products={comparedProducts}
        onOpenCompare={() => setIsCompareOpen(true)}
        onClear={() => setCompareIds([])}
      />

      {/* Compare Side-by-Side Dialog */}
      <CompareDialog
        products={comparedProducts}
        open={isCompareOpen}
        onOpenChange={setIsCompareOpen}
      />

      {/* Pinned Bottom Input Bar */}
      <footer className="sticky bottom-0 z-20 w-full bg-white/90 backdrop-blur-md border-t border-gray-100 p-3 sm:p-4">
        <div className="max-w-xl mx-auto w-full space-y-2">
          <AskInput
            onSubmit={onSubmit}
            disabled={isLoading}
            autoFocus
          />
          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            Kartly compares prices from public shopping listings. Prices and availability can change; always confirm on the store before paying. Kartly never asks for payment details.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default ChatView;
