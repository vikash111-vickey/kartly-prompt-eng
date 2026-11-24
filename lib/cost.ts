import type { Product } from "@/types/product";

export interface TotalCostResult {
  total: number | null;
  note: string;
}

/**
 * Calculates the total cost of a product including delivery fee if known.
 * Never assumes free delivery (0) unless explicitly stated.
 */
export function getTotalCost(product: Partial<Product> & { deliveryText?: string }): TotalCostResult {
  if (typeof product.price !== "number" || isNaN(product.price)) {
    return { total: null, note: "Price not confirmed" };
  }

  // 1. Both price and deliveryFee are known numbers
  if (typeof product.deliveryFee === "number" && !isNaN(product.deliveryFee)) {
    if (product.deliveryFee === 0) {
      return { total: product.price, note: "Free delivery" };
    }
    return {
      total: product.price + product.deliveryFee,
      note: "Price + delivery",
    };
  }

  // 2. Price is known and delivery text explicitly indicates free delivery
  const deliveryStr = (product.deliveryText || product.deliveryEta || "").toLowerCase();
  if (deliveryStr.includes("free")) {
    return { total: product.price, note: "Free delivery" };
  }

  // 3. Delivery cost is unknown
  return { total: null, note: "Delivery fee not confirmed" };
}
