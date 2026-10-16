/**
 * Server-side Frappe client.
 *
 * Used by:
 *  - RSC pages (app/(desk)/.../page.tsx) for SSR data fetching
 *  - route handlers (app/api/...) for the BFF proxy
 *
 * It talks DIRECTLY to Frappe at FRAPPE_BACKEND_URL, forwarding the caller's
 * `sid` session cookie. CSRF is NOT enforced for cookie-auth REST/method calls
 * on this backend (verified), so no token plumbing is required. We still send
 * `X-Frappe-CSRF-Token: fetch` defensively.
 */

import type { FrappeAPIResponse } from "./types";

const BACKEND_URL =
  process.env.FRAPPE_BACKEND_URL ??
  process.env.NEXT_PUBLIC_FRAPPE_BASE_URL ??
  "http://localhost:8000";

export const FRAPPE_BACKEND_URL = BACKEND_URL;

/**
 * Frappe picks the site from the Host header, which is wrong when we call it
 * as e.g. localhost:8001. When set, every server-side call names the site
 * explicitly via X-Frappe-Site-Name (also what multi-tenant benches need).
 */
export const FRAPPE_SITE_NAME = process.env.FRAPPE_SITE_NAME || "";

/** Headers every server-side request to Frappe must carry. */
export function backendHeaders(): Record<string, string> {
  return FRAPPE_SITE_NAME ? { "X-Frappe-Site-Name": FRAPPE_SITE_NAME } : {};
}

/** `fetch` for Frappe backend URLs — adds the site header. Use instead of bare fetch in BFF routes. */
export function backendFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(backendHeaders())) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return fetch(input, { ...init, headers });
}

export class FrappeError extends Error {
  status: number;
  excType?: string;
  serverMessages: string[];
  constructor(message: string, opts: { status?: number; excType?: string; serverMessages?: string[] } = {}) {
    super(message);
    this.name = "FrappeError";
    this.status = opts.status ?? 500;
    this.excType = opts.excType;
    this.serverMessages = opts.serverMessages ?? [];
  }
}

export interface ServerFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** query params (values may be primitives, arrays, or objects — objects get JSON.stringified) */
  params?: Record<string, string | number | boolean | undefined | null | object>;
  /** JSON body */
  body?: unknown;
  /** raw body string (e.g. multipart) — overrides `body` */
  rawBody?: BodyInit;
  /** content type for raw body */
  contentType?: string;
  /** extra headers */
  headers?: Record<string, string>;
  /** treat non-2xx as error (default true). If false, returns parsed payload. */
  throwOnError?: boolean;
}

interface ResolvedFetch<T> {
  data: T | null;
  status: number;
  ok: boolean;
  setCookies: string[];
  envelope: FrappeAPIResponse<T> | null;
}

/**
 * Low-level fetch to Frappe from the server.
 * @param cookieHeader the incoming request's Cookie header (must contain `sid`)
 * @param path path under Frappe root, e.g. "api/resource/ToDo" or "api/method/frappe.client.get_count"
 */
export async function frappeServerFetch<T = unknown>(
  cookieHeader: string,
  path: string,
  opts: ServerFetchOptions = {},
): Promise<ResolvedFetch<T>> {
  const { method = "GET", params, body, rawBody, contentType, headers = {}, throwOnError = true } = opts;

  const url = new URL(`${BACKEND_URL}/${path.replace(/^\//, "")}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      // Frappe wants arrays/objects as JSON strings
      const value = typeof v === "object" ? JSON.stringify(v) : String(v);
      url.searchParams.set(k, value);
    }
  }

  const reqHeaders: Record<string, string> = {
    Accept: "application/json",
    "X-Frappe-CSRF-Token": "fetch",
    ...headers,
  };

  let reqBody: BodyInit | undefined;
  if (rawBody !== undefined) {
    reqBody = rawBody;
    if (contentType) reqHeaders["Content-Type"] = contentType;
  } else if (body !== undefined) {
    reqBody = JSON.stringify(body);
    reqHeaders["Content-Type"] = "application/json";
  }

  if (cookieHeader) {
    reqHeaders["Cookie"] = cookieHeader;
  }

  let res: Response;
  try {
    res = await backendFetch(url.toString(), {
      method,
      headers: reqHeaders,
      body: reqBody,
      cache: "no-store",
    });
  } catch {
    throw new FrappeError(`Cannot reach Frappe backend at ${BACKEND_URL}`, { status: 502 });
  }

  const setCookies = res.headers.getSetCookie?.() ?? [];
  const text = await res.text();
  let envelope: FrappeAPIResponse<T> | null = null;
  try {
    envelope = text ? (JSON.parse(text) as FrappeAPIResponse<T>) : null;
  } catch {
    envelope = null;
  }

  if (!res.ok && throwOnError) {
    const msg =
      (envelope && typeof envelope.exc === "string"
        ? envelope.exc.split("\n").filter(Boolean).slice(-1)[0] ?? envelope.exc
        : null) ||
      (envelope as { exception?: string })?.exception ||
      `Frappe request failed (${res.status})`;
    throw new FrappeError(typeof msg === "string" ? msg : "Frappe error", {
      status: res.status,
      excType: (envelope as { exc_type?: string })?.exc_type,
      serverMessages: parseServerMessagesSafe(envelope?._server_messages),
    });
  }

  // Unwrap envelope: REST uses { data }, methods use { message }
  const data = (envelope?.message ?? envelope?.data ?? (envelope as unknown as T)) ?? null;

  return { data, status: res.status, ok: res.ok, setCookies, envelope };
}

function parseServerMessagesSafe(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((m) => {
      try {
        const obj = typeof m === "string" ? JSON.parse(m) : m;
        return obj?.message ?? null;
      } catch {
        return String(m);
      }
    }).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

/** Convenience: read the cookie header from next/headers cookies() (async in Next 15+). */
export async function getCookieHeader(): Promise<string> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  return jar.toString();
}
