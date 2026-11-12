import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { validateRequest } from "../middlewares/validate.middleware.js";
import { loginSchema, refreshSchema, activatePortalSchema } from "../validations/auth.validation.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes
router.post(
  "/login",
  validateRequest({ body: loginSchema }),
  (req, res, next) => authController.login(req, res, next)
);

router.post(
  "/refresh",
  validateRequest({ body: refreshSchema }),
  (req, res, next) => authController.refresh(req, res, next)
);

router.post("/logout", (req, res, next) =>
  authController.logout(req, res, next)
);

// Public portal activation endpoint (Client sets password via token)
router.post(
  "/activate-portal",
  validateRequest({ body: activatePortalSchema }),
  (req, res, next) => authController.activatePortal(req, res, next)
);

// Protected routes
router.get("/me", authenticate, (req, res, next) =>
  authController.me(req, res, next)
);

export default router;
