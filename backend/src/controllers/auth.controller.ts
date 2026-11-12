import type { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service.js";
import { setAuthCookies, clearAuthCookies, REFRESH_TOKEN_COOKIE } from "../utils/cookies.js";
import { sendSuccess } from "../utils/response.js";
import { UnauthorizedError } from "../utils/errors.js";

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body);

      // Deliver tokens via secure HttpOnly cookies
      setAuthCookies(res, result.accessToken, result.refreshToken);

      sendSuccess(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
        },
        "Login successful",
        200
      );
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Look for refresh token in cookie first, then body fallback
      const rawToken =
        (req.cookies && req.cookies[REFRESH_TOKEN_COOKIE]) ||
        req.body?.refreshToken;

      if (!rawToken) {
        throw new UnauthorizedError("Refresh token not found in cookies or body.");
      }

      const result = await authService.refresh(rawToken);

      // Rotate cookies with newly minted tokens
      setAuthCookies(res, result.accessToken, result.refreshToken);

      sendSuccess(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
        },
        "Session refreshed successfully",
        200
      );
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawToken =
        (req.cookies && req.cookies[REFRESH_TOKEN_COOKIE]) ||
        req.body?.refreshToken;

      await authService.logout(rawToken);

      // Clear authentication cookies
      clearAuthCookies(res);

      sendSuccess(res, null, "Logged out successfully", 200);
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Not authenticated");
      }

      const user = await authService.getCurrentUser(req.user.id);

      sendSuccess(res, { user }, "User profile retrieved", 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Public Client Portal Activation endpoint:
   * Client accepts invitation, sets their password, and receives active login session
   */
  async activatePortal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.activatePortal(req.body);

      // Set authentication cookies for immediate login
      setAuthCookies(res, result.accessToken, result.refreshToken);

      sendSuccess(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
        },
        "Portal account activated successfully! You are now logged in.",
        200
      );
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
