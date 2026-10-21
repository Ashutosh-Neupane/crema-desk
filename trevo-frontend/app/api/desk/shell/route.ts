/**
 * GET  /api/desk/shell → shell bits of frappe.boot that Desk puts in its navbar:
 *   navbar_settings (settings_dropdown / help_dropdown rows), setup_complete, app_data.
 * The boot (parsed from /desk HTML, cached 30 s per sid) already carries it verbatim.
 *
 * POST /api/desk/shell {action: "clear-cache"} → the client half of Desk's "Reload"
 * (frappe.ui.toolbar.clear_cache): clear the server's boot cache; the caller
 * drops its react-query caches and reloads.
 */
import { NextResponse } from "next/server";
import { getCookieHeader, sidFromCookie } from "@/lib/frappe/server";
import { clearDeskBootCache, getDeskBoot } from "@/lib/frappe/deskBoot";

export async function GET() {
  const boot = await getDeskBoot(await getCookieHeader());
  if (!boot) return NextResponse.json(null, { status: 401 });
  return NextResponse.json(
    {
      navbar_settings: boot.navbar_settings ?? null,
      setup_complete: boot.setup_complete ?? null,
      // Navbar-row conditions are JS over frappe.boot (eval: frappe.boot.sysdefaults…)
      sysdefaults: boot.sysdefaults ?? null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const { action } = (await request.json().catch(() => ({}))) as { action?: string };
  if (action === "clear-cache") {
    clearDeskBootCache(sidFromCookie(await getCookieHeader()) ?? undefined);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
