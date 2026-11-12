import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { verifyAccessToken } from "../utils/jwt.js";
import { UnauthorizedError } from "../utils/errors.js";
import { prisma } from "../lib/prisma.js";
import { ACCESS_TOKEN_COOKIE } from "../utils/cookies.js";

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // 1. Check HttpOnly cookie
    if (req.cookies && req.cookies[ACCESS_TOKEN_COOKIE]) {
      token = req.cookies[ACCESS_TOKEN_COOKIE];
    }

    // 2. Fallback to Authorization Header (Bearer <token>)
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        token = parts[1];
      }
    }

    if (!token) {
      throw new UnauthorizedError("Authentication token is missing. Please log in.");
    }

    // 3. Verify token signature and expiry
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError("Access token has expired. Please refresh your session.");
      }
      throw new UnauthorizedError("Invalid authentication token.");
    }

    // 4. Validate user in database
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        clientId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError("Authenticated user account no longer exists.");
    }

    if (!user.isActive) {
      throw new UnauthorizedError("User account has been deactivated. Please contact support.");
    }

    // 5. Attach authenticated user to request context
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      clientId: user.clientId,
    };

    next();
  } catch (error) {
    next(error);
  }
};
