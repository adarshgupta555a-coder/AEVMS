import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { sendSuccess } from "../utils/response.js";

const router = Router();

router.get("/health", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return sendSuccess(
      res,
      {
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: "connected",
      },
      "EMS Backend API is running and database is healthy"
    );
  } catch (error) {
    next(error);
  }
});

export default router;
