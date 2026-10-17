/**
 * Pass-through proxy to the Frappe backend (server-only). Used by /api/frappe/* (Trevo's client) and by
 * /api/method/* + /api/resource/* (Frappe's own Desk pages framed at /app/*, which call their origin).
 * Forwards cookies, the caller's CSRF token (if it sent one), the original body + content type, and returns
 * the response bytes with Set-Cookie / Content-Disposition intact.
 */
import { NextResponse, type NextRequest } from "next/server";
import { FRAPPE_BACKEND_URL, backendFetch } from "@/lib/frappe/server";

export async function proxyToBackend(req: NextRequest, method: string, backendPath: string): Promise<NextResponse> {
  const url = new URL(`${FRAPPE_BACKEND_URL}/${backendPath.replace(/^\//, "")}`);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.append(k, v));

  const headers: Record<string, string> = {
    Accept: req.headers.get("accept") ?? "application/json",
    // a framed Desk page sends its real token; Trevo's own client lets backendFetch add the session token
    "X-Frappe-CSRF-Token": req.headers.get("x-frappe-csrf-token") ?? "fetch",
  };
  const cookie = req.headers.get("cookie");
  if (cookie) headers.Cookie = cookie;
  const xrw = req.headers.get("x-requested-with");
  if (xrw) headers["X-Requested-With"] = xrw;

  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    const body = await req.arrayBuffer();
    if (body.byteLength) {
      init.body = body;
      headers["Content-Type"] = req.headers.get("content-type") ?? "application/json";
    }
  }

  let res: Response;
  try {
    res = await backendFetch(url.toString(), init);
  } catch {
    return NextResponse.json({ error: "Cannot reach Frappe backend" }, { status: 502 });
  }

  const out = new Headers();
  for (const sc of res.headers.getSetCookie?.() ?? []) out.append("Set-Cookie", sc);
  out.set("Content-Type", res.headers.get("content-type") ?? "application/json");
  for (const h of ["content-disposition", "cache-control"]) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  return new NextResponse(await res.arrayBuffer(), { status: res.status, headers: out });
}

type Ctx = { params: Promise<{ path: string[] }> };
/** Route handlers for a Next catch-all mounted at `prefix` (e.g. "api/method") */
export function proxyHandlers(prefix: string) {
  const handle = (method: string) => async (req: NextRequest, ctx: Ctx) => proxyToBackend(req, method, [prefix, ...(await ctx.params).path].filter(Boolean).join("/"));
  return { GET: handle("GET"), POST: handle("POST"), PUT: handle("PUT"), DELETE: handle("DELETE") };
}
