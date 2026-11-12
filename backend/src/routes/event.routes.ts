import { Router } from "express";
import { eventController } from "../controllers/event.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/role.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";
import {
  createEventSchema,
  updateEventSchema,
  updateEventStatusSchema,
  eventQuerySchema,
  createEventTaskSchema,
  updateEventTaskSchema,
  createEventScheduleSchema,
  updateEventScheduleSchema,
} from "../validations/event.validation.js";

const router = Router();

// Protect all event routes
router.use(authenticate);

// List events (Admin sees all; Client sees only their own events)
router.get(
  "/",
  validateRequest({ query: eventQuerySchema }),
  (req, res, next) => eventController.getEvents(req, res, next)
);

// Create event (Admin only)
router.post(
  "/",
  requireAdmin,
  validateRequest({ body: createEventSchema }),
  (req, res, next) => eventController.createEvent(req, res, next)
);

// Get single event details (Admin or matching Client owner)
router.get("/:id", (req, res, next) =>
  eventController.getEventById(req, res, next)
);

// Update event details & budget (Admin only)
router.put(
  "/:id",
  requireAdmin,
  validateRequest({ body: updateEventSchema }),
  (req, res, next) => eventController.updateEvent(req, res, next)
);

// Transition event status (Admin only)
router.patch(
  "/:id/status",
  requireAdmin,
  validateRequest({ body: updateEventStatusSchema }),
  (req, res, next) => eventController.updateStatus(req, res, next)
);

// Delete event (Admin only)
router.delete("/:id", requireAdmin, (req, res, next) =>
  eventController.deleteEvent(req, res, next)
);

// Financial summary of event (Admin only)
router.get("/:id/summary", requireAdmin, (req, res, next) =>
  eventController.getEventSummary(req, res, next)
);

// =============================================================================
// OPERATIONAL TASKS ROUTES
// =============================================================================

// List tasks for event (Admin or matching Client owner)
router.get("/:eventId/tasks", (req, res, next) =>
  eventController.getTasks(req, res, next)
);

// Create task for event (Admin only)
router.post(
  "/:eventId/tasks",
  requireAdmin,
  validateRequest({ body: createEventTaskSchema }),
  (req, res, next) => eventController.createTask(req, res, next)
);

// Update task (Admin only)
router.put(
  "/tasks/:taskId",
  requireAdmin,
  validateRequest({ body: updateEventTaskSchema }),
  (req, res, next) => eventController.updateTask(req, res, next)
);

// Delete task (Admin only)
router.delete("/tasks/:taskId", requireAdmin, (req, res, next) =>
  eventController.deleteTask(req, res, next)
);

// =============================================================================
// OPERATIONAL SCHEDULES ROUTES
// =============================================================================

// List schedules for event (Admin or matching Client owner)
router.get("/:eventId/schedules", (req, res, next) =>
  eventController.getSchedules(req, res, next)
);

// Create schedule for event (Admin only)
router.post(
  "/:eventId/schedules",
  requireAdmin,
  validateRequest({ body: createEventScheduleSchema }),
  (req, res, next) => eventController.createSchedule(req, res, next)
);

// Update schedule (Admin only)
router.put(
  "/schedules/:scheduleId",
  requireAdmin,
  validateRequest({ body: updateEventScheduleSchema }),
  (req, res, next) => eventController.updateSchedule(req, res, next)
);

// Delete schedule (Admin only)
router.delete("/schedules/:scheduleId", requireAdmin, (req, res, next) =>
  eventController.deleteSchedule(req, res, next)
);

export default router;
