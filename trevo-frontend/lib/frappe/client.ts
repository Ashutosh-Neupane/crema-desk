/**
 * Client-side Frappe HTTP client (browser).
 *
 * ALL requests go through our BFF proxy: /api/frappe/* → Frappe.
 * This avoids CORS, handles cookie forwarding on the server, and keeps the
 * browser from ever calling localhost:8000 directly.
 *
 * CSRF is NOT enforced for cookie-auth on this backend (verified).
 */

import type { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import axios from "axios";
import type { FrappeAPIResponse, FrappeLoginResponse } from "./types";

// ---------------------------------------------------------------------------
// Axios instance — baseURL points to our BFF proxy
// ---------------------------------------------------------------------------

const client: AxiosInstance = axios.create({
  baseURL: "/api/frappe",
  withCredentials: true,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// ---------------------------------------------------------------------------
// Interceptors
// ---------------------------------------------------------------------------

client.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    // 401/403 → redirect to login
    if (err.response && (err.response.status === 401 || err.response.status === 403)) {
      const url = err.config?.url ?? "";
      // Don't redirect if the failing call IS a whoami check
      if (!url.includes("frappe.auth.get_logged_user") && !url.includes("auth/whoami")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);

// ---------------------------------------------------------------------------
// Raw passthrough helpers
// ---------------------------------------------------------------------------

/** Generic request — unwraps Frappe envelope { message | data }. */
async function request<T>(
  config: AxiosRequestConfig,
): Promise<T> {
  try {
    const res = await client.request<FrappeAPIResponse<T>>(config);
    const payload = res.data;
    // Frappe may wrap in { message } (methods) or { data } (REST resource)
    return (payload?.message ?? payload?.data ?? (payload as unknown as T)) as T;
  } catch (err: unknown) {
    const axErr = err as AxiosError<{ exc?: string; _server_messages?: string; exception?: string }>;
    const msg =
      axErr?.response?.data?.exception ??
      axErr?.response?.data?.exc ??
      axErr?.message ??
      "Request failed";
    throw new Error(typeof msg === "string" ? msg : "Request failed");
  }
}

// ---------------------------------------------------------------------------
// Method / Resource helpers
// ---------------------------------------------------------------------------

/** Call a Frappe whitelisted method: POST /api/method/:method */
export async function frappeMethod<T>(
  method: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return request<T>({
    method: "POST",
    url: `/api/method/${method}`,
    data: args ?? {},
  });
}

/** GET a Frappe resource: /api/resource/:doctype (list) or /api/resource/:doctype/:name (single) */
export async function frappeGet<T>(
  resourcePath: string,
  params?: Record<string, unknown>,
): Promise<T> {
  return request<T>({
    method: "GET",
    url: `/api/resource/${resourcePath}`,
    params,
  });
}

/** POST create a Frappe resource: /api/resource/:doctype */
export async function frappePost<T>(
  resourcePath: string,
  data?: Record<string, unknown>,
): Promise<T> {
  return request<T>({
    method: "POST",
    url: `/api/resource/${resourcePath}`,
    data,
  });
}

/** PUT update a Frappe resource: /api/resource/:doctype/:name */
export async function frappePut<T>(
  resourcePath: string,
  data?: Record<string, unknown>,
): Promise<T> {
  return request<T>({
    method: "PUT",
    url: `/api/resource/${resourcePath}`,
    data,
  });
}

/** DELETE a Frappe resource: /api/resource/:doctype/:name */
export async function frappeDelete<T>(
  resourcePath: string,
): Promise<T> {
  return request<T>({
    method: "DELETE",
    url: `/api/resource/${resourcePath}`,
  });
}

// ---------------------------------------------------------------------------
// Auth (client calls go through BFF)
// ---------------------------------------------------------------------------

export async function clientLogin(email: string, password: string): Promise<FrappeLoginResponse> {
  const res = await axios.post<FrappeLoginResponse>(
    "/api/auth/login",
    { email, password },
    { withCredentials: true, headers: { "Content-Type": "application/json" } },
  );
  return res.data;
}

export async function clientLogout(): Promise<void> {
  await axios.post("/api/auth/logout", null, { withCredentials: true });
}

export async function clientWhoAmI<T = string>(): Promise<T | null> {
  try {
    const res = await axios.get<{ message?: string; user?: string | null } | null>("/api/auth/whoami", {
      withCredentials: true,
    });
    const d = res.data;
    if (!d) return null;
    if (d.user === null || d.message === null) return null;
    return (d.message ?? d.user ?? null) as T;
  } catch {
    return null;
  }
}

/** Alias kept for external imports like `frappeWhoAmI<FrappeUser>()` */
export { clientWhoAmI as frappeWhoAmI };

export async function clientBoot(): Promise<unknown> {
  try {
    const res = await axios.get("/api/boot", { withCredentials: true });
    return res.data;
  } catch {
    return null;
  }
}

export { client as frappeClient };

/** Backwards compat — some old code references this */
export function getFrappeBaseUrl(): string {
  return process.env.NEXT_PUBLIC_FRAPPE_BASE_URL ?? "http://localhost:8000";
}
