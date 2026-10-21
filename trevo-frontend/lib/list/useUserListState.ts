"use client";

/**
 * Per-user list state — Desk frappe/public/js/frappe/model/user_settings.js + list_view.js:
 *   frappe.model.utils.user_settings.get   → JSON of { List: { filters, sort_by, sort_order, filter_conditions }, last_view, group_by_fields, … }
 *   frappe.model.utils.user_settings.save  → shallow-merges the posted top-level keys into the stored object
 * list_view.js setup_defaults: sort_by / sort_order / filters are read from user_settings[view_name];
 * before_render saves { filters, sort_by, sort_order } under the view key (view_name "List") and
 * `last_view` at the top level. (Desk does not persist the page length.)
 */
import { deskCall } from "@/lib/frappe/form";
import type { Filter } from "@/lib/list/api";

export interface ListViewState {
  filters?: Filter[];
  sort_by?: string;
  sort_order?: string;
  [k: string]: unknown;
}
export type UserSettings = { List?: ListViewState; last_view?: string; [k: string]: unknown };

export const userSettingsKey = (doctype: string) => ["user-settings", doctype] as const;

export async function loadUserSettings(doctype: string): Promise<UserSettings> {
  try {
    const { env } = await deskCall("frappe.model.utils.user_settings.get", { doctype }, { get: true });
    const s = typeof env.message === "string" ? JSON.parse(env.message) : (env.message ?? {});
    return s && typeof s === "object" ? (s as UserSettings) : {};
  } catch {
    return {};
  }
}

/** frappe.model.user_settings.save(doctype, "List", value) + last_view; returns the merged settings */
export async function saveListState(doctype: string, current: UserSettings, value: ListViewState): Promise<UserSettings> {
  const next: UserSettings = { ...current, List: { ...(current.List ?? {}), ...value }, last_view: "List" };
  if (JSON.stringify(next) === JSON.stringify(current)) return current;
  await deskCall("frappe.model.utils.user_settings.save", { doctype, user_settings: JSON.stringify({ List: next.List, last_view: "List" }) });
  return next;
}
