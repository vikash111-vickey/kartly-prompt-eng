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
  const confidence: TrustConfidence = product.confidence || "medium";
  const breakdown = product.scoreBreakdown || {};
  const positives = product.positives || [];
  const redFlags = product.redFlags || [];

  // Identify genuine caution flags (excluding purely statistical sparse review notes)
  const actualRedFlags = redFlags.filter(
    (rf) => !rf.toLowerCase().includes("too few reviews")
  );
  const hasActualRedFlags = actualRedFlags.length > 0;
  const isLowScore = score < 65;

  // When confidence is low without genuine red flags or a low score:
  // Render neutral gray pill "Limited data" without score on the outer pill.
  // Keep amber/red only for actual red flags or low score.
  const showLimitedDataPill = confidence === "low" && !hasActualRedFlags && !isLowScore;

  const labelKey: TrustLabel =
    product.trustLabel ||
    (score >= 80 ? "great" : score >= 65 ? "good" : score >= 45 ? "careful" : "risky");
  const config = LABEL_CONFIG[labelKey];
  const IconComponent = config.icon;

  return (
    <div className="mt-2 text-left">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Pill Badge with whitespace-nowrap */}
        {showLimitedDataPill ? (
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-gray-100 text-gray-700 border-gray-200 whitespace-nowrap"
            aria-label="Trust rating: Limited data"
          >
            <Info className="size-3.5 shrink-0 text-gray-500" aria-hidden="true" />
            <span className="whitespace-nowrap">Limited data</span>
          </div>
        ) : (
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.pillBg} ${config.pillText} ${config.pillBorder} whitespace-nowrap`}
            aria-label={`Trust Score: ${score} out of 100, rating: ${config.text}`}
          >
            <IconComponent className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">{score}/100</span>
            <span className="text-gray-300">•</span>
            <span className="whitespace-nowrap">{config.text}</span>
          </div>
        )}

        {/* Accordion Toggle */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 hover:underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded px-1 whitespace-nowrap cursor-pointer"
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
          className="mt-2.5 p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs space-y-3 animate-in fade-in-50 duration-150"
        >
          {/* Header Score Display in Breakdown */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-200">
            <span className="font-semibold text-gray-900 text-xs">
              Trust Score: {score}/100
            </span>
            {confidence === "low" && (
              <span className="text-[11px] text-gray-600 italic">
                Not enough reviews to rate this confidently
              </span>
            )}
          </div>

          {/* Low Confidence Notice */}
          {confidence === "low" && (
            <div className="flex items-start gap-2 p-2 rounded bg-gray-100 border border-gray-200 text-gray-700 text-[11px] leading-tight">
              <Info className="size-3.5 text-gray-500 shrink-0 mt-0.5" />
              <span>
                <strong>Limited public data:</strong> Not enough verified reviews to rate this confidently. Always check seller reputation directly before checkout.
              </span>
            </div>
          )}

          {/* Factor Breakdown Bars */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-gray-700 block">
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
                  <div className="flex justify-between text-[11px] text-gray-600">
                    <span>{name}</span>
                    <span className="font-semibold text-gray-800">
                      {val}/100
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
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
            <div className="space-y-1 pt-1 border-t border-gray-200">
              <span className="text-[11px] font-semibold text-emerald-800 block">
                Highlights & Positives
              </span>
              <ul className="space-y-0.5 text-[11px] text-gray-600">
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
            <div className="space-y-1 pt-1 border-t border-gray-200">
              <span className="text-[11px] font-semibold text-rose-800 block">
                Points of Caution
              </span>
              <ul className="space-y-0.5 text-[11px] text-gray-700">
                {redFlags.map((flag, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-rose-700">
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
