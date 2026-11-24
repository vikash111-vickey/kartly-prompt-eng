"use client";

import React from "react";
import Image from "next/image";
import { Check, ShieldCheck, AlertTriangle } from "lucide-react";
import type { Product } from "@/types/product";
import { getTotalCost } from "@/lib/cost";
import { BuyButton } from "./buy-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface CompareDialogProps {
  products: Product[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompareDialog({
  products,
  open,
  onOpenChange,
}: CompareDialogProps) {
  if (products.length === 0) return null;

  // Determine best values for numeric rows (highlighted with green bg + "Best" text badge)
  const validPrices = products
    .map((p) => p.price)
    .filter((v): v is number => typeof v === "number" && !isNaN(v));
  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

  const validTotals = products
    .map((p) => getTotalCost(p).total)
    .filter((v): v is number => typeof v === "number" && !isNaN(v));
  const minTotal = validTotals.length > 0 ? Math.min(...validTotals) : null;

  const validRatings = products
    .map((p) => p.rating)
    .filter((v): v is number => typeof v === "number" && !isNaN(v));
  const maxRating = validRatings.length > 0 ? Math.max(...validRatings) : null;

  const validTrustScores = products
    .map((p) => p.trustScore)
    .filter((v): v is number => typeof v === "number" && !isNaN(v));
  const maxTrustScore = validTrustScores.length > 0 ? Math.max(...validTrustScores) : null;

  // Determine row visibility: only show if at least one product has data
  const hasImages = products.some((p) => Boolean(p.image));
  const hasPrice = products.some((p) => typeof p.price === "number");
  const hasRating = products.some((p) => typeof p.rating === "number");
  const hasTrust = products.some((p) => typeof p.trustScore === "number");
  const hasDelivery = products.some(
    (p) => Boolean(p.deliveryEta) || typeof p.deliveryFee === "number"
  );
  const hasSeller = products.some(
    (p) => Boolean(p.seller) || p.sellerVerified !== undefined
  );
  const hasReturnPolicy = products.some((p) => Boolean(p.returnPolicy));
  const hasRedFlags = products.some(
    (p) => p.redFlags && p.redFlags.length > 0
  );
  const hasPositives = products.some(
    (p) => p.positives && p.positives.length > 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
        <DialogHeader className="pb-3 border-b border-gray-100 dark:border-zinc-800">
          <DialogTitle className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
            Compare Products ({products.length})
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Side-by-side comparison with real prices, delivery, verified sellers, and trust scores.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable table container with horizontal scroll on mobile & sticky first column */}
        <div className="flex-1 overflow-x-auto overflow-y-auto mt-2 -mx-4 sm:-mx-6 px-4 sm:px-6">
          <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-800">
                <th
                  scope="col"
                  className="sticky left-0 bg-white dark:bg-zinc-900 z-20 py-2.5 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider w-32 min-w-[120px] shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#27272a]"
                >
                  Feature
                </th>
                {products.map((p) => (
                  <th
                    key={p.id}
                    scope="col"
                    className="py-2.5 px-3 font-semibold text-gray-900 dark:text-gray-100 min-w-[170px] w-1/3 align-top"
                  >
                    <span className="line-clamp-2 text-xs sm:text-sm font-semibold" title={p.title}>
                      {p.title}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/80">
              {/* Row 1: Image */}
              {hasImages && (
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 bg-white dark:bg-zinc-900 z-10 py-3 pr-4 text-xs font-medium text-gray-500 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#27272a]"
                  >
                    Image
                  </th>
                  {products.map((p) => (
                    <td key={p.id} className="py-3 px-3 align-middle">
                      <div className="relative size-16 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 p-1 flex items-center justify-center">
                        <Image
                          src={p.image || "/placeholder-product.svg"}
                          alt={p.title}
                          width={60}
                          height={60}
                          unoptimized
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              )}

              {/* Row 2: Platform */}
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 bg-white dark:bg-zinc-900 z-10 py-3 pr-4 text-xs font-medium text-gray-500 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#27272a]"
                >
                  Platform
                </th>
                {products.map((p) => (
                  <td key={p.id} className="py-3 px-3 font-medium text-gray-800 dark:text-gray-200">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800 text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {p.platform}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Row 3: Price */}
              {hasPrice && (
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 bg-white dark:bg-zinc-900 z-10 py-3 pr-4 text-xs font-medium text-gray-500 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#27272a]"
                  >
                    Price
                  </th>
                  {products.map((p) => {
                    const isBest =
                      typeof p.price === "number" &&
                      minPrice !== null &&
                      p.price === minPrice;

                    return (
                      <td
                        key={p.id}
                        className={`py-3 px-3 transition-colors ${
                          isBest ? "bg-emerald-50/70 dark:bg-emerald-950/30 font-semibold" : ""
                        }`}
                      >
                        {typeof p.price === "number" ? (
                          <div className="flex items-center flex-wrap gap-1">
                            <span className="text-gray-950 dark:text-gray-100 font-bold">
                              ₹{p.price.toLocaleString("en-IN")}
                            </span>
                            {isBest && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border border-emerald-300">
                                Best
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              )}

              {/* Row 4: Total Cost */}
              {hasPrice && (
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 bg-white dark:bg-zinc-900 z-10 py-3 pr-4 text-xs font-medium text-gray-500 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#27272a]"
                  >
                    Total Cost
                  </th>
                  {products.map((p) => {
                    const cost = getTotalCost(p);
                    const isBest =
                      cost.total !== null &&
                      minTotal !== null &&
                      cost.total === minTotal;

                    return (
                      <td
                        key={p.id}
                        className={`py-3 px-3 transition-colors ${
                          isBest ? "bg-emerald-50/70 dark:bg-emerald-950/30 font-semibold" : ""
                        }`}
                      >
                        {cost.total !== null ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center flex-wrap gap-1">
                              <span className="text-gray-900 dark:text-gray-100 font-bold">
                                ₹{cost.total.toLocaleString("en-IN")}
                              </span>
                              {isBest && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border border-emerald-300">
                                  Best
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-400">({cost.note})</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">
                            {cost.note || "—"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              )}

              {/* Row 5: Rating & Reviews */}
              {hasRating && (
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 bg-white dark:bg-zinc-900 z-10 py-3 pr-4 text-xs font-medium text-gray-500 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#27272a]"
                  >
                    Rating & Reviews
                  </th>
                  {products.map((p) => {
                    const isBest =
                      typeof p.rating === "number" &&
                      maxRating !== null &&
                      p.rating === maxRating;

                    return (
                      <td
                        key={p.id}
                        className={`py-3 px-3 transition-colors ${
                          isBest ? "bg-emerald-50/70 dark:bg-emerald-950/30" : ""
                        }`}
                      >
                        {typeof p.rating === "number" ? (
                          <div className="flex items-center flex-wrap gap-1">
                            <span className="text-amber-700 dark:text-amber-400 font-semibold">
                              ★ {p.rating}
                            </span>
                            {typeof p.reviewCount === "number" && (
                              <span className="text-gray-400 text-xs">
                                ({p.reviewCount.toLocaleString("en-IN")})
                              </span>
                            )}
                            {isBest && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border border-emerald-300 ml-1">
                                Best
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              )}

              {/* Row 6: Trust Score & Label */}
              {hasTrust && (
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 bg-white dark:bg-zinc-900 z-10 py-3 pr-4 text-xs font-medium text-gray-500 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#27272a]"
                  >
                    Trust Score
                  </th>
                  {products.map((p) => {
                    const isBest =
                      typeof p.trustScore === "number" &&
                      maxTrustScore !== null &&
                      p.trustScore === maxTrustScore;

                    return (
                      <td
                        key={p.id}
                        className={`py-3 px-3 transition-colors ${
                          isBest ? "bg-emerald-50/70 dark:bg-emerald-950/30" : ""
                        }`}
                      >
                        {typeof p.trustScore === "number" ? (
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="font-bold text-gray-900 dark:text-gray-100">
                              {p.trustScore}/100
                            </span>
                            <span className="text-[11px] font-medium uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300">
                              {p.trustLabel}
                            </span>
                            {isBest && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border border-emerald-300">
                                Best
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              )}

              {/* Row 7: Delivery */}
              {hasDelivery && (
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 bg-white dark:bg-zinc-900 z-10 py-3 pr-4 text-xs font-medium text-gray-500 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#27272a]"
                  >
                    Delivery
                  </th>
                  {products.map((p) => (
                    <td key={p.id} className="py-3 px-3 text-xs text-gray-600 dark:text-gray-300">
                      {p.deliveryEta || (typeof p.deliveryFee === "number" ? `Fee: ₹${p.deliveryFee}` : "—")}
                    </td>
                  ))}
                </tr>
              )}

              {/* Row 8: Seller */}
              {hasSeller && (
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 bg-white dark:bg-zinc-900 z-10 py-3 pr-4 text-xs font-medium text-gray-500 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#27272a]"
                  >
                    Seller
                  </th>
                  {products.map((p) => (
                    <td key={p.id} className="py-3 px-3 text-xs text-gray-600 dark:text-gray-300">
                      {p.seller ? (
                        <div className="flex items-center gap-1">
                          {p.sellerVerified && (
                            <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
                          )}
                          <span>{p.seller}</span>
                          {p.sellerVerified === false && (
                            <span className="text-amber-700 text-[10px] font-semibold">(Unverified)</span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  ))}
                </tr>
              )}

              {/* Row 9: Return Policy */}
              {hasReturnPolicy && (
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 bg-white dark:bg-zinc-900 z-10 py-3 pr-4 text-xs font-medium text-gray-500 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#27272a]"
                  >
                    Return Policy
                  </th>
                  {products.map((p) => (
                    <td key={p.id} className="py-3 px-3 text-xs text-gray-600 dark:text-gray-300">
                      {p.returnPolicy || "—"}
                    </td>
                  ))}
                </tr>
              )}

              {/* Row 10: Positives */}
              {hasPositives && (
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 bg-white dark:bg-zinc-900 z-10 py-3 pr-4 text-xs font-medium text-gray-500 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#27272a]"
                  >
                    Positives
                  </th>
                  {products.map((p) => (
                    <td key={p.id} className="py-3 px-3 text-xs">
                      {p.positives && p.positives.length > 0 ? (
                        <ul className="space-y-1 text-emerald-700 dark:text-emerald-400">
                          {p.positives.map((pos, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <Check className="size-3 text-emerald-600 shrink-0 mt-0.5" />
                              <span className="leading-tight">{pos}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              )}

              {/* Row 11: Red Flags */}
              {hasRedFlags && (
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 bg-white dark:bg-zinc-900 z-10 py-3 pr-4 text-xs font-medium text-gray-500 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#27272a]"
                  >
                    Red Flags
                  </th>
                  {products.map((p) => (
                    <td key={p.id} className="py-3 px-3 text-xs">
                      {p.redFlags && p.redFlags.length > 0 ? (
                        <ul className="space-y-1 text-rose-700 dark:text-rose-400">
                          {p.redFlags.map((flag, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <AlertTriangle className="size-3 text-rose-600 shrink-0 mt-0.5" />
                              <span className="leading-tight">{flag}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              )}

              {/* Row 12: Buy Button */}
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 bg-white dark:bg-zinc-900 z-10 py-3.5 pr-4 text-xs font-medium text-gray-500 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#27272a]"
                >
                  Buy Link
                </th>
                {products.map((p) => (
                  <td key={p.id} className="py-3.5 px-3">
                    <BuyButton
                      platform={p.platform}
                      link={p.link}
                      linkType={p.linkType}
                      domain={p.domain}
                      className="text-xs px-3 py-1.5 h-auto"
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CompareDialog;
