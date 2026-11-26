/**
 * Pass a request Crema doesn't route itself straight through to the Frappe site.
 *
 * Frappe serves more than Desk from the same host: other apps' own frontends registered with `website_route_rules`
 * (ERPNext's `/banking`, CRM's `/crm`, Helpdesk's `/helpdesk`, LMS, HRMS), the apps screen (`/apps`), portal and
 * website pages, web forms and `/api/v2`. Desk links to them as plain URLs (sidebar_item.js: link_type "URL" →
 * `<a href>`), so in Crema the same paths must reach Frappe: method, body, cookie and CSRF header go through
 * unchanged, the response streams back, and redirects to the backend's own origin stay on Crema's.
 */
import { NextResponse, type NextRequest } from "next/server";
import { backendFetch } from "@/lib/frappe/server";
import { fileOrigin } from "@/lib/frappe/fileProxy";

const REQUEST_HEADERS = ["cookie", "accept", "accept-language", "content-type", "x-frappe-csrf-token", "x-requested-with", "if-none-match", "if-modified-since", "range"];
// hop-by-hop or rewritten by fetch (the body arrives decoded, so its length / encoding no longer apply)
const DROP_RESPONSE_HEADERS = new Set(["connection", "keep-alive", "transfer-encoding", "content-encoding", "content-length", "upgrade"]);

export async function passThrough(req: NextRequest, parts: string[]): Promise<NextResponse> {
  const origin = fileOrigin();
  const target = new URL(`${origin}/${parts.map(encodeURIComponent).join("/")}`);
  target.search = req.nextUrl.search;

  const headers = new Headers();
  for (const h of REQUEST_HEADERS) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  const method = req.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();
  const res = await backendFetch(target, { method, headers, body, redirect: "manual" });

  const out = new Headers();
  res.headers.forEach((v, k) => {
    if (DROP_RESPONSE_HEADERS.has(k) || k === "set-cookie") return;
    out.set(k, v);
  });
  for (const c of res.headers.getSetCookie?.() ?? []) out.append("set-cookie", c);
  const location = res.headers.get("location");
  if (location) {
    // keep the user on Crema: an absolute redirect to the backend becomes a path on this origin
    try {
      const loc = new URL(location, origin);
      if (loc.origin === origin || loc.origin === new URL(req.url).origin) out.set("location", `${loc.pathname}${loc.search}${loc.hash}`);
    } catch {
      /* leave a malformed Location as Frappe sent it */
    }
  }
  return new NextResponse(method === "HEAD" ? null : res.body, { status: res.status, statusText: res.statusText, headers: out });
}
