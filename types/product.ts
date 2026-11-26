import type { SafetyCheckResult } from "@/lib/safety/check";

export type LinkType = "direct" | "platform_search";

export type TrustLabel = "great" | "good" | "careful" | "risky";
export type TrustConfidence = "high" | "medium" | "low";

export interface ScoreBreakdown {
  reviews?: number;
  price?: number;
  seller?: number;
  delivery?: number;
  fraud?: number;
}

export interface Product {
  id: string;
  title: string;
  platform: string;
  domain: string;
  link: string;
  linkType: LinkType;
  productId?: string;
  immersiveToken?: string;
  price?: number;
  deliveryFee?: number;
  deliveryEta?: string;
  rating?: number;
  reviewCount?: number;
  seller?: string;
  sellerVerified?: boolean;
  returnPolicy?: string;
  image?: string;
  trustScore?: number;
  trustLabel?: TrustLabel;
  confidence?: TrustConfidence;
  scoreBreakdown?: ScoreBreakdown;
  redFlags?: string[];
  positives?: string[];
  whyPicked?: string;
  providerFailed?: boolean;
}

export interface WishlistItem {
  id: string;
  title: string;
  platform: string;
  price?: number;
  image?: string;
  link: string;
  linkType: LinkType;
  trustScore?: number;
  trustLabel?: TrustLabel;
  savedAt: number;
}

export type ChatErrorCode = "quota" | "overload" | "search" | "unknown" | "model";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  products?: Product[];
  searchQuery?: string;
  safetyCheck?: SafetyCheckResult;
  errorCode?: ChatErrorCode;
  isCutOff?: boolean;
  notice?: string;
}
