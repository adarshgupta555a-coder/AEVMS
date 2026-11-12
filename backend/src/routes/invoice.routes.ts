import { Router } from "express";
import { invoiceController } from "../controllers/invoice.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/role.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  updateInvoiceStatusSchema,
  invoiceQuerySchema,
} from "../validations/invoice.validation.js";

const router = Router();

// Protect all invoice routes
router.use(authenticate);

// List invoices (Admin sees all; Client sees only their own invoices)
router.get(
  "/",
  validateRequest({ query: invoiceQuerySchema }),
  (req, res, next) => invoiceController.getInvoices(req, res, next)
);

// Create invoice (Admin only)
router.post(
  "/",
  requireAdmin,
  validateRequest({ body: createInvoiceSchema }),
  (req, res, next) => invoiceController.createInvoice(req, res, next)
);

// Get single invoice details (Admin or matching Client owner)
router.get("/:id", (req, res, next) =>
  invoiceController.getInvoiceById(req, res, next)
);

// Get invoice balance summary
router.get("/:id/balance", (req, res, next) =>
  invoiceController.calculateBalance(req, res, next)
);

// Download / stream Invoice PDF (Admin or matching Client owner)
router.get("/:id/pdf", (req, res, next) =>
  invoiceController.downloadInvoicePdf(req, res, next)
);

// Update invoice details and line items (Admin only)
router.put(
  "/:id",
  requireAdmin,
  validateRequest({ body: updateInvoiceSchema }),
  (req, res, next) => invoiceController.updateInvoice(req, res, next)
);

// Transition invoice status (Admin only)
router.patch(
  "/:id/status",
  requireAdmin,
  validateRequest({ body: updateInvoiceStatusSchema }),
  (req, res, next) => invoiceController.updateStatus(req, res, next)
);

// Delete invoice (Admin only)
router.delete("/:id", requireAdmin, (req, res, next) =>
  invoiceController.deleteInvoice(req, res, next)
);

export default router;
