/**
 * Pass-through proxy to the Frappe backend (server-only). Used by /api/frappe/* (Crema's client) and by
 * /api/method/* + /api/resource/* (Frappe's own Desk pages framed at /app/*, which call their origin).
 * Forwards cookies, the caller's CSRF token (if it sent one), the original body + content type, and returns
 * the response bytes with Set-Cookie / Content-Disposition intact.
 */
import { NextResponse, type NextRequest } from "next/server";
import { FRAPPE_BACKEND_URL, backendFetch, sidFromCookie } from "@/lib/frappe/server";
import { clearDeskBootCache } from "@/lib/frappe/deskBoot";

// What the Desk boot is built from (readable doctypes, workspaces, sidebars, permissions). Desk builds a fresh boot
// on every page load; Crema caches it briefly, so a save to one of these drops the session's cached boot and a new
// DocType, role or workspace shows at once.
const BOOT_SOURCES = [
  "DocType", "Customize Form", "Custom Field", "Property Setter", "DocPerm", "Custom DocPerm", "Role", "Has Role",
  "User", "User Permission", "Module Def", "Workspace", "Workspace Sidebar", "Desktop Icon", "Page", "Report",
  "Navbar Settings", "System Settings", "Role Profile", "Module Profile",
];
const BOOT_SOURCE_RE = new RegExp(`"(?:doctype|doc_type)"\\s*:\\s*"(?:${BOOT_SOURCES.join("|")})"|/api/resource/(?:${BOOT_SOURCES.map(encodeURIComponent).join("|")})(?:/|$)|frappe\\.permissions|permission_manager|frappe\\.desk\\.doctype\\.workspace`);

// Frappe also POSTs reads (frappe.client.get_list …); only calls that write count
const WRITE_RE = /\/api\/resource\/|\.(?:insert|insert_many|save|savedocs|set_value|delete|delete_doc|rename_doc|submit|cancel|bulk_update|save_customization|reset_to_defaults|add|remove|update|new_page|save_page|update_page)(?:$|[?/])/;

function touchesBoot(path: string, body: ArrayBuffer | undefined): boolean {
  if (!WRITE_RE.test(`/${path}`)) return false;
  if (BOOT_SOURCE_RE.test(`/${path}`)) return true;
  if (!body || body.byteLength > 2_000_000) return false;
  const text = new TextDecoder().decode(body);
  if (BOOT_SOURCE_RE.test(text)) return true;
  try {
    return BOOT_SOURCE_RE.test(decodeURIComponent(text.replace(/\+/g, " ")));
  } catch {
    return false;
  }
}

export async function proxyToBackend(req: NextRequest, method: string, backendPath: string): Promise<NextResponse> {
  const url = new URL(`${FRAPPE_BACKEND_URL}/${backendPath.replace(/^\//, "")}`);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.append(k, v));

  const headers: Record<string, string> = {
    Accept: req.headers.get("accept") ?? "application/json",
    // a framed Desk page sends its real token; Crema's own client lets backendFetch add the session token
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
  if (method !== "GET" && res.ok && touchesBoot(backendPath, init.body as ArrayBuffer | undefined)) {
    clearDeskBootCache(sidFromCookie(req.headers.get("cookie") ?? "") ?? undefined);
  }
  return new NextResponse(await res.arrayBuffer(), { status: res.status, headers: out });
}

type Ctx = { params: Promise<{ path: string[] }> };
/** Route handlers for a Next catch-all mounted at `prefix` (e.g. "api/method") */
export function proxyHandlers(prefix: string) {
  const handle = (method: string) => async (req: NextRequest, ctx: Ctx) => proxyToBackend(req, method, [prefix, ...(await ctx.params).path].filter(Boolean).join("/"));
  return { GET: handle("GET"), POST: handle("POST"), PUT: handle("PUT"), DELETE: handle("DELETE") };
}
