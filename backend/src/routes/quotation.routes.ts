import { Router } from "express";
import { quotationController } from "../controllers/quotation.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/role.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";
import {
  createQuotationSchema,
  updateQuotationSchema,
  updateQuotationStatusSchema,
  quotationQuerySchema,
  convertToEventSchema,
} from "../validations/quotation.validation.js";

const router = Router();

// Protect all quotation routes
router.use(authenticate);

// List quotations (Admin sees all; Client sees only their own quotations)
router.get(
  "/",
  validateRequest({ query: quotationQuerySchema }),
  (req, res, next) => quotationController.getQuotations(req, res, next)
);

// Create quotation (Admin only)
router.post(
  "/",
  requireAdmin,
  validateRequest({ body: createQuotationSchema }),
  (req, res, next) => quotationController.createQuotation(req, res, next)
);

// Get single quotation details (Admin or matching Client owner)
router.get("/:id", (req, res, next) =>
  quotationController.getQuotationById(req, res, next)
);

// Update quotation details and line items (Admin only)
router.put(
  "/:id",
  requireAdmin,
  validateRequest({ body: updateQuotationSchema }),
  (req, res, next) => quotationController.updateQuotation(req, res, next)
);

// Transition quotation status (Admin: all allowed; Client: ACCEPT or REJECT)
router.patch(
  "/:id/status",
  validateRequest({ body: updateQuotationStatusSchema }),
  (req, res, next) => quotationController.updateStatus(req, res, next)
);

// Convert quotation to Event (Admin only)
router.post(
  "/:id/convert-to-event",
  requireAdmin,
  validateRequest({ body: convertToEventSchema }),
  (req, res, next) => quotationController.convertToEvent(req, res, next)
);

// Delete quotation (Admin only)
router.delete("/:id", requireAdmin, (req, res, next) =>
  quotationController.deleteQuotation(req, res, next)
);

export default router;
