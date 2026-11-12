import type { Request, Response, NextFunction } from "express";
import { USERROLE } from "../generated/prisma/enums.js";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";

export const requireRole = (...allowedRoles: USERROLE[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required before authorization check."));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Role '${req.user.role}' is not authorized to perform this operation.`
        )
      );
    }

    next();
  };
};

export const requireAdmin = requireRole(USERROLE.ADMIN);
