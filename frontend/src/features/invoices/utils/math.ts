import type { DiscountTypeEnum } from "../schemas/invoice.schema";

/**
 * Rounds a number to exactly 2 decimal places without IEEE-754 drift.
 */
export function roundToTwoDecimals(num: number): number {
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates the total price for a single line item: quantity * unitPrice.
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
 * Calculates the gross subtotal across all line items (sum of quantity * unitPrice).
 */
export function calculateGrossSubtotal(
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
 * Calculates the total advances adjusted across all line items.
 */
export function calculateAdvanceAdjustedTotal(
  items: Array<{
    advanceAdjusted?: number | string | null | undefined;
  }> = []
): number {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }

  const rawSum = items.reduce((sum, item) => {
    const advance = Math.max(0, Number(item.advanceAdjusted) || 0);
    return sum + advance;
  }, 0);

  return roundToTwoDecimals(rawSum);
}

/**
 * Calculates the discount amount deducted from the gross subtotal.
 * Supports:
 * - PERCENTAGE: rate between 0% and 100% applied to subtotal
 * - FIXED: fixed rupee value capped at subtotal
 */
export function calculateDiscount(
  subtotal: number,
  discountType?: "PERCENTAGE" | "FIXED" | DiscountTypeEnum | null,
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
 * Calculates tax on a taxable amount using taxRate percentage.
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

export interface InvoiceCalculationParams {
  items: Array<{
    quantity: number | string | null | undefined;
    unitPrice: number | string | null | undefined;
    advanceAdjusted?: number | string | null | undefined;
  }>;
  discountType?: "PERCENTAGE" | "FIXED" | DiscountTypeEnum | "NONE" | null;
  discountValue?: number | string | null;
  taxRate?: number | string | null;
}

export interface InvoiceCalculationSummary {
  grossSubtotal: number;
  advanceAdjustedTotal: number;
  discountAmount: number;
  taxableSubtotal: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  netBalanceDue: number;
}

/**
 * Computes all financial breakdown figures for invoice creation & detail view.
 */
export function calculateInvoiceTotals(
  params: InvoiceCalculationParams
): InvoiceCalculationSummary {
  const { items = [], discountType, discountValue = 0, taxRate = 0 } = params;

  const grossSubtotal = calculateGrossSubtotal(items);
  const advanceAdjustedTotal = calculateAdvanceAdjustedTotal(items);

  const cleanDiscountType =
    discountType === "NONE" ? null : (discountType as DiscountTypeEnum | null);
  const discountAmount = calculateDiscount(
    grossSubtotal,
    cleanDiscountType,
    discountValue ?? 0
  );

  const taxableSubtotal = Math.max(0, roundToTwoDecimals(grossSubtotal - discountAmount));
  const safeTaxRate = Math.max(0, Math.min(100, Number(taxRate) || 0));
  const taxAmount = calculateTax(taxableSubtotal, safeTaxRate);
  const grandTotal = roundToTwoDecimals(taxableSubtotal + taxAmount);
  const netBalanceDue = Math.max(0, roundToTwoDecimals(grandTotal - advanceAdjustedTotal));

  return {
    grossSubtotal,
    advanceAdjustedTotal,
    discountAmount,
    taxableSubtotal,
    taxRate: safeTaxRate,
    taxAmount,
    grandTotal,
    netBalanceDue,
  };
}
