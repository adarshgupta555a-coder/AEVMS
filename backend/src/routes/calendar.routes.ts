import { Router } from "express";
import { calendarController } from "../controllers/calendar.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/role.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";
import {
  createCalendarEntrySchema,
  updateCalendarEntrySchema,
  calendarQuerySchema,
} from "../validations/calendar.validation.js";

const router = Router();

// Protect all calendar routes
router.use(authenticate);

// List calendar entries with filters (Admin: all, Client: own)
router.get(
  "/",
  validateRequest({ query: calendarQuerySchema }),
  (req, res, next) => calendarController.getEntries(req, res, next)
);

// Create calendar entry / activity (Admin only)
router.post(
  "/",
  requireAdmin,
  validateRequest({ body: createCalendarEntrySchema }),
  (req, res, next) => calendarController.createEntry(req, res, next)
);

// Get single calendar entry (Admin or matching Client owner)
router.get("/:id", (req, res, next) =>
  calendarController.getEntryById(req, res, next)
);

// Update calendar entry (Admin only)
router.put(
  "/:id",
  requireAdmin,
  validateRequest({ body: updateCalendarEntrySchema }),
  (req, res, next) => calendarController.updateEntry(req, res, next)
);

// Delete calendar entry (Admin only)
router.delete("/:id", requireAdmin, (req, res, next) =>
  calendarController.deleteEntry(req, res, next)
);

export default router;
