import { ApiError } from "./api";
export { cn } from "cn";

/**
 * Extracts a standardized error message from an unknown error or ApiResponse envelope
 */
export function extractErrorMessage(
  error: unknown,
  fallbackMessage = "An unexpected error occurred"
): string {
  if (!error) return fallbackMessage;

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof ApiError) {
    return error.message || fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, unknown>;

    if (typeof errObj.message === "string") {
      return errObj.message;
    }

    if (typeof errObj.error === "object" && errObj.error !== null) {
      const nested = errObj.error as Record<string, unknown>;
      if (typeof nested.message === "string") {
        return nested.message;
      }
    }
  }

  return fallbackMessage;
}

/**
 * Extracts a standardized error code from an unknown error or ApiResponse envelope
 */
export function extractErrorCode(
  error: unknown,
  fallbackCode = "UNKNOWN_ERROR"
): string {
  if (!error) return fallbackCode;

  if (error instanceof ApiError) {
    return error.errorCode || error.code || fallbackCode;
  }

  if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, unknown>;

    if (typeof errObj.errorCode === "string") {
      return errObj.errorCode;
    }

    if (typeof errObj.code === "string") {
      return errObj.code;
    }

    if (typeof errObj.error === "object" && errObj.error !== null) {
      const nested = errObj.error as Record<string, unknown>;
      if (typeof nested.code === "string") {
        return nested.code;
      }
    }
  }

  return fallbackCode;
}

/**
 * Extracts form field validation errors from a VALIDATION_ERROR response details array
 */
export function extractFieldErrors(
  error: unknown
): Array<{ field: string; message: string }> {
  if (!error || typeof error !== "object") {
    return [];
  }

  const errObj = error as Record<string, unknown>;
  const details =
    errObj.details || (errObj.error as Record<string, unknown>)?.details;

  if (Array.isArray(details)) {
    return details.filter(
      (item): item is { field: string; message: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof item.field === "string" &&
        typeof item.message === "string"
    );
  }

  return [];
}
