/**
 * proxy.ts — Next.js 16+ auth guard (replaces middleware.ts).
 *
 * Next.js 16.2+ uses "proxy" as the conventional filename for route-level
 * middleware (PROXY_FILENAME = 'proxy' in next/dist/lib/constants.js).
 * Synchronous except for Desk URLs (`/desk/<slug>/…`), which are resolved like Desk's router and served in place.
 *
 * Verified behaviors:
 *   - Unauthenticated → /desk redirects to /login?redirect=/desk
 *   - Unauthenticated → /api/* returns 401 JSON (no redirect loop)
 *   - Authenticated → passes through to the route handler
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveDeskPath } from "@/lib/navigation/deskRoute";
import { deskRegistry } from "@/lib/navigation/deskRegistry";

/**
 * Every /desk URL is a Desk URL (`/desk/sales-order/X`, `/desk/selling`, `/desk/point-of-sale`, `/desk/doctype/Item`)
 * and is served in place: rewritten to the Crema screen that shows it, so the address bar keeps Desk's URL (Desk
 * router.convert_to_standard_route, ported in lib/navigation/deskRoute.ts). Crema's screens live at internal paths
 * (`/desk/doctype/<DocType>/…`, `/desk/workspace/…`, `/desk/page/…`) reached only through that rewrite.
 *
 * Except Crema's own pages, which Desk doesn't name …
 */
const CREMA_PAGES = new Set([
  "connect-claude", "files", "forms", "inbox", "list", "modules", "my-work", "onboarding", "print", "print-format-builder", "profile",
  "query-report", "reports", "settings", "translations", "ui-kit", "update-password", "workflow-builder",
]);
/** … and Crema's versions of a Desk screen, at its bare URL only (`/desk/data-import`; `/desk/data-import/X` is Desk's) */
const CREMA_SCREENS = new Set(["data-import", "dashboard-settings", "module-onboarding", "system-console"]);

async function serveDeskUrl(request: NextRequest): Promise<NextResponse | null> {
  const { pathname, search } = request.nextUrl;
  const m = /^\/desk\/([^/]+)(\/.+)?/.exec(pathname);
  if (!m || CREMA_PAGES.has(m[1]) || (CREMA_SCREENS.has(m[1]) && !m[2]) || request.method !== "GET") return null;
  const cookie = request.headers.get("cookie") ?? "";
  let reg = await deskRegistry(cookie);
  if (!reg) return null;
  let target = resolveDeskPath(pathname, reg, search);
  // not a known doctype / workspace: re-read once in case it was created since (a new DocType, a new workspace)
  if (target.startsWith("/desk/page/")) {
    reg = await deskRegistry(cookie, true);
    if (reg) target = resolveDeskPath(pathname, reg, search);
  }
  return NextResponse.rewrite(new URL(target, request.url));
}

/** Paths that do not require authentication */
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/whoami",
  "/api/auth/logout",
  "/api/boot",
];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sid = request.cookies.get("sid")?.value;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (isPublic) return NextResponse.next();

  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  if (!sid || sid === "Guest") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { message: "Unauthorized", error: "Authentication required" },
        { status: 401 },
      );
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return (await serveDeskUrl(request)) ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
