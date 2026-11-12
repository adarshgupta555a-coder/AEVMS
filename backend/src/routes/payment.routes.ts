import { Router } from "express";
import { paymentController } from "../controllers/payment.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/role.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";
import {
  createPaymentSchema,
  paymentQuerySchema,
  createRazorpayOrderSchema,
  verifyRazorpayPaymentSchema,
} from "../validations/payment.validation.js";

const router = Router();

// Protect all payment routes
router.use(authenticate);

// List payments (Admin sees all; Client sees only their own payments)
router.get(
  "/",
  validateRequest({ query: paymentQuerySchema }),
  (req, res, next) => paymentController.getPayments(req, res, next)
);

// Record payment with allocations (Admin only)
router.post(
  "/",
  requireAdmin,
  validateRequest({ body: createPaymentSchema }),
  (req, res, next) => paymentController.recordPayment(req, res, next)
);

// Razorpay Online Gateway: Create Order (Admin or Client owner)
router.post(
  "/razorpay/create-order",
  validateRequest({ body: createRazorpayOrderSchema }),
  (req, res, next) => paymentController.createRazorpayOrder(req, res, next)
);

// Razorpay Online Gateway: Verify Signature & Auto-Settle Payment (Admin or Client owner)
router.post(
  "/razorpay/verify",
  validateRequest({ body: verifyRazorpayPaymentSchema }),
  (req, res, next) => paymentController.verifyRazorpayPayment(req, res, next)
);

// Get single payment details (Admin or matching Client owner)
router.get("/:id", (req, res, next) =>
  paymentController.getPaymentById(req, res, next)
);

// Delete payment and recompute affected invoice statuses (Admin only)
router.delete("/:id", requireAdmin, (req, res, next) =>
  paymentController.deletePayment(req, res, next)
);

export default router;
