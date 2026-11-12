import type { DiscountType } from "@/types/models";

/**
 * Rounds a number to exactly 2 decimal places without IEEE-754 drift.
 */
export function roundToTwoDecimals(num: number): number {
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

/**
 * Calculates the total price for a single line item: quantity * unitPrice.
 * Ensures non-negative result rounded to 2 decimal places.
 */
export function calculateItemTotal(
  quantity: number | string | null | undefined,
  unitPrice: number | string | null | undefined
): number {
  const qty = Math.max(0, Number(quantity) || 0);
  const price = Math.max(0, Number(unitPrice) || 0);
  return roundToTwoDecimals(qty * price);
}

/**
 * Calculates the raw subtotal by summing the line item totals across all items.
 */
export function calculateSubtotal(
  items: Array<{
    quantity: number | string | null | undefined;
    unitPrice: number | string | null | undefined;
  }> = []
): number {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }

  const rawSum = items.reduce((sum, item) => {
    return sum + calculateItemTotal(item.quantity, item.unitPrice);
  }, 0);

  return roundToTwoDecimals(rawSum);
}

/**
 * Calculates the discount amount deducted from the subtotal.
 * Supports:
 * - PERCENTAGE: rate between 0% and 100% applied to subtotal
 * - FIXED: fixed rupee value capped at subtotal
 */
export function calculateDiscount(
  subtotal: number,
  discountType?: "PERCENTAGE" | "FIXED" | DiscountType | null,
  discountValue: number | string = 0
): number {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const val = Math.max(0, Number(discountValue) || 0);

  if (!discountType || val <= 0 || safeSubtotal === 0) {
    return 0;
  }

  if (discountType === "PERCENTAGE") {
    const rate = Math.min(100, val);
    return roundToTwoDecimals((safeSubtotal * rate) / 100);
  }

  if (discountType === "FIXED") {
    return roundToTwoDecimals(Math.min(safeSubtotal, val));
  }

  return 0;
}

/**
 * Calculates tax on a given taxable amount (subtotal - discount) using taxRate percentage.
 */
export function calculateTax(
  taxableAmount: number,
  taxRate: number | string = 0
): number {
  const safeTaxable = Math.max(0, Number(taxableAmount) || 0);
  const rate = Math.max(0, Math.min(100, Number(taxRate) || 0));

  if (safeTaxable === 0 || rate === 0) {
    return 0;
  }

  return roundToTwoDecimals((safeTaxable * rate) / 100);
}

export interface QuotationCalculationParams {
  items: Array<{
    quantity: number | string | null | undefined;
    unitPrice: number | string | null | undefined;
  }>;
  discountType?: "PERCENTAGE" | "FIXED" | DiscountType | null;
  discountValue?: number | string | null;
  taxRate?: number | string | null;
}

export interface QuotationTotalsResult {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  grandTotal: number;
  // Aliases for compatibility
  amountAfterDiscount: number;
  totalAmount: number;
}

/**
 * Computes all financial totals for a quotation synchronously with zero drift.
 */
export function calculateQuotationTotals({
  items,
  discountType,
  discountValue = 0,
  taxRate = 0,
}: QuotationCalculationParams): QuotationTotalsResult {
  const subtotal = calculateSubtotal(items);
  const discountAmount = calculateDiscount(
    subtotal,
    discountType,
    discountValue ?? 0
  );

  const taxableAmount = Math.max(0, roundToTwoDecimals(subtotal - discountAmount));
  const taxAmount = calculateTax(taxableAmount, taxRate ?? 0);
  const grandTotal = roundToTwoDecimals(taxableAmount + taxAmount);

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    grandTotal,
    amountAfterDiscount: taxableAmount,
    totalAmount: grandTotal,
  };
}
