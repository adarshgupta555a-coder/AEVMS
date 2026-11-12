import type { Request } from "express";
import { USERROLE } from "../generated/prisma/enums.js";
import { ForbiddenError, UnauthorizedError } from "./errors.js";

/**
 * Asserts that the authenticated request actor has permission to access or mutate
 * resources belonging to the specified targetClientId.
 *
 * - Admin users have universal access.
 * - Client users can ONLY access records where req.user.clientId === targetClientId.
 */
export const assertClientOwnership = (
  req: Request,
  targetClientId: string | null | undefined
): void => {
  if (!req.user) {
    throw new UnauthorizedError("Authentication required.");
  }

  // Admin has global operational access
  if (req.user.role === USERROLE.ADMIN) {
    return;
  }

  // Client user must have a linked clientId that exactly matches the target
  if (req.user.role === USERROLE.CLIENT) {
    if (!req.user.clientId || req.user.clientId !== targetClientId) {
      throw new ForbiddenError(
        "Access denied. You do not have permission to access or modify records of another client."
      );
    }
    return;
  }

  throw new ForbiddenError("Role is not authorized to access this resource.");
};
