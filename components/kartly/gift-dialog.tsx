"use client";

import React, { useState } from "react";
import { Gift, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const RECIPIENTS = [
  "Mom",
  "Dad",
  "Partner",
  "Friend",
  "Child",
  "Colleague",
] as const;

export const OCCASIONS = [
  "Birthday",
  "Anniversary",
  "Festival",
  "Wedding",
  "Thank you",
] as const;

export function formatGiftPrompt(
  recipient: string,
  occasion: string,
  budget: number,
  interests?: string
): string {
  const occasionLower = occasion.toLowerCase();
  const recipientLower = recipient.toLowerCase();

  let base = `Gift ideas for my ${recipientLower}'s ${occasionLower}, budget around ₹${budget}.`;

  if (interests && interests.trim()) {
    const trimmed = interests.trim();
    if (/^(she|he|they)\s+likes?/i.test(trimmed)) {
      base += ` ${trimmed.charAt(0).toUpperCase() + trimmed.slice(1)}.`;
    } else {
      let pronoun = "They like";
      if (recipientLower === "mom") pronoun = "She likes";
      else if (recipientLower === "dad") pronoun = "He likes";
      else if (recipientLower === "partner") pronoun = "They like";
      else if (recipientLower === "friend") pronoun = "They like";
      else if (recipientLower === "child") pronoun = "They like";
      else if (recipientLower === "colleague") pronoun = "They like";

      base += ` ${pronoun} ${trimmed}.`;
    }
  }

  return base;
}

export interface GiftDialogProps {
  onSubmit: (prompt: string) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function GiftDialog({
  onSubmit,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: GiftDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const [recipient, setRecipient] = useState<string>("Mom");
  const [occasion, setOccasion] = useState<string>("Birthday");
  const [budget, setBudget] = useState<string>("1500");
  const [interests, setInterests] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedBudget = parseFloat(budget.replace(/,/g, "").trim());

    if (isNaN(parsedBudget) || parsedBudget <= 0) {
      setError("Please enter a valid budget in ₹ (e.g. 1500).");
      return;
    }

    setError(null);
    const prompt = formatGiftPrompt(recipient, occasion, parsedBudget, interests);
    setOpen(false);
    onSubmit(prompt);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={<>{trigger}</>} />
      ) : (
        <DialogTrigger
          render={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/80 transition-colors cursor-pointer"
            >
              <Gift className="size-3.5 text-rose-500" />
              <span>Gift ideas</span>
            </button>
          }
        />
      )}

      <DialogContent className="max-w-md w-full p-6 sm:p-7">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
              <Gift className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-gray-900">
                Gift Finder
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500 mt-0.5">
                Tell Kartly who you are shopping for and we will find top picks
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Who is it for */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Who is this gift for?
            </label>
            <div className="flex flex-wrap gap-1.5">
              {RECIPIENTS.map((item) => {
                const isSelected = recipient === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRecipient(item)}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-full font-medium transition-all cursor-pointer",
                      isSelected
                        ? "bg-rose-600 text-white shadow-xs"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Occasion */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              What is the occasion?
            </label>
            <div className="flex flex-wrap gap-1.5">
              {OCCASIONS.map((item) => {
                const isSelected = occasion === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setOccasion(item)}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-full font-medium transition-all cursor-pointer",
                      isSelected
                        ? "bg-rose-600 text-white shadow-xs"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Budget */}
          <div>
            <label
              htmlFor="gift-budget-input"
              className="block text-xs font-semibold text-gray-700 mb-1.5"
            >
              Budget (in ₹)
            </label>
            <div className="relative rounded-lg shadow-2xs">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 font-medium text-sm">
                ₹
              </span>
              <input
                id="gift-budget-input"
                type="number"
                min="1"
                step="50"
                value={budget}
                onChange={(e) => {
                  setBudget(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="1500"
                required
                className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:border-rose-500 focus:ring-2 focus:ring-rose-200/50 outline-hidden transition-all"
              />
            </div>
            {error && (
              <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>
            )}
          </div>

          {/* Optional Interests */}
          <div>
            <label
              htmlFor="gift-interests-input"
              className="block text-xs font-semibold text-gray-700 mb-1.5"
            >
              Interests or hobbies <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="gift-interests-input"
              type="text"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="e.g. cooking, reading, gardening, gadgets"
              className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:border-rose-500 focus:ring-2 focus:ring-rose-200/50 outline-hidden transition-all placeholder:text-gray-400"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="size-4" />
              <span>Find Gift Ideas</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default GiftDialog;
