"use client";

import React, { useState, useId } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import type {
  Product,
  TrustLabel,
  TrustConfidence,
  ScoreBreakdown,
} from "@/types/product";

interface TrustBadgeProps {
  product: Product;
}

const LABEL_CONFIG: Record<
  TrustLabel,
  {
    text: string;
    pillBg: string;
    pillText: string;
    pillBorder: string;
    icon: typeof ShieldCheck;
  }
> = {
  great: {
    text: "Great Trust",
    pillBg: "bg-emerald-50",
    pillText: "text-emerald-700",
    pillBorder: "border-emerald-200",
    icon: ShieldCheck,
  },
  good: {
    text: "Good Trust",
    pillBg: "bg-sky-50",
    pillText: "text-sky-700",
    pillBorder: "border-sky-200",
    icon: Shield,
  },
  careful: {
    text: "Be Careful",
    pillBg: "bg-amber-50",
    pillText: "text-amber-800",
    pillBorder: "border-amber-200",
    icon: ShieldAlert,
  },
  risky: {
    text: "High Risk",
    pillBg: "bg-rose-50",
    pillText: "text-rose-700",
    pillBorder: "border-rose-200",
    icon: AlertTriangle,
  },
};

const FACTOR_NAMES: Record<keyof ScoreBreakdown, string> = {
  reviews: "Buyer Reviews (30%)",
  price: "Price Fairness (25%)",
  seller: "Seller & Platform (20%)",
  delivery: "Delivery Terms (15%)",
  fraud: "Safety & Fraud Signals (10%)",
};

export function TrustBadge({ product }: TrustBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  if (typeof product.trustScore !== "number") {
    return null;
  }

  const score = product.trustScore;
  const labelKey: TrustLabel = product.trustLabel || (score >= 80 ? "great" : score >= 65 ? "good" : score >= 45 ? "careful" : "risky");
  const config = LABEL_CONFIG[labelKey];
  const IconComponent = config.icon;
  const confidence: TrustConfidence = product.confidence || "medium";
  const breakdown = product.scoreBreakdown || {};
  const positives = product.positives || [];
  const redFlags = product.redFlags || [];

  return (
    <div className="mt-2 text-left">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Pill Badge */}
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.pillBg} ${config.pillText} ${config.pillBorder}`}
          aria-label={`Trust Score: ${score} out of 100, rating: ${config.text}`}
        >
          <IconComponent className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{score}/100</span>
          {confidence === "low" && (
            <span className="text-[10px] font-medium text-amber-800 bg-amber-100 px-1 py-0.2 rounded border border-amber-200">
              Limited data
            </span>
          )}
          <span className="text-gray-300">•</span>
          <span>{config.text}</span>
        </div>

        {/* Accordion Toggle */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded px-1"
        >
          <span>Why this score?</span>
          {isOpen ? (
            <ChevronUp className="size-3 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Expanded Breakdown Drawer */}
      {isOpen && (
        <div
          id={panelId}
          role="region"
          aria-label={`Trust score breakdown for ${product.title}`}
          className="mt-2.5 p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 text-xs space-y-3 animate-in fade-in-50 duration-150"
        >
          {/* Low Confidence Warning */}
          {confidence === "low" && (
            <div className="flex items-start gap-2 p-2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-[11px] leading-tight">
              <Info className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Low Confidence:</strong> Limited public data was available for this item. Please review buyer reviews and seller ratings directly before checking out.
              </span>
            </div>
          )}

          {/* Factor Breakdown Bars */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block">
              Score Breakdown
            </span>
            {Object.entries(FACTOR_NAMES).map(([key, name]) => {
              const val = breakdown[key as keyof ScoreBreakdown];
              if (typeof val !== "number") return null;

              const barColor =
                val >= 80
                  ? "bg-emerald-500"
                  : val >= 65
                  ? "bg-sky-500"
                  : val >= 45
                  ? "bg-amber-500"
                  : "bg-rose-500";

              return (
                <div key={key} className="space-y-0.5">
                  <div className="flex justify-between text-[11px] text-gray-600 dark:text-gray-400">
                    <span>{name}</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {val}/100
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all duration-300`}
                      style={{ width: `${Math.max(4, Math.min(100, val))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Positives List */}
          {positives.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-gray-200 dark:border-zinc-700">
              <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-400 block">
                Highlights & Positives
              </span>
              <ul className="space-y-0.5 text-[11px] text-gray-600 dark:text-gray-300">
                {positives.map((pos, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                    <span>{pos}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Red Flags List */}
          {redFlags.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-gray-200 dark:border-zinc-700">
              <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-400 block">
                Points of Caution
              </span>
              <ul className="space-y-0.5 text-[11px] text-gray-700 dark:text-gray-300">
                {redFlags.map((flag, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                    <AlertTriangle className="size-3 text-rose-600 shrink-0" />
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
