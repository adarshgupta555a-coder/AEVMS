import type { Response } from "express";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: PaginationMeta;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode = 200,
  meta?: PaginationMeta
): Response => {
  const payload: ApiResponse<T> = {
    success: true,
  };

  if (data !== undefined) {
    payload.data = data;
  }

  if (message) {
    payload.message = message;
  }

  if (meta) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
};

export const sendError = (
  res: Response,
  statusCode: number,
  errorCode: string,
  message: string,
  details?: unknown
): Response => {
  const payload: ApiResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      ...(details ? { details } : {}),
    },
  };

  return res.status(statusCode).json(payload);
};
