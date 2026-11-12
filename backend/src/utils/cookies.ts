import type { Response } from "express";
import { env } from "../config/env.js";

const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
): void => {
  const isProduction = env.NODE_ENV === "production";

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: ACCESS_TOKEN_MAX_AGE,
    path: "/",
  });

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: "/",
  });
};

export const clearAuthCookies = (res: Response): void => {
  const isProduction = env.NODE_ENV === "production";

  res.clearCookie(ACCESS_TOKEN_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });

  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });
};

export { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE };
