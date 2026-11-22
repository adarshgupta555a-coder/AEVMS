/**
 * Rental Metrics Calculation Helper
 * Real-time client-side calculation helper matching Section 4.1 of `docs/inventory-frontend-guide.md`
 */

export interface CalculateRentalMetricsParams {
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  requiredQuantity: number;
  rentPerUnit?: number | null;
}

export interface RentalMetricsResult {
  rentalDays: number;
  totalRent: number;
}

/**
 * Calculates rental days and total rent based on start/end dates, quantity, and unit rate.
 * - Minimum rental duration is 1 day.
 * - Total rent is rounded to 2 decimal places.
 */
export function calculateRentalMetrics(
  params: CalculateRentalMetricsParams
): RentalMetricsResult {
  let rentalDays = 1;
  if (params.startDate && params.endDate) {
    const start = new Date(params.startDate).getTime();
    const end = new Date(params.endDate).getTime();
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      rentalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    }
  }

  const rate = Number(params.rentPerUnit || 0);
  const qty = Number(params.requiredQuantity || 0);
  const totalRent = Math.round(qty * rate * rentalDays * 100) / 100;

  return { rentalDays, totalRent };
}
