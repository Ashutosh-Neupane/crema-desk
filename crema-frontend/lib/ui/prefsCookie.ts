/**
 * The `crema_ui` cookie: a copy of the user's UI prefs (New layout, density) that the server can read, so the first
 * HTML already has the chosen layout and nothing jumps after hydration (docs/PHASE2_DESIGN.md § 6.3).
 *
 * The prefs themselves live in Frappe user_settings with a localStorage cache (./prefs.ts); this cookie only mirrors
 * them. It names the user it belongs to, so another account signing in on the same browser starts from the defaults
 * until its own prefs load.
 *
 *   crema_ui=<user>~<1|0 new layout>~<c compact | r comfortable>
 *
 * Framework-free: imported by the root layout (server) and by ./prefs.ts (browser).
 */
import type { UiPrefs } from "./prefs";

export const UI_COOKIE = "crema_ui";
const MAX_AGE = 60 * 60 * 24 * 365;

export function encodeUiCookie(user: string, p: UiPrefs): string {
  return `${encodeURIComponent(user)}~${p.newLayout ? 1 : 0}~${p.density === "compact" ? "c" : "r"}`;
}

/** the prefs in the cookie when it belongs to `user`, else null */
export function parseUiCookie(value: string | undefined, user: string | undefined): UiPrefs | null {
  if (!value || !user) return null;
  const [who, layout, density] = value.split("~");
  let owner = who;
  try {
    owner = decodeURIComponent(who ?? "");
  } catch {
    return null;
  }
  let me = user;
  try {
    me = decodeURIComponent(user);
  } catch {
    /* keep raw */
  }
  if (owner !== me || (layout !== "0" && layout !== "1")) return null;
  return { newLayout: layout === "1", density: density === "c" ? "compact" : "comfortable" };
}

/** browser only: write the cookie when it differs from what is there */
export function writeUiCookie(user: string, p: UiPrefs): void {
  if (typeof document === "undefined" || user === "Guest") return;
  const value = encodeUiCookie(user, p);
  if (document.cookie.includes(`${UI_COOKIE}=${value}`)) return;
  document.cookie = `${UI_COOKIE}=${value}; path=/; max-age=${MAX_AGE}; samesite=lax`;
}
