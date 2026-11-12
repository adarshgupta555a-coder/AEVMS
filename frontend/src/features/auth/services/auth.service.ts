import { apiClient } from "@/lib/api";
import { AuthUser } from "@/stores/auth-store";
import { LoginInput, ActivatePortalInput } from "../schemas/auth.schema";

export const authService = {
  /**
   * Authenticate user with email and password
   */
  async login(
    payload: LoginInput
  ): Promise<{ user: AuthUser; accessToken: string }> {
    const res = await apiClient<{ user: AuthUser; accessToken: string }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    if (!res.data) {
      throw new Error(res.message || "Login failed");
    }

    return res.data;
  },

  /**
   * Terminate active session and clear server-side cookies
   */
  async logout(): Promise<void> {
    await apiClient<null>("/auth/logout", {
      method: "POST",
    });
  },

  /**
   * Fetch current authenticated user profile
   */
  async getCurrentUser(): Promise<{ user: AuthUser }> {
    const res = await apiClient<{ user: AuthUser }>("/auth/me", {
      method: "GET",
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to fetch user");
    }

    return res.data;
  },

  /**
   * Activate client portal using token and set initial password
   */
  async activatePortal(
    payload: ActivatePortalInput
  ): Promise<{ user: AuthUser; accessToken: string }> {
    const res = await apiClient<{ user: AuthUser; accessToken: string }>(
      "/auth/activate-portal",
      {
        method: "POST",
        body: JSON.stringify({
          token: payload.token,
          password: payload.password,
        }),
      }
    );

    if (!res.data) {
      throw new Error(res.message || "Failed to activate portal account");
    }

    return res.data;
  },
};
