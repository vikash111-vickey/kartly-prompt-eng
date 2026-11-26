export interface CleanedQuery {
  searchQuery: string;
  maxPrice?: number;
}

/**
 * Deterministic fallback query cleaner.
 * Used when a tool call lacks an explicit, clean searchQuery.
 *
 * 1. Lowercases the text.
 * 2. Extracts budget/price patterns (e.g. "under 3000", "below ₹3000", "3000 के अंदर") as maxPrice.
 * 3. Removes common filler phrases and conversational baggage.
 * 4. Collapses multiple whitespace characters.
 */
export function cleanSearchQuery(rawText: string): CleanedQuery {
  if (!rawText || !rawText.trim()) {
    return { searchQuery: "" };
  }

  let text = rawText.toLowerCase().trim();
  let maxPrice: number | undefined = undefined;

  // 1. Extract Price Patterns
  // Pattern A: "under 3000", "below ₹3000", "less than 3000", "within 3000"
  const englishPriceRegex = /\b(?:under|below|less\s+than|within|around)\s*(?:rs\.?|inr|₹)?\s*(\d+)(?:\s*(k|thousand))?\b/i;
  const engMatch = text.match(englishPriceRegex);
  if (engMatch) {
    let val = parseInt(engMatch[1], 10);
    if (engMatch[2]?.toLowerCase().startsWith("k") || engMatch[2]?.toLowerCase().startsWith("thousand")) {
      val *= 1000;
    }
    if (!isNaN(val) && val > 0) {
      maxPrice = val;
    }
    text = text.replace(englishPriceRegex, " ");
  }

  // Pattern B: Hindi price phrases: e.g. "3000 के अंदर", "3000 के अन्दर", "₹3000 से कम", "3000 तक"
  const hindiPriceRegex = /(?:rs\.?|inr|₹)?\s*(\d+)\s*(?:k|thousand)?\s*(?:के\s*अंदर|के\s*अन्दर|से\s*कम|तक)(?:\s|$)/i;
  const hindiMatch = text.match(hindiPriceRegex);
  if (!maxPrice && hindiMatch) {
    const val = parseInt(hindiMatch[1], 10);
    if (!isNaN(val) && val > 0) {
      maxPrice = val;
    }
    text = text.replace(hindiPriceRegex, " ");
  }

  // Pattern C: Tamil price phrases: e.g. "₹15000 க்குள்", "15000 வரை"
  const tamilPriceRegex = /(?:rs\.?|inr|₹)?\s*(\d+)\s*(?:k|thousand)?\s*(?:க்குள்|வரை)(?:\s|$)/i;
  const tamilMatch = text.match(tamilPriceRegex);
  if (!maxPrice && tamilMatch) {
    const val = parseInt(tamilMatch[1], 10);
    if (!isNaN(val) && val > 0) {
      maxPrice = val;
    }
    text = text.replace(tamilPriceRegex, " ");
  }

  // 2. Remove filler phrases (ordered longest first to prevent partial removals)
  const fillerPhrases = [
    "am liking to buy",
    "i want to buy",
    "i'd like to buy",
    "i would like to buy",
    "in 10 minutes",
    "in 10 mins",
    "in 10 min",
    "in 15 minutes",
    "in 15 min",
    "10 minutes",
    "10 mins",
    "10 min",
    "fast delivery",
    "fastest delivery",
    "urgent delivery",
    "looking for",
    "show some",
    "show me",
    "can you",
    "cheapest",
    "cheaper",
    "cheap",
    "i want",
    "i need",
    "for me",
    "please",
    "a new",
    "new",
    "good",
    "best",
    "बजट में",
    "बजट मे",
    "अच्छा",
    "अच्छी",
    "बढ़िया",
    "दिखाओ",
    "दिखाइए",
    "சிறந்த",
    "நல்ல",
    "காட்டுங்கள்",
    "காட்டு",
  ];

  for (const phrase of fillerPhrases) {
    // Word boundary replace for ASCII / unicode aware
    const regex = new RegExp(`(^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "gi");
    text = text.replace(regex, " ");
  }

  // 3. Handle redundant purpose repetitions (e.g. "study chair for study" -> "study chair")
  // If "for <word>" repeats a word already in the query, strip the "for <word>" phrase.
  const words = text.split(/\s+/).filter(Boolean);
  const forIndex = words.indexOf("for");
  if (forIndex !== -1 && forIndex < words.length - 1) {
    const purposeWord = words[forIndex + 1];
    const priorWords = words.slice(0, forIndex);
    if (priorWords.includes(purposeWord)) {
      // Remove "for <purposeWord>"
      words.splice(forIndex, 2);
      text = words.join(" ");
    }
  }

  // 4. Strip punctuation and special characters
  text = text.replace(/[,?!.:;'"|`~]/g, " ");

  // 5. Collapse spaces and trim
  const cleanedText = text.replace(/\s+/g, " ").trim();

  // If the query is only a generic conversational acknowledgment, treat as empty
  const conversationalAcks = new Set([
    "ok",
    "okay",
    "yes",
    "yep",
    "yeah",
    "sure",
    "fine",
    "cool",
    "alright",
    "thanks",
    "thank you",
    "hi",
    "hello",
    "hey",
  ]);

  if (conversationalAcks.has(cleanedText)) {
    return {
      searchQuery: "",
      maxPrice,
    };
  }

  return {
    searchQuery: cleanedText,
    maxPrice,
  };
}
