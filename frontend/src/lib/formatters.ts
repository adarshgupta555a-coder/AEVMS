import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";

/**
 * Format numeric value as Indian Rupee currency (₹xx,xx,xxx.00)
 * Uses the Indian numbering system (Lakhs and Crores)
 */
export function formatINR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") {
    return "₹0.00";
  }

  const numericValue =
    typeof amount === "string" ? parseFloat(amount) : Number(amount);

  if (Number.isNaN(numericValue)) {
    return "₹0.00";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

/**
 * Validates a 10-digit Indian mobile number
 * Strictly checks the ^[6-9]\d{9}$ pattern, optionally handling +91 prefix
 */
export function isValidIndianPhone(phone: string): boolean {
  if (!phone || typeof phone !== "string") {
    return false;
  }

  const clean = phone.trim().replace(/[\s-]/g, "");

  if (clean.startsWith("+91") && clean.length === 13) {
    return /^[6-9]\d{9}$/.test(clean.slice(3));
  }

  if (clean.startsWith("91") && clean.length === 12) {
    return /^[6-9]\d{9}$/.test(clean.slice(2));
  }

  return /^[6-9]\d{9}$/.test(clean);
}

/**
 * Formats a valid 10-digit Indian phone number as +91 XXXXX XXXXX
 */
export function formatIndianPhone(phone: string | null | undefined): string {
  if (!phone) return "-";

  const clean = phone.trim().replace(/[\s-]/g, "");
  let digits = clean;

  if (clean.startsWith("+91") && clean.length === 13) {
    digits = clean.slice(3);
  } else if (clean.startsWith("91") && clean.length === 12) {
    digits = clean.slice(2);
  }

  if (/^[6-9]\d{9}$/.test(digits)) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  return phone;
}

/**
 * Parses and validates an input date string or Date object
 */
export function toValidDate(
  date: string | Date | null | undefined
): Date | null {
  if (!date) return null;
  if (date instanceof Date) {
    return isValid(date) ? date : null;
  }

  const parsedIso = parseISO(date);
  if (isValid(parsedIso)) {
    return parsedIso;
  }

  const fallback = new Date(date);
  return isValid(fallback) ? fallback : null;
}

/**
 * Formats a date using date-fns format (default: 'dd MMM yyyy', e.g. 15 Oct 2026)
 */
export function formatDate(
  date: string | Date | null | undefined,
  formatStr = "dd MMM yyyy"
): string {
  const validDate = toValidDate(date);
  if (!validDate) return "-";
  return format(validDate, formatStr);
}

/**
 * Formats a date with time (default: 'dd MMM yyyy, hh:mm a', e.g. 15 Oct 2026, 02:30 PM)
 */
export function formatDateTime(
  date: string | Date | null | undefined,
  formatStr = "dd MMM yyyy, hh:mm a"
): string {
  const validDate = toValidDate(date);
  if (!validDate) return "-";
  return format(validDate, formatStr);
}

/**
 * Returns a human-readable relative time string (e.g. '2 hours ago', 'in 3 days')
 */
export function formatRelativeTime(
  date: string | Date | null | undefined
): string {
  const validDate = toValidDate(date);
  if (!validDate) return "-";
  return formatDistanceToNow(validDate, { addSuffix: true });
}
