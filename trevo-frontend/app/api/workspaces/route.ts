/**
 * GET /api/workspaces → { pages } — the workspaces this user can see.
 * v16 ships them in the desk boot (`boot.workspaces.pages`, same shape the
 * removed v15 `get_workspace_sidebar_items` returned); fall back to that
 * method on older benches.
 */
import { NextResponse } from "next/server";
import { frappeServerFetch, getCookieHeader } from "@/lib/frappe/server";
import { getDeskBoot } from "@/lib/frappe/deskBoot";
import type { WorkspaceSidebarItem } from "@/lib/frappe/types";

export async function GET() {
  const cookie = await getCookieHeader();
  const boot = await getDeskBoot(cookie);
  let pages = (boot?.workspaces as { pages?: WorkspaceSidebarItem[] } | undefined)?.pages;
  if (!pages) {
    try {
      const { data } = await frappeServerFetch<{ pages: WorkspaceSidebarItem[] }>(
        cookie,
        "api/method/frappe.desk.desktop.get_workspace_sidebar_items",
      );
      pages = data?.pages ?? [];
    } catch {
      pages = [];
    }
  }
  return NextResponse.json({ pages: pages.filter((p) => !(p.is_hidden === true || p.is_hidden === 1)) });
}
