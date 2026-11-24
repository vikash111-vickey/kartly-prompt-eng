"use client";

import React, { useState, useEffect, useRef, useId, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { VoiceButton, type VoiceButtonHandle } from "./voice-button";

export interface AskInputProps {
  placeholders?: string[];
  onSubmit: (value: string) => void;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

const DEFAULT_PLACEHOLDERS = [
  "Best earbuds under ₹2000",
  "Cheapest groceries in 10 minutes",
  "Is this seller legit? Paste a link",
  "Gift for my mom, around ₹1500",
  "நல்ல மொபைல் ₹15000 க்குள்",
  "बजट में अच्छा लैपटॉप दिखाओ",
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  startTime: number;
  duration: number;
}

export function AskInput({
  placeholders = DEFAULT_PLACEHOLDERS,
  onSubmit,
  disabled = false,
  className,
  autoFocus = false,
}: AskInputProps) {
  const [value, setValue] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDissolving, setIsDissolving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const voiceRef = useRef<VoiceButtonHandle>(null);
  const inputId = useId();

  // Rotate placeholders every ~2.8s
  useEffect(() => {
    if (placeholders.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % placeholders.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [placeholders.length]);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Canvas dissolve animation logic
  const triggerDustDissolve = useCallback(
    (textToSubmit: string) => {
      const input = inputRef.current;
      const canvas = canvasRef.current;
      if (!input || !canvas) {
        onSubmit(textToSubmit);
        return;
      }

      const rect = input.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        onSubmit(textToSubmit);
        return;
      }

      ctx.scale(dpr, dpr);

      // Measure computed styles to replicate the exact rendered text
      const style = window.getComputedStyle(input);
      const fontSize = parseFloat(style.fontSize) || 14;
      const fontFamily = style.fontFamily || "sans-serif";
      const fontWeight = style.fontWeight || "400";
      const textColor = style.color || "#111827";
      const paddingLeft = parseFloat(style.paddingLeft) || 20;

      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.textBaseline = "middle";
      ctx.fillStyle = textColor;

      const textY = rect.height / 2;
      ctx.fillText(textToSubmit, paddingLeft, textY);

      // Extract pixel data for dust particle generation
      let imgData: ImageData;
      try {
        imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onSubmit(textToSubmit);
        return;
      }

      const data = imgData.data;
      const particles: Particle[] = [];
      const step = 2 * dpr; // Sample every 2 virtual pixels

      let minX = canvas.width;
      let maxX = 0;

      // First pass: find horizontal text bounds
      for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
          const index = (y * canvas.width + x) * 4;
          const alpha = data[index + 3];
          if (alpha > 40) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
          }
        }
      }

      const totalSpan = Math.max(maxX - minX, 1);
      const now = performance.now();
      const waveDuration = 450; // Delay spread from right to left

      // Second pass: generate particles with right-to-left dissolve delay
      for (let y = 0; y < canvas.height; y += step) {
        for (let x = 0; x < canvas.width; x += step) {
          const index = (y * canvas.width + x) * 4;
          const alpha = data[index + 3];
          if (alpha > 40) {
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];

            // Right-to-left delay: particles on the right activate first
            const rightToLeftFraction = (maxX - x) / totalSpan;
            const delay = rightToLeftFraction * waveDuration;

            particles.push({
              x: x / dpr,
              y: y / dpr,
              vx: Math.random() * 1.8 + 0.6, // fly slightly right
              vy: (Math.random() - 0.5) * 1.4 - 0.4, // slight upward float
              color: `rgb(${r}, ${g}, ${b})`,
              size: Math.random() * 1.2 + 0.8,
              startTime: now + delay,
              duration: 380 + Math.random() * 200,
            });
          }
        }
      }

      // Clear static text preview on canvas and empty the real input
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setValue("");
      setIsDissolving(true);

      const maxEndTime = now + waveDuration + 600;

      const renderLoop = (timestamp: number) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let activeCount = 0;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          if (timestamp < p.startTime) {
            // Not yet dissolved: render static point
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            activeCount++;
          } else {
            const elapsed = timestamp - p.startTime;
            const progress = elapsed / p.duration;

            if (progress < 1) {
              const currentX = p.x + p.vx * (elapsed / 16);
              const currentY = p.y + p.vy * (elapsed / 16);
              const currentAlpha = Math.max(0, 1 - progress);

              ctx.save();
              ctx.globalAlpha = currentAlpha;
              ctx.fillStyle = p.color;
              ctx.beginPath();
              ctx.arc(currentX, currentY, p.size * (1 - progress * 0.4), 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
              activeCount++;
            }
          }
        }

        if (activeCount > 0 && timestamp < maxEndTime) {
          animFrameRef.current = requestAnimationFrame(renderLoop);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          setIsDissolving(false);
          onSubmit(textToSubmit);
        }
      };

      animFrameRef.current = requestAnimationFrame(renderLoop);
    },
    [onSubmit]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    voiceRef.current?.stopListening();
    const trimmed = value.trim();
    if (!trimmed || disabled || isDissolving) return;

    // Respect prefers-reduced-motion: skip canvas dissolve effect
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setValue("");
      onSubmit(trimmed);
      return;
    }

    triggerDustDissolve(trimmed);
  };

  const handleVoiceTranscript = useCallback((transcribedText: string) => {
    setValue((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${transcribedText}` : transcribedText;
    });
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("w-full relative", className)}
      role="search"
    >
      <div
        ref={containerRef}
        className={cn(
          "relative flex items-center w-full rounded-full bg-white border border-gray-200",
          "shadow-xs hover:border-gray-300 transition-all duration-200",
          "focus-within:border-gray-400 focus-within:ring-2 focus-within:ring-gray-200/70"
        )}
      >
        <label htmlFor={inputId} className="sr-only">
          What are you shopping for?
        </label>

        {/* Real text input */}
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled || isDissolving}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            "w-full bg-transparent pl-5 pr-28 py-3 text-sm text-gray-900",
            "placeholder:text-transparent focus:outline-hidden",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            isDissolving && "text-transparent select-none"
          )}
        />

        {/* Canvas for text dissolve animation */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none z-10"
        />

        {/* Rotating placeholder overlaid when input is empty and not dissolving */}
        <AnimatePresence mode="wait">
          {!value && !isDissolving && (
            <motion.span
              key={currentIndex}
              initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none text-sm text-gray-400 select-none truncate pr-28"
            >
              {placeholders[currentIndex]}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Right Action Buttons: Voice Input & Submit Arrow */}
        <div className="flex items-center gap-1 mr-2 shrink-0 z-20">
          <VoiceButton
            ref={voiceRef}
            onTranscript={handleVoiceTranscript}
            disabled={disabled || isDissolving}
          />

          <motion.button
            type="submit"
            disabled={disabled || !value.trim() || isDissolving}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            aria-label="Send query"
            className={cn(
              "size-9 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300",
              "text-gray-700 flex items-center justify-center",
              "transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            )}
          >
            <ArrowRight className="size-4" />
          </motion.button>
        </div>
      </div>
    </form>
  );
}
