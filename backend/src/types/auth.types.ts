import type { USERROLE } from "../generated/prisma/enums.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: USERROLE;
  clientId: string | null;
}

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: USERROLE;
  clientId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
