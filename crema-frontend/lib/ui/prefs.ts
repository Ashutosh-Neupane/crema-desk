/**
 * Per-user UI preferences for phase 2 (docs/GAPS.md § 3.2 / 3.6): the "New layout" switch and the density.
 *
 * Source of truth is Frappe's own per-user storage, the same one Desk uses for list settings
 * (frappe/public/js/frappe/model/user_settings.js → frappe.model.utils.user_settings.get / save), under the
 * key "Crema UI". A localStorage copy per user (`crema:ui-prefs:<user>`) makes the first paint right and keeps
 * tabs in sync; the server copy follows the user to other browsers.
 *
 * Framework-free on purpose: the React hooks live in ./newLayout.ts.
 */
import { frappeMethod } from "@/lib/frappe/client";

export type Density = "comfortable" | "compact";

export interface UiPrefs {
  newLayout: boolean;
  density: Density;
}

export const DEFAULT_UI_PREFS: UiPrefs = Object.freeze({ newLayout: false, density: "comfortable" }) as UiPrefs;

/** the `doctype` key under which the prefs live in __UserSettings */
export const UI_SETTINGS_KEY = "Crema UI";

const STORAGE_PREFIX = "crema:ui-prefs:";

/** Frappe sets a readable `user_id` cookie at login (Guest when logged out) */
export function currentUser(): string {
  if (typeof document === "undefined") return "Guest";
  const m = document.cookie.match(/(?:^|;\s*)user_id=([^;]*)/);
  try {
    return (m && decodeURIComponent(m[1])) || "Guest";
  } catch {
    return "Guest";
  }
}

export const storageKey = (user = currentUser()) => `${STORAGE_PREFIX}${user}`;

export function normalizePrefs(raw: unknown): UiPrefs {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    newLayout: o.newLayout === true || o.newLayout === 1,
    density: o.density === "compact" ? "compact" : "comfortable",
  };
}

// ---- snapshot (stable object while the stored string is unchanged, as useSyncExternalStore requires) ----
let cachedRaw: string | null | undefined;
let cachedUser: string | undefined;
let cachedPrefs: UiPrefs = DEFAULT_UI_PREFS;

export function readPrefs(): UiPrefs {
  if (typeof window === "undefined") return DEFAULT_UI_PREFS;
  const user = currentUser();
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(storageKey(user));
  } catch {
    raw = null;
  }
  if (raw === cachedRaw && user === cachedUser) return cachedPrefs;
  cachedRaw = raw;
  cachedUser = user;
  try {
    cachedPrefs = raw ? normalizePrefs(JSON.parse(raw)) : DEFAULT_UI_PREFS;
  } catch {
    cachedPrefs = DEFAULT_UI_PREFS;
  }
  return cachedPrefs;
}

// ---- subscribers ----
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener);
  // another tab changed the prefs
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(STORAGE_PREFIX)) {
      applyPrefsToDocument(readPrefs());
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** `<html data-layout="new|classic" data-density="comfortable|compact">` — the CSS tokens key off these */
export function applyPrefsToDocument(p: UiPrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-layout", p.newLayout ? "new" : "classic");
  root.setAttribute("data-density", p.density);
}

function writeLocal(p: UiPrefs) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(p));
  } catch {
    /* private mode / quota: the in-memory snapshot below still updates */
  }
  cachedRaw = JSON.stringify(p);
  cachedUser = currentUser();
  cachedPrefs = p;
  applyPrefsToDocument(p);
  emit();
}

// ---- server sync ----
/** users whose server copy was already fetched in this page session */
const loadedFor = new Set<string>();
/** a local change made before the server copy arrived wins over it */
let changedLocally = false;

export async function loadServerPrefs(): Promise<void> {
  const user = currentUser();
  if (user === "Guest" || loadedFor.has(user)) return;
  loadedFor.add(user);
  try {
    const message = await frappeMethod<unknown>("frappe.model.utils.user_settings.get", { doctype: UI_SETTINGS_KEY });
    const parsed: unknown = typeof message === "string" ? JSON.parse(message || "{}") : null;
    // nothing saved yet (null / "{}"): keep the local copy
    if (changedLocally || !parsed || typeof parsed !== "object" || !("newLayout" in parsed || "density" in parsed)) return;
    const next = normalizePrefs(parsed);
    const cur = readPrefs();
    if (next.newLayout !== cur.newLayout || next.density !== cur.density) writeLocal(next);
  } catch {
    loadedFor.delete(user); // retry on the next mount
  }
}

export function updatePrefs(patch: Partial<UiPrefs>): void {
  if (typeof window === "undefined") return;
  const next = normalizePrefs({ ...readPrefs(), ...patch });
  changedLocally = true;
  writeLocal(next);
  if (currentUser() === "Guest") return;
  // user_settings.save shallow-merges the posted keys into the stored object
  void frappeMethod("frappe.model.utils.user_settings.save", { doctype: UI_SETTINGS_KEY, user_settings: JSON.stringify(next) }).catch(() => undefined);
}

/**
 * Inline script for `<head>` that sets the html attributes before React hydrates (no flash of the wrong
 * density). Optional: the module import below does the same as soon as the client bundle runs.
 */
export const UI_PREFS_BOOT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)user_id=([^;]*)/);var u=(m&&decodeURIComponent(m[1]))||"Guest";var p=JSON.parse(localStorage.getItem("${STORAGE_PREFIX}"+u)||"{}");var r=document.documentElement;r.setAttribute("data-layout",p.newLayout===true?"new":"classic");r.setAttribute("data-density",p.density==="compact"?"compact":"comfortable");}catch(e){}})();`;

if (typeof window !== "undefined") applyPrefsToDocument(readPrefs());
