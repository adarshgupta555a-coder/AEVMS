import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { sendError } from "../utils/response.js";
import { env } from "../config/env.js";
import { Prisma } from "../lib/prisma.js";

export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response | void => {
  // If response headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return _next(error);
  }

  // 1. Handled Domain AppError subclasses
  if (error instanceof AppError) {
    return sendError(
      res,
      error.statusCode,
      error.errorCode,
      error.message,
      error.details
    );
  }

  // 2. Handled Zod Validation Errors
  if (error instanceof ZodError) {
    const formattedIssues = error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    return sendError(
      res,
      422,
      "VALIDATION_ERROR",
      "Request validation failed",
      formattedIssues
    );
  }

  // 3. Handled Prisma Database Errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        const target = (error.meta?.target as string[]) || ["field"];
        return sendError(
          res,
          409,
          "UNIQUE_CONSTRAINT_VIOLATION",
          `A record with this ${target.join(", ")} already exists.`,
          { fields: target }
        );
      }
      case "P2025": {
        return sendError(
          res,
          404,
          "RECORD_NOT_FOUND",
          (error.meta?.cause as string) || "Record not found."
        );
      }
      case "P2003": {
        return sendError(
          res,
          400,
          "FOREIGN_KEY_CONSTRAINT_FAILED",
          "Referenced parent record does not exist or deletion is restricted."
        );
      }
      default:
        console.error(`[Prisma Database Error ${error.code}]:`, error);
        return sendError(
          res,
          500,
          "DATABASE_ERROR",
          env.NODE_ENV === "production"
            ? "A database operation error occurred."
            : error.message
        );
    }
  }

  // 4. Fallback: Unexpected Internal Server Error
  console.error("[Unhandled Server Error]:", error);

  return sendError(
    res,
    500,
    "INTERNAL_SERVER_ERROR",
    env.NODE_ENV === "production"
      ? "An unexpected internal server error occurred."
      : error.message
  );
};
