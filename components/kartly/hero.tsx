"use client";

import React from "react";
import { motion } from "framer-motion";
import { AskInput } from "./ask-input";
import { GiftDialog } from "./gift-dialog";

export interface HeroProps {
  onSubmit: (value: string) => void;
  disabled?: boolean;
}

const QUICK_SUGGESTIONS = [
  "Best earbuds under ₹2000",
  "Cheapest groceries in 10 minutes",
  "Is this seller legit? Paste a link",
  "Gift for my mom, around ₹1500",
  "நல்ல மொபைல் ₹15000 க்குள்",
  "बजट में अच्छा लैपटॉप दिखाओ",
];

export function Hero({ onSubmit, disabled = false }: HeroProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 py-12 text-center max-w-3xl mx-auto w-full">
      {/* Animated Headline with fade + slide-up + blur-in on load */}
      <motion.h1
        initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-gray-950"
      >
        What are you shopping for today?
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-500 max-w-lg leading-relaxed"
      >
        I search Amazon, Flipkart, Blinkit, Zepto and more, then pick the safest best deal.
      </motion.p>

      {/* AskInput pill input */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl mt-8 sm:mt-10"
      >
        <AskInput onSubmit={onSubmit} disabled={disabled} autoFocus />
      </motion.div>

      {/* Quick Suggestion Chips + Gift Finder */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-center justify-center gap-2 mt-4 max-w-xl"
      >
        <GiftDialog onSubmit={onSubmit} />

        {QUICK_SUGGESTIONS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onSubmit(chip)}
            disabled={disabled}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 hover:text-gray-900 border border-gray-200/80 rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            {chip}
          </button>
        ))}
      </motion.div>
    </div>
  );
}

export default Hero;
