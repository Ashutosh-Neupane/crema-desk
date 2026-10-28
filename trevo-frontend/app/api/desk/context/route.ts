/**
 * GET /api/desk/context → what forms need from the desk boot: session user,
 * user/global defaults (company, currency, …), system formats.
 */
import { NextResponse } from "next/server";
import { getCookieHeader } from "@/lib/frappe/server";
import { getDeskBoot } from "@/lib/frappe/deskBoot";

export interface DeskContext {
  user: string;
  full_name: string;
  defaults: Record<string, unknown>;
  sysdefaults: Record<string, unknown>;
  roles: string[];
  /** permission lists from boot.user (can_create, in_create, …) for app scripts */
  perms: Record<string, string[]>;
  developer_mode: boolean;
  /** boot.user.impersonated_by — the user who started this impersonated session (site_banners.js) */
  impersonated_by: string | null;
  /** the rest of frappe.boot (party_account_types, current_fiscal_year, …) for app JS */
  boot: Record<string, unknown>;
  /** boot.docs Desk keeps in locals for formatting (":Currency" symbol/number_format, ":Company" default_currency) */
  docs: Record<string, Record<string, Record<string, unknown>>>;
}

// large or Desk-shell-only keys that app JS never reads
const HEAVY_BOOT_KEYS = new Set(["module_sidebars", "user", "docs", "allowed_reports", "workspaces", "canonical_shell", "assets_json", "print_css", "desktop_icon_urls", "app_data", "dock", "page_info", "__messages"]);

export async function GET() {
  const boot = await getDeskBoot(await getCookieHeader());
  const user = (boot?.user ?? {}) as Record<string, unknown>;
  const ctx: DeskContext = {
    user: String(user.name ?? ""),
    full_name: String(user.full_name ?? user.name ?? ""),
    defaults: (user.defaults as Record<string, unknown>) ?? {},
    sysdefaults: (boot?.sysdefaults as Record<string, unknown>) ?? {},
    roles: Array.isArray(user.roles) ? (user.roles as string[]) : [],
    perms: Object.fromEntries(
      ["can_create", "can_read", "can_write", "can_submit", "can_cancel", "can_delete", "can_print", "can_email", "can_export", "can_import", "in_create", "can_get_report", "can_search"]
        .filter((k) => Array.isArray(user[k]))
        .map((k) => [k, user[k] as string[]]),
    ),
    developer_mode: !!boot?.developer_mode,
    impersonated_by: (user.impersonated_by as string | null | undefined) || null,
    boot: Object.fromEntries(Object.entries((boot ?? {}) as Record<string, unknown>).filter(([k]) => !HEAVY_BOOT_KEYS.has(k))),
    docs: {},
  };
  for (const d of (Array.isArray(boot?.docs) ? boot.docs : []) as Array<Record<string, unknown>>) {
    const dt = String(d.doctype ?? "").replace(/^:/, "");
    if (dt !== "Currency" && dt !== "Company") continue;
    (ctx.docs[dt] ??= {})[String(d.name)] = d;
  }
  return NextResponse.json(ctx, { headers: { "Cache-Control": "private, no-store" } });
}
