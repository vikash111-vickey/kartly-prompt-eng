"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Info,
  Search,
  ExternalLink,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage, Product } from "@/types/product";
import { AskInput } from "./ask-input";
import { ProductCard } from "./product-card";
import { CompareBar } from "./compare-bar";
import { CompareDialog } from "./compare-dialog";
import { RefineChips, RefineSortKey, sortProductsByRefine } from "./refine-chips";
import { SafetyCard } from "./safety-card";
import { WishlistHeaderButton } from "./wishlist";
import { buildPlatformSearchLink } from "@/lib/links";
import { cleanSearchQuery } from "@/lib/search/query";

export interface ChatViewProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  onSubmit: (value: string) => void;
  onReset?: () => void;
  onRetry?: () => void;
}

/**
 * Determines relevant platform links based on query and product titles.
 */
function getMoreStoresPlatforms(query: string, products: Product[]): string[] {
  const combinedText = `${query} ${products.map((p) => p.title).join(" ")}`.toLowerCase();

  // 1. Beauty, Skincare & Cosmetics (Takes priority over food/grocery words like rice/tea/oil in cosmetic titles)
  const isBeautyOrSkincare =
    /\b(skincare|skin|makeup|cosmetics?|serum|face\s*wash|creams?|lotions?|lipsticks?|lip\s*balm|perfumes?|fragrance|beauty|sunscreen|moisturizer|glow)\b/i.test(
      combinedText
    );

  if (isBeautyOrSkincare) {
    return ["Nykaa", "Myntra", "Amazon", "Flipkart", "Tata CLiQ"];
  }

  // 2. Groceries & Quick-Commerce (groceries: Blinkit, Zepto, BigBasket, Amazon, Flipkart)
  const isGrocery =
    /\b(grocer|groceries|vegetables?|fruits?|milk|bread|butter|cheese|paneer|curd|atta|dal|spices?|cooking\s*oil|snacks?|biscuits?|chips|beverages?|soft\s*drinks?|10\s*min(?:ute)?s?)\b/i.test(
      combinedText
    );

  if (isGrocery) {
    return ["Blinkit", "Zepto", "BigBasket", "Amazon", "Flipkart"];
  }

  // 3. Fashion & Apparel (fashion: Myntra, Meesho, Ajio, Amazon, Flipkart)
  const isFashion =
    /\b(shirts?|t-?shirts?|pants?|jeans|trousers?|dresses?|sarees?|kurtas?|shoes?|sneakers?|jackets?|hoodies?|tops?|fashion|clothing|footwear|sandals?|heels?|handbags?)\b/i.test(
      combinedText
    );

  if (isFashion) {
    return ["Myntra", "Meesho", "Ajio", "Amazon", "Flipkart"];
  }

  // 4. Electronics & Furniture (electronics and furniture: Amazon, Flipkart, Croma, Reliance Digital, Tata CLiQ, Snapdeal)
  const isElectronicsOrFurniture =
    /\b(phones?|mobiles?|smartphones?|laptops?|earbuds?|earphones?|headphones?|watch(?:es)?|smartwatch(?:es)?|tv|televisions?|tablets?|ipads?|chairs?|tables?|desks?|sofas?|beds?|furniture|study|cameras?|monitors?|keyboards?|mouse|refrigerators?|fridges?|ac|air\s*conditioners?)\b/i.test(
      combinedText
    );

  if (isElectronicsOrFurniture) {
    return [
      "Amazon",
      "Flipkart",
      "Croma",
      "Reliance Digital",
      "Tata CLiQ",
      "Snapdeal",
    ];
  }

  return [
    "Amazon",
    "Flipkart",
    "Myntra",
    "Croma",
    "Reliance Digital",
    "Tata CLiQ",
    "Snapdeal",
    "Meesho",
  ];
}

/**
 * Renders the products attached to an assistant message with its own refine sort choice,
 * "Show more" pagination, and "More stores" platform search chips.
 */
function MessageProductsSection({
  products,
  compareIds,
  onToggleCompare,
  messageSearchQuery,
  userQuery = "",
  allMessages = [],
}: {
  products: Product[];
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  messageSearchQuery?: string;
  userQuery?: string;
  allMessages?: ChatMessage[];
}) {
  const [sortKey, setSortKey] = useState<RefineSortKey>("default");
  const [showAll, setShowAll] = useState(false);

  const sortedProducts = useMemo(
    () => sortProductsByRefine(products, sortKey),
    [products, sortKey]
  );

  const visibleProducts = showAll ? sortedProducts : sortedProducts.slice(0, 3);
  const remainingCount = sortedProducts.length - 3;

  // Determine high-fidelity cleaned searchQuery for platform search links:
  // 1. Tool-level searchQuery from Gemini/backend (e.g. "skincare gift set")
  // 2. Scan conversation backwards for the actual shopping prompt (avoiding "ok", "yes", etc.)
  // 3. Clean userQuery
  // 4. Extract core keywords from product titles
  const cleanedSearchQuery = useMemo(() => {
    // 1. Direct tool searchQuery
    if (messageSearchQuery && messageSearchQuery.trim()) {
      const res = cleanSearchQuery(messageSearchQuery);
      if (res.searchQuery) return res.searchQuery;
      return messageSearchQuery.trim();
    }

    // 2. Scan conversation backward for a substantive user request
    if (allMessages && allMessages.length > 0) {
      for (let i = allMessages.length - 1; i >= 0; i--) {
        const msg = allMessages[i];
        if (msg.role === "user" && msg.content) {
          const res = cleanSearchQuery(msg.content);
          if (res.searchQuery && res.searchQuery.length >= 3) {
            return res.searchQuery;
          }
        }
      }
    }

    // 3. User prior query
    if (userQuery && userQuery.trim()) {
      const res = cleanSearchQuery(userQuery);
      if (res.searchQuery) return res.searchQuery;
    }

    // 4. Fallback from top product title
    if (products[0]?.title) {
      const simplified = products[0].title
        .replace(/\|.*$/g, "")
        .replace(/-.*$/g, "")
        .replace(/\(.*?\)/g, "")
        .trim();
      const words = simplified.split(/\s+/).slice(0, 3).join(" ");
      if (words.length >= 3) return words;
    }

    return "";
  }, [messageSearchQuery, userQuery, allMessages, products]);

  // Determine platforms relevant to this search category
  const moreStoresPlatforms = useMemo(() => {
    return getMoreStoresPlatforms(cleanedSearchQuery || userQuery, products);
  }, [cleanedSearchQuery, userQuery, products]);

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
        {visibleProducts.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            isTopPick={index === 0}
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

      {/* "More stores" Row under top picks */}
      {moreStoresPlatforms.length > 0 && cleanedSearchQuery && (
        <div className="pt-3 border-t border-gray-100 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            More stores
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {moreStoresPlatforms.map((platform) => {
              const searchLink = buildPlatformSearchLink(platform, cleanedSearchQuery);
              return (
                <a
                  key={platform}
                  href={searchLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 hover:text-gray-950 border border-gray-200 rounded-full transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                >
                  <Search className="size-3 text-gray-400" />
                  <span>Search on {platform}</span>
                  <ExternalLink className="size-2.5 text-gray-400 ml-0.5" />
                </a>
              );
            })}
          </div>
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

  // Collect all unique products across all messages for compare lookups
  const allMessageProducts = useMemo(() => {
    const map = new Map<string, Product>();
    for (const msg of messages) {
      if (msg.products) {
        for (const p of msg.products) {
          map.set(p.id, p);
        }
      }
    }
    return map;
  }, [messages]);

  const comparedProducts = useMemo(() => {
    return compareIds
      .map((id) => allMessageProducts.get(id))
      .filter((p): p is Product => Boolean(p));
  }, [compareIds, allMessageProducts]);

  const handleToggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, id];
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col min-h-dvh bg-white text-gray-950">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-lg tracking-tight text-gray-950">
            Kartly
          </span>
          <span className="text-[10px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 whitespace-nowrap">
            AI Shopping
          </span>
        </div>
        <div className="flex items-center gap-2">
          <WishlistHeaderButton />
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              New search
            </button>
          )}
        </div>
      </header>

      {/* Scrollable Message List */}
      <main
        className="flex-1 max-w-2xl mx-auto w-full p-4 sm:p-6 space-y-4"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {messages.map((message, index) => {
            const isUser = message.role === "user";
            const isError = Boolean(message.errorCode);
            const userPriorQuery =
              !isUser && index > 0 && messages[index - 1]?.role === "user"
                ? messages[index - 1].content
                : "";

            // Sanitize raw PICKS and internal IDs from user-facing text
            const sanitizedText = message.content
              .replace(/(?:^|\n)PICKS:\s*[^\n\r]+/gi, "")
              .replace(/\((?:sp|mock)-[a-zA-Z0-9-]+\)/gi, "")
              .trim();

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

                  {/* Message Content: User plain text vs. Assistant ReactMarkdown */}
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none text-gray-900 leading-relaxed break-words">
                      <ReactMarkdown>{sanitizedText}</ReactMarkdown>
                    </div>
                  )}

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
                      messageSearchQuery={message.searchQuery}
                      userQuery={userPriorQuery}
                      allMessages={messages.slice(0, index + 1)}
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
