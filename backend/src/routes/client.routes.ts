import { Router } from "express";
import { clientController } from "../controllers/client.controller.js";
import { calendarController } from "../controllers/calendar.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/role.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";
import {
  createClientSchema,
  updateClientSchema,
  clientQuerySchema,
  linkUserSchema,
  assignPortalSchema,
  updateClientStatusSchema,
  clientHistoryQuerySchema,
} from "../validations/client.validation.js";
import { createCalendarEntrySchema } from "../validations/calendar.validation.js";

const router = Router();

// Protect all client routes
router.use(authenticate);

// List clients (Admin only)
router.get(
  "/",
  requireAdmin,
  validateRequest({ query: clientQuerySchema }),
  (req, res, next) => clientController.getClients(req, res, next)
);

// 1. Create client profile ONLY (Admin only - no user account created)
router.post(
  "/",
  requireAdmin,
  validateRequest({ body: createClientSchema }),
  (req, res, next) => clientController.createClient(req, res, next)
);

// Get single client (Admin or matching Client)
router.get("/:id", (req, res, next) =>
  clientController.getClientById(req, res, next)
);

// Update client (Admin only)
router.put(
  "/:id",
  requireAdmin,
  validateRequest({ body: updateClientSchema }),
  (req, res, next) => clientController.updateClient(req, res, next)
);

// Delete client (Admin only)
router.delete("/:id", requireAdmin, (req, res, next) =>
  clientController.deleteClient(req, res, next)
);

// Link existing client to a user account (Admin only)
router.post(
  "/:id/link-user",
  requireAdmin,
  validateRequest({ body: linkUserSchema }),
  (req, res, next) => clientController.linkUser(req, res, next)
);

// 2. Admin assigns Client Portal to an existing client
router.post(
  "/:id/assign-portal",
  requireAdmin,
  validateRequest({ body: assignPortalSchema }),
  (req, res, next) => clientController.assignPortal(req, res, next)
);

// 3. Admin checks Portal Status
router.get(
  "/:id/portal-status",
  requireAdmin,
  (req, res, next) => clientController.getPortalStatus(req, res, next)
);

// 4. Admin resends invitation to client portal
router.post(
  "/:id/resend-invite",
  requireAdmin,
  validateRequest({ body: assignPortalSchema }),
  (req, res, next) => clientController.resendInvite(req, res, next)
);

// 5. Admin activates or deactivates client portal login access
// Supports both /:id/status and /:clientId/status
router.patch(
  "/:id/status",
  requireAdmin,
  validateRequest({ body: updateClientStatusSchema }),
  (req, res, next) => clientController.updateStatus(req, res, next)
);

// Sub-resource history routes (Admin or matching Client owner)
// Client's event history
router.get(
  "/:id/events",
  validateRequest({ query: clientHistoryQuerySchema }),
  (req, res, next) => clientController.getEvents(req, res, next)
);

// Client's quotations history
router.get(
  "/:id/quotations",
  validateRequest({ query: clientHistoryQuerySchema }),
  (req, res, next) => clientController.getQuotations(req, res, next)
);

// Client's invoices
router.get(
  "/:id/invoices",
  validateRequest({ query: clientHistoryQuerySchema }),
  (req, res, next) => clientController.getInvoices(req, res, next)
);

// Client's payment history
router.get(
  "/:id/payments",
  validateRequest({ query: clientHistoryQuerySchema }),
  (req, res, next) => clientController.getPayments(req, res, next)
);

// Client's activities / meetings / calls (Admin or matching Client owner)
router.get("/:id/activities", (req, res, next) =>
  calendarController.getClientActivities(req, res, next)
);
router.get("/:id/calendar", (req, res, next) =>
  calendarController.getClientActivities(req, res, next)
);

// Admin creates an activity / meeting / call directly for this client
router.post(
  "/:id/activities",
  requireAdmin,
  validateRequest({ body: createCalendarEntrySchema }),
  (req, res, next) => calendarController.createEntry(req, res, next)
);
router.post(
  "/:id/calendar",
  requireAdmin,
  validateRequest({ body: createCalendarEntrySchema }),
  (req, res, next) => calendarController.createEntry(req, res, next)
);

export default router;
