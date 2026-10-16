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
}

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
  };
  return NextResponse.json(ctx, { headers: { "Cache-Control": "private, max-age=60" } });
}
