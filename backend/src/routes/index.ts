import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import clientRoutes from "./client.routes.js";
import calendarRoutes from "./calendar.routes.js";
import eventRoutes from "./event.routes.js";
import quotationRoutes from "./quotation.routes.js";
import invoiceRoutes from "./invoice.routes.js";
import paymentRoutes from "./payment.routes.js";
import inventoryRoutes from "./inventory.routes.js";

const router = Router();

router.use(healthRoutes);
router.use("/auth", authRoutes);
router.use("/clients", clientRoutes);
router.use("/admin/clients", clientRoutes);
router.use("/calendar", calendarRoutes);
router.use("/events", eventRoutes);
router.use("/quotations", quotationRoutes);
router.use("/invoices", invoiceRoutes);
router.use("/payments", paymentRoutes);
router.use("/inventory", inventoryRoutes);

export default router;
