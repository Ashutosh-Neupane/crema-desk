/**
 * Generic BFF proxy: /api/frappe/* → Frappe backend.
 *
 * Forwards the caller's `sid` cookie and all query params / body.
 * Re-emits Set-Cookie headers from Frappe (for login session propagation).
 * This is the single point through which all client-side Frappe calls flow,
 * avoiding CORS issues and keeping localhost:8080 invisible to the browser.
 */

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { FRAPPE_BACKEND_URL, backendFetch } from "@/lib/frappe/server";

const BACKEND = FRAPPE_BACKEND_URL;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(req, "GET", params);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(req, "POST", params);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(req, "PUT", params);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(req, "DELETE", params);
}

async function proxyRequest(
  req: NextRequest,
  method: string,
  paramsPromise: Promise<{ path: string[] }>,
) {
  const { path } = await paramsPromise;
  const frappePath = path.join("/"); // e.g. "resource/ToDo" or "method/frappe.client.get_count"

  const url = new URL(`${BACKEND}/${frappePath}`);

  // Forward query params
  req.nextUrl.searchParams.forEach((v, k) => {
    url.searchParams.set(k, v);
  });

  // Build headers — forward cookies + content type
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Frappe-CSRF-Token": "fetch",
  };

  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) headers["Cookie"] = cookieHeader;

  const contentType = req.headers.get("content-type");
  const fetchOpts: RequestInit = { method, headers };

  // Forward body for POST/PUT
  if (method === "POST" || method === "PUT") {
    if (contentType?.includes("multipart/form-data")) {
      // Pass through raw body for file uploads
      const body = await req.arrayBuffer();
      fetchOpts.body = body;
      if (contentType) headers["Content-Type"] = contentType;
    } else {
      // JSON body
      const body = await req.text();
      if (body) {
        fetchOpts.body = body;
        headers["Content-Type"] = "application/json";
      }
    }
  }

  let res: Response;
  try {
    res = await backendFetch(url.toString(), fetchOpts);
  } catch {
    return NextResponse.json(
      { error: "Cannot reach Frappe backend" },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();

  // Forward Set-Cookie (critical for login session propagation)
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const sc of setCookies) {
    responseHeaders.append("Set-Cookie", sc);
  }

  // Pass the body through as bytes — downloads (xlsx, pdf, attachments) must not be re-encoded as text
  const body = await res.arrayBuffer();
  responseHeaders.set("Content-Type", res.headers.get("content-type") ?? "application/json");
  for (const h of ["content-disposition", "cache-control"]) {
    const v = res.headers.get(h);
    if (v) responseHeaders.set(h, v);
  }

  return new NextResponse(body, {
    status: res.status,
    headers: responseHeaders,
  });
}
