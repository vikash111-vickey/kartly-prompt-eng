"use client";

import React from "react";
import { ArrowDownAZ, Star, Zap, Shield, Sparkles } from "lucide-react";
import type { Product } from "@/types/product";
import { getTotalCost } from "@/lib/cost";

export type RefineSortKey =
  | "default"
  | "cheapest"
  | "top_rated"
  | "fastest_delivery"
  | "safest";

export interface RefineChipsProps {
  activeSort: RefineSortKey;
  onSortChange: (sortKey: RefineSortKey) => void;
  className?: string;
}

/**
 * Calculates the Bayesian rating for a product (same formula as lib/trust/score.ts)
 */
export function getBayesianScore(p: Product): number | null {
  if (typeof p.rating !== "number" || isNaN(p.rating)) return null;
  const reviewCount =
    typeof p.reviewCount === "number" && p.reviewCount > 0 ? p.reviewCount : 0;
  return (p.rating * reviewCount + 3.8 * 50) / (reviewCount + 50);
}

/**
 * Computes speed rank for delivery text:
 * 3: ultra-fast (10-15 min quick commerce)
 * 2: fast (same day, today, tomorrow, express)
 * 1: standard eta provided
 * 0: unknown
 */
export function getDeliverySpeedRank(p: Product): number {
  if (!p.deliveryEta) return 0;
  const eta = p.deliveryEta.toLowerCase();
  if (eta.includes("10 min") || eta.includes("15 min") || eta.includes("instant")) {
    return 3;
  }
  if (
    eta.includes("today") ||
    eta.includes("tomorrow") ||
    eta.includes("same day") ||
    eta.includes("express")
  ) {
    return 2;
  }
  return 1;
}

/**
 * Client-side re-sorting function for products already loaded in a chat message.
 */
export function sortProductsByRefine(
  products: Product[],
  sortKey: RefineSortKey
): Product[] {
  const list = [...products];

  switch (sortKey) {
    case "cheapest":
      return list.sort((a, b) => {
        const costA = getTotalCost(a).total ?? a.price ?? Infinity;
        const costB = getTotalCost(b).total ?? b.price ?? Infinity;
        return costA - costB;
      });

    case "top_rated":
      return list.sort((a, b) => {
        const scoreA = getBayesianScore(a);
        const scoreB = getBayesianScore(b);
        if (scoreA === null && scoreB === null) return 0;
        if (scoreA === null) return 1; // Products without rating go last
        if (scoreB === null) return -1;
        return scoreB - scoreA;
      });

    case "fastest_delivery":
      return list.sort((a, b) => {
        const rankA = getDeliverySpeedRank(a);
        const rankB = getDeliverySpeedRank(b);
        if (rankA !== rankB) return rankB - rankA;
        return (b.trustScore ?? 0) - (a.trustScore ?? 0);
      });

    case "safest":
      return list.sort((a, b) => {
        const aRisky = a.trustLabel === "risky" ? 1 : 0;
        const bRisky = b.trustLabel === "risky" ? 1 : 0;
        if (aRisky !== bRisky) return aRisky - bRisky;
        return (b.trustScore ?? 0) - (a.trustScore ?? 0);
      });

    case "default":
    default:
      return list;
  }
}

const CHIPS: { key: RefineSortKey; label: string; icon: typeof Star }[] = [
  { key: "cheapest", label: "Cheapest", icon: ArrowDownAZ },
  { key: "top_rated", label: "Top rated", icon: Star },
  { key: "fastest_delivery", label: "Fastest delivery", icon: Zap },
  { key: "safest", label: "Safest", icon: Shield },
];

export function RefineChips({
  activeSort,
  onSortChange,
  className = "",
}: RefineChipsProps) {
  return (
    <div
      role="toolbar"
      aria-label="Refine product sorting"
      className={`flex items-center gap-1.5 flex-wrap ${className}`}
    >
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mr-0.5 flex items-center gap-1">
        <Sparkles className="size-3 text-emerald-600" />
        Quick refine:
      </span>

      {CHIPS.map(({ key, label, icon: Icon }) => {
        const isSelected = activeSort === key;

        return (
          <button
            key={key}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSortChange(isSelected ? "default" : key)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer ${
              isSelected
                ? "bg-emerald-600 text-white shadow-xs font-semibold ring-1 ring-emerald-700"
                : "bg-gray-100 hover:bg-gray-200/80 text-gray-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-gray-300 border border-transparent"
            }`}
          >
            <Icon className={`size-3 ${isSelected ? "text-white" : "text-gray-500 dark:text-gray-400"}`} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default RefineChips;
