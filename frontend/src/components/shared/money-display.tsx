import * as React from "react";
import { formatINR } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface MoneyDisplayProps {
  amount: number | string | null | undefined;
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl";
  showSign?: boolean;
  colorCoding?: boolean;
  className?: string;
  symbolClassName?: string;
  hideDecimals?: boolean;
}

const sizeClasses: Record<string, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg font-semibold",
  xl: "text-xl font-bold",
  "2xl": "text-2xl font-bold font-mono tracking-tight",
};

export function MoneyDisplay({
  amount,
  size = "base",
  showSign = false,
  colorCoding = false,
  className,
  symbolClassName,
  hideDecimals = false,
}: MoneyDisplayProps) {
  const numericValue =
    amount === null || amount === undefined || amount === ""
      ? 0
      : typeof amount === "string"
      ? parseFloat(amount) || 0
      : Number(amount) || 0;

  const isNegative = numericValue < 0;
  const isPositive = numericValue > 0;
  const absValue = Math.abs(numericValue);

  // Format absolute value using Indian Numbering System
  let formatted = formatINR(absValue);

  if (hideDecimals && formatted.endsWith(".00")) {
    formatted = formatted.slice(0, -3);
  }

  // Remove the ₹ symbol from the formatted string to render with custom styling
  const numberPart = formatted.replace("₹", "").trim();

  const colorClass = colorCoding
    ? isPositive
      ? "text-emerald-600 dark:text-emerald-400"
      : isNegative
      ? "text-rose-600 dark:text-rose-400"
      : "text-muted-foreground"
    : "";

  return (
    <span
      className={cn(
        "inline-flex items-baseline whitespace-nowrap font-medium",
        sizeClasses[size] || "text-base",
        colorClass,
        className
      )}
    >
      {isNegative && <span className="mr-0.5 text-inherit">-</span>}
      {showSign && isPositive && <span className="mr-0.5 text-inherit">+</span>}
      <span
        className={cn(
          "font-sans select-none opacity-80 mr-0.5",
          symbolClassName
        )}
      >
        ₹
      </span>
      <span className="font-mono tabular-nums tracking-tight">
        {numberPart}
      </span>
    </span>
  );
}
