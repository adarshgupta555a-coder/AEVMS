import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import type { JwtAccessPayload } from "../types/auth.types.js";

export const generateAccessToken = (payload: JwtAccessPayload): string => {
  const options: jwt.SignOptions = {
    expiresIn: "15m",
  };

  return jwt.sign(
    {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      clientId: payload.clientId,
    },
    env.JWT_ACCESS_SECRET,
    options
  );
};

export const verifyAccessToken = (token: string): JwtAccessPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
};

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(40).toString("hex");
};

export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const getRefreshTokenExpiryDate = (): Date => {
  const days = 7;
  const expiryTime = Date.now() + days * 24 * 60 * 60 * 1000;
  return new Date(expiryTime);
};
