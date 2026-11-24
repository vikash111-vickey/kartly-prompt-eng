"use client";

import React from "react";
import Image from "next/image";
import { ShieldCheck, Heart } from "lucide-react";
import type { Product } from "@/types/product";
import { getTotalCost } from "@/lib/cost";
import { BuyButton } from "./buy-button";
import { TrustBadge } from "./trust-badge";
import { useWishlist } from "./wishlist";

export interface ProductCardProps {
  product: Product;
  isCompared?: boolean;
  onToggleCompare?: (id: string) => void;
}

export function ProductCard({
  product,
  isCompared = false,
  onToggleCompare,
}: ProductCardProps) {
  const isSuspicious =
    (product.redFlags && product.redFlags.length > 0) ||
    (typeof product.trustScore === "number" && product.trustScore < 45) ||
    product.sellerVerified === false;

  const isDirect = product.linkType === "direct";
  const totalCost = getTotalCost(product);
  const { isSaved, toggleItem } = useWishlist();
  const saved = isSaved(product.id);

  return (
    <div
      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
        isCompared
          ? "border-emerald-400 bg-emerald-50/20 shadow-xs ring-1 ring-emerald-400/50"
          : isSuspicious
          ? "border-amber-200 bg-amber-50/40"
          : "border-gray-200 bg-white hover:border-gray-300 shadow-2xs"
      }`}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        {/* Product Image */}
        <div className="relative size-14 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 shrink-0 flex items-center justify-center p-1">
          <Image
            src={product.image || "/placeholder-product.svg"}
            alt={product.title}
            width={56}
            height={56}
            unoptimized
            className="w-full h-full object-contain"
          />
        </div>

        {/* Product Info */}
        <div className="min-w-0 flex-1">
          {/* Header Badges */}
          <div className="flex items-center gap-1.5 mb-1">
            {isDirect ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/70">
                Platform search
              </span>
            )}
            <span className="text-xs font-medium text-gray-500">
              {product.platform}
            </span>
          </div>

          <h4
            className="text-xs sm:text-sm font-semibold text-gray-900 line-clamp-1"
            title={product.title}
          >
            {product.title}
          </h4>

          {/* Pricing & Ratings Row */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-gray-500">
            {typeof product.price === "number" ? (
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-gray-950 text-sm">
                  ₹{product.price.toLocaleString("en-IN")}
                </span>
                {typeof product.deliveryFee === "number" && product.deliveryFee > 0 && (
                  <span className="text-[11px] text-gray-500">
                    +₹{product.deliveryFee} delivery
                  </span>
                )}
                {((typeof product.deliveryFee === "number" && product.deliveryFee === 0) ||
                  (product.deliveryEta && product.deliveryEta.toLowerCase().includes("free"))) && (
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Free delivery
                  </span>
                )}
              </div>
            ) : (
              <span className="font-medium text-gray-600 text-xs">
                Price varies / Check on store
              </span>
            )}

            {/* Rating (shown only when available) */}
            {typeof product.rating === "number" && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-amber-700 font-semibold">
                  ★ {product.rating}
                </span>
                {typeof product.reviewCount === "number" && (
                  <span className="text-gray-400">
                    ({product.reviewCount.toLocaleString("en-IN")})
                  </span>
                )}
              </>
            )}
          </div>

          {/* Total Cost Line */}
          {typeof product.price === "number" && (
            <div className="text-[11px] text-gray-500 mt-0.5">
              {totalCost.total !== null ? (
                <span>
                  Total: <strong className="text-gray-800">₹{totalCost.total.toLocaleString("en-IN")}</strong>{" "}
                  <span className="text-gray-400">({totalCost.note})</span>
                </span>
              ) : (
                <span className="text-gray-400 italic">
                  {totalCost.note}
                </span>
              )}
            </div>
          )}

          {/* Delivery & Seller Row (Render no 'Not available' rows) */}
          {(product.deliveryEta || product.seller || product.returnPolicy) && (
            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-gray-500">
              {product.deliveryEta && (
                <span>⚡ {product.deliveryEta}</span>
              )}
              {product.seller && (
                <>
                  {product.deliveryEta && <span className="text-gray-300">•</span>}
                  <span className="inline-flex items-center gap-1">
                    {product.sellerVerified === true ? (
                      <>
                        <ShieldCheck className="size-3 text-emerald-600 inline" />
                        <span className="text-gray-600 truncate max-w-[140px]">
                          {product.seller}
                        </span>
                      </>
                    ) : product.sellerVerified === false ? (
                      <span className="text-amber-800 font-medium truncate max-w-[140px]">
                        {product.seller} (Unverified)
                      </span>
                    ) : (
                      <span className="text-gray-500 truncate max-w-[140px]">
                        {product.seller}
                      </span>
                    )}
                  </span>
                </>
              )}
              {product.returnPolicy && (
                <>
                  {(product.deliveryEta || product.seller) && <span className="text-gray-300">•</span>}
                  <span className="text-gray-400">
                    {product.returnPolicy}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Trust Badge & Explanations */}
          <TrustBadge product={product} />
        </div>
      </div>

      {/* Action Area: Compare Checkbox, Wishlist Heart & Buy/Search Button */}
      <div className="shrink-0 flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2.5 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleItem(product)}
            aria-pressed={saved}
            aria-label="Save to wishlist"
            title={saved ? "Remove from wishlist" : "Save to wishlist"}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
          >
            <Heart
              className={`size-4 transition-transform active:scale-125 ${
                saved
                  ? "fill-rose-500 text-rose-500"
                  : "text-gray-400 hover:text-rose-500"
              }`}
            />
          </button>
          {onToggleCompare && (
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isCompared}
                onChange={() => onToggleCompare(product.id)}
                aria-label={`Compare ${product.title}`}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 size-4 cursor-pointer"
              />
              <span>Compare</span>
            </label>
          )}
        </div>
        <BuyButton
          platform={product.platform}
          link={product.link}
          linkType={product.linkType}
          domain={product.domain}
        />
      </div>
    </div>
  );
}

export default ProductCard;
