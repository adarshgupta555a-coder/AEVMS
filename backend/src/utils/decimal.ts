import { Prisma } from "../lib/prisma.js";
import { DiscountType } from "../generated/prisma/enums.js";

/**
 * High-precision financial decimal math helpers (INR currency standard: 2 decimal places)
 */

export function round2(val: number | Prisma.Decimal | string): number {
  const num = typeof val === "number" ? val : Number(val) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function toDecimal(val: number | Prisma.Decimal | string): Prisma.Decimal {
  if (val instanceof Prisma.Decimal) {
    return val;
  }
  const rounded = round2(val);
  return new Prisma.Decimal(rounded.toFixed(2));
}

export interface LineItemPricingInput {
  quantity: number | Prisma.Decimal | string;
  unitPrice: number | Prisma.Decimal | string;
  advanceAdjusted?: number | Prisma.Decimal | string;
}

export interface CalculatedPricingResult {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
}

/**
 * Computes financial totals with discount (PERCENTAGE or FIXED), tax rate, and clamps against negative values.
 */
export function calculateTotals(
  subtotalRaw: number,
  discountType?: DiscountType | null,
  discountValue = 0,
  taxRate = 0
): CalculatedPricingResult {
  const subtotal = round2(subtotalRaw);

  let discountAmount = 0;
  if (discountType === DiscountType.PERCENTAGE) {
    const rate = Math.max(0, Math.min(100, Number(discountValue) || 0));
    discountAmount = round2((subtotal * rate) / 100);
  } else if (discountType === DiscountType.FIXED) {
    const fixedVal = Math.max(0, Number(discountValue) || 0);
    discountAmount = round2(Math.min(subtotal, fixedVal));
  }

  const taxableAmount = Math.max(0, round2(subtotal - discountAmount));
  const safeTaxRate = Math.max(0, Math.min(100, Number(taxRate) || 0));
  const taxAmount = round2((taxableAmount * safeTaxRate) / 100);
  const totalAmount = round2(taxableAmount + taxAmount);

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    taxRate: safeTaxRate,
    taxAmount,
    totalAmount,
  };
}
