import { ApiResponse } from "@/types/api.types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly status: number;
  public readonly errorCode: string;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    errorCode = "INTERNAL_SERVER_ERROR",
    details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.status = statusCode;
    this.errorCode = errorCode;
    this.code = errorCode;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ApiClientOptions extends RequestInit {
  _retry?: boolean;
  responseType?: "json" | "blob";
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });
  failedQueue = [];
};

function resolveUrl(endpoint: string): string {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  const cleanBase = API_BASE_URL.replace(/\/+$/, "");
  const cleanEndpoint = endpoint.replace(/^\/+/, "");
  return `${cleanBase}/${cleanEndpoint}`;
}

export async function apiClient<T>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<ApiResponse<T>> {
  const url = resolveUrl(endpoint);

  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const config: RequestInit = {
    ...options,
    credentials: "include", // Transmit HttpOnly cookies on every request
    headers,
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    throw new ApiError(
      networkError instanceof Error
        ? networkError.message
        : "Network connection failed",
      0,
      "NETWORK_ERROR"
    );
  }

  // Intercept 401 Unauthorized for token refresh
  const isAuthEndpoint =
    endpoint.includes("/auth/login") ||
    endpoint.includes("/auth/refresh") ||
    endpoint.includes("/auth/activate-portal");

  if (response.status === 401 && !isAuthEndpoint && !options._retry) {
    if (isRefreshing) {
      try {
        await new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
        return apiClient<T>(endpoint, { ...options, _retry: true });
      } catch (err) {
        throw err;
      }
    }

    isRefreshing = true;

    try {
      const refreshUrl = resolveUrl("/auth/refresh");
      const refreshResponse = await fetch(refreshUrl, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!refreshResponse.ok) {
        throw new Error("Refresh token expired or invalid");
      }

      const refreshData = await refreshResponse.json().catch(() => null);
      if (refreshData && refreshData.success === false) {
        throw new Error(refreshData.error?.message || "Refresh failed");
      }

      processQueue(null);
      return apiClient<T>(endpoint, { ...options, _retry: true });
    } catch (refreshErr) {
      processQueue(refreshErr);

      if (typeof window !== "undefined") {
        const currentPath = window.location.pathname;
        if (!currentPath.startsWith("/login")) {
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/login?session_expired=true";
        }
      }

      throw new ApiError(
        "Session expired. Please log in again.",
        401,
        "UNAUTHORIZED",
        refreshErr
      );
    } finally {
      isRefreshing = false;
    }
  }

  // Handle binary PDF responses directly
  const contentType = response.headers.get("content-type") || "";
  if (
    contentType.includes("application/pdf") ||
    options.responseType === "blob"
  ) {
    if (!response.ok) {
      throw new ApiError(
        `Failed to fetch binary asset: ${response.statusText}`,
        response.status,
        "PDF_FETCH_ERROR"
      );
    }

    const blob = await response.blob();
    // Return hybrid payload: valid Blob that also satisfies ApiResponse<T>
    return Object.assign(blob, {
      success: true,
      data: blob as unknown as T,
    }) as unknown as ApiResponse<T>;
  }

  // Parse JSON response envelope
  let json: ApiResponse<T>;
  try {
    json = await response.json();
  } catch {
    json = {
      success: false,
      error: {
        code: "INVALID_JSON",
        message: response.statusText || "Server returned a non-JSON response",
      },
    };
  }

  if (!response.ok || !json.success) {
    const errorCode =
      json.error?.code ||
      (response.status === 404
        ? "NOT_FOUND"
        : response.status === 403
          ? "FORBIDDEN"
          : response.status === 401
            ? "UNAUTHORIZED"
            : "API_ERROR");

    const errorMessage =
      json.error?.message ||
      json.message ||
      response.statusText ||
      "An unexpected API error occurred";

    throw new ApiError(
      errorMessage,
      response.status,
      errorCode,
      json.error?.details
    );
  }

  return json;
}
