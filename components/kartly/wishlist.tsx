"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Heart, Trash2, ArrowUpRight } from "lucide-react";
import type { Product, WishlistItem } from "@/types/product";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const STORAGE_KEY = "kartly:wishlist";
const MAX_WISHLIST_ITEMS = 50;

function getInitialWishlist(): WishlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, MAX_WISHLIST_ITEMS);
      }
    }
  } catch (err) {
    console.warn("Failed to load wishlist from localStorage:", err);
  }
  return [];
}

interface WishlistContextType {
  items: WishlistItem[];
  isSaved: (id: string) => boolean;
  toggleItem: (product: Product) => void;
  removeItem: (id: string) => void;
  clearWishlist: () => void;
  count: number;
}

const WishlistContext = createContext<WishlistContextType | null>(null);

export function useWishlist(): WishlistContextType {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>(getInitialWishlist);

  // Save to localStorage safely whenever items change
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      }
    } catch (err) {
      console.warn("Failed to save wishlist to localStorage:", err);
    }
  }, [items]);

  const isSaved = useCallback(
    (id: string) => items.some((item) => item.id === id),
    [items]
  );

  const toggleItem = useCallback((product: Product) => {
    setItems((prev) => {
      const exists = prev.some((item) => item.id === product.id);
      if (exists) {
        return prev.filter((item) => item.id !== product.id);
      }
      const newItem: WishlistItem = {
        id: product.id,
        title: product.title,
        platform: product.platform,
        price: product.price,
        image: product.image,
        link: product.link,
        linkType: product.linkType,
        trustScore: product.trustScore,
        trustLabel: product.trustLabel,
        savedAt: Date.now(),
      };
      // Keep most recent first, capped at 50 items
      return [newItem, ...prev].slice(0, MAX_WISHLIST_ITEMS);
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearWishlist = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo(
    () => ({
      items,
      isSaved,
      toggleItem,
      removeItem,
      clearWishlist,
      count: items.length,
    }),
    [items, isSaved, toggleItem, removeItem, clearWishlist]
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

/**
 * Slide-out Sheet displaying the user's saved wishlist items.
 */
export function WishlistSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { items, removeItem, count } = useWishlist();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col h-full w-full sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Heart className="size-4 text-rose-500 fill-rose-500" />
            <SheetTitle>Saved Wishlist ({count})</SheetTitle>
          </div>
          <SheetDescription>
            Products and deals you bookmarked for later.
          </SheetDescription>
        </SheetHeader>

        {/* Disclaimer Note */}
        <div className="bg-amber-50/60 border border-amber-200/60 rounded-lg p-2.5 text-xs text-amber-900 leading-snug">
          <strong>Note:</strong> Prices may have changed since you saved this. Always verify current prices and stock on the store site.
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 divide-y divide-gray-100">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="size-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-400">
                <Heart className="size-6" />
              </div>
              <p className="text-sm font-semibold text-gray-800">
                Your wishlist is empty
              </p>
              <p className="text-xs text-gray-400 max-w-xs">
                Tap the heart button on any product deal in chat to save it here for easy comparison.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const formattedPrice =
                typeof item.price === "number"
                  ? `₹${item.price.toLocaleString("en-IN")}`
                  : null;

              const savedDateStr = new Date(item.savedAt).toLocaleDateString(
                "en-IN",
                {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }
              );

              return (
                <div key={item.id} className="pt-3 first:pt-0 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {item.platform}
                        </span>
                        {item.trustScore !== undefined && item.trustLabel && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border capitalize ${
                              item.trustLabel === "great"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : item.trustLabel === "good"
                                ? "bg-sky-50 text-sky-700 border-sky-200"
                                : item.trustLabel === "careful"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {item.trustScore}/100 • {item.trustLabel}
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-medium text-gray-900 line-clamp-2 mt-1">
                        {item.title}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-gray-400 hover:text-rose-600 p-1 rounded-md hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
                      aria-label={`Remove ${item.title} from wishlist`}
                      title="Remove from wishlist"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div>
                      {formattedPrice ? (
                        <span className="font-semibold text-gray-950 text-sm">
                          {formattedPrice}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">
                          Price on store
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 ml-2">
                        Saved {savedDateStr}
                      </span>
                    </div>

                    {item.link ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                      >
                        <span>{item.linkType === "platform_search" ? "Search" : "Buy"}</span>
                        <ArrowUpRight className="size-3" />
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">No link</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Top header Wishlist button showing "Saved (N)" and opening the Wishlist Sheet.
 */
export function WishlistHeaderButton() {
  const { count } = useWishlist();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-gray-700 hover:text-gray-950 px-2.5 py-1.5 rounded-full hover:bg-gray-100 border border-gray-200/70 transition-colors cursor-pointer"
        title="View saved wishlist"
      >
        <Heart
          className={`size-3.5 ${
            count > 0 ? "text-rose-500 fill-rose-500" : "text-gray-500"
          }`}
        />
        <span className="font-medium">Saved ({count})</span>
      </button>

      <WishlistSheet open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
