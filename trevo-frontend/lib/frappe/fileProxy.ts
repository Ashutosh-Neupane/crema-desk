/** Serve Frappe files (/files/*, /private/files/*) and built assets (/assets/*) from Trevo's origin. */
import { NextResponse, type NextRequest } from "next/server";
import { FRAPPE_BACKEND_URL, FRAPPE_SITE_NAME, backendFetch } from "@/lib/frappe/server";

/**
 * Frappe serves public /files through StaticDataMiddleware, which picks the site from the Host
 * header (not X-Frappe-Site-Name). On a local bench reach it as http://<site>:<port> — *.localhost
 * resolves to loopback — so the right site's files are found.
 */
function fileOrigin(): string {
  try {
    const u = new URL(FRAPPE_BACKEND_URL);
    if (FRAPPE_SITE_NAME && ["localhost", "127.0.0.1"].includes(u.hostname) && FRAPPE_SITE_NAME.endsWith(".localhost")) u.hostname = FRAPPE_SITE_NAME;
    return u.origin;
  } catch {
    return FRAPPE_BACKEND_URL;
  }
}

export async function proxyFile(req: NextRequest, prefix: "/files" | "/private/files" | "/assets", parts: string[]) {
  const path = `${prefix}/${parts.map(encodeURIComponent).join("/")}`;
  const res = await backendFetch(`${fileOrigin()}${path}`, {
    headers: { cookie: req.headers.get("cookie") ?? "" },
    redirect: "manual",
  });
  if (!res.ok) return new NextResponse(null, { status: res.status === 403 ? 403 : res.status });
  const headers = new Headers();
  for (const h of ["content-type", "content-disposition", "last-modified", "etag"]) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  // public files can be cached briefly; private files stay per-session
  // built assets are content-hashed; public files can be cached briefly; private files stay per-session
  headers.set("cache-control", prefix === "/assets" ? "public, max-age=86400" : prefix === "/files" ? "public, max-age=300" : "private, no-store");
  return new NextResponse(res.body, { status: 200, headers });
}
