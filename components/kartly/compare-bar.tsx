"use client";

import React from "react";
import Image from "next/image";
import { ArrowLeftRight } from "lucide-react";
import type { Product } from "@/types/product";

export interface CompareBarProps {
  products: Product[];
  onOpenCompare: () => void;
  onClear: () => void;
}

export function CompareBar({
  products,
  onOpenCompare,
  onClear,
}: CompareBarProps) {
  if (products.length < 2) {
    return null;
  }

  return (
    <aside
      aria-label="Comparison dock"
      className="sticky bottom-20 z-30 mx-auto max-w-3xl w-full px-4 mb-2 animate-in slide-in-from-bottom-2 fade-in duration-200"
    >
      <div className="flex items-center justify-between gap-3 p-2.5 sm:px-4 bg-gray-900/95 backdrop-blur-md text-white rounded-2xl shadow-xl border border-gray-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex -space-x-2 shrink-0">
            {products.map((p) => (
              <div
                key={p.id}
                className="relative size-8 sm:size-9 rounded-lg overflow-hidden bg-white border-2 border-gray-900 shadow-sm shrink-0 flex items-center justify-center p-0.5"
                title={p.title}
              >
                <Image
                  src={p.image || "/placeholder-product.svg"}
                  alt={p.title}
                  width={32}
                  height={32}
                  unoptimized
                  className="w-full h-full object-contain"
                />
              </div>
            ))}
          </div>
          <span className="text-xs sm:text-sm font-medium text-gray-200 truncate">
            {products.length} items ready to compare
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClear}
            className="px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-800/80 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            aria-label="Clear product comparison selection"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onOpenCompare}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-lg shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
          >
            <ArrowLeftRight className="size-3.5" aria-hidden="true" />
            <span>Compare ({products.length})</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default CompareBar;
