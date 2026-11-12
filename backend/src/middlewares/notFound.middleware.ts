import type { Request, Response } from "express";
import { sendError } from "../utils/response.js";

export const notFoundHandler = (req: Request, res: Response): Response => {
  return sendError(
    res,
    404,
    "ROUTE_NOT_FOUND",
    `Cannot ${req.method} ${req.originalUrl}`
  );
};
