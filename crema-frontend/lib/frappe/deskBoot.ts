/**
 * Desk boot payload (server-only).
 *
 * Frappe v16 has no whitelisted method that returns the desk boot; Desk itself
 * receives it inlined in the `/desk` HTML as `frappe.boot = {...};`. We fetch
 * that page with the caller's session and parse the object out, so Crema sees
 * exactly what Desk sees: `module_sidebars`, `app_data`, `sysdefaults`,
 * `user` (roles, can_read/can_create/...), `setup_complete`, number/date
 * formats, etc. — instead of re-deriving them from several REST calls.
 *
 * Cached per session id for a short time; the page is ~400 KB to generate.
 */
import { FRAPPE_BACKEND_URL, backendFetch, parseCsrfFromHtml, rememberCsrfToken, sidFromCookie } from "./server";

export interface SidebarItem {
  key: string;
  label: string;
  type: "Link" | "Section Break" | string;
  link_type?: "DocType" | "Report" | "Workspace" | "Dashboard" | "Page" | "URL" | null;
  link_to?: string | null;
  url?: string | null;
  icon?: string | null;
  child?: 0 | 1;
  collapsible?: 0 | 1;
  keep_closed?: 0 | 1;
  filters?: string | null;
  route_options?: string | null;
  open_in_new_tab?: 0 | 1;
}

export interface ModuleSidebar {
  name: string;
  module: string;
  label: string;
  app: string;
  header_icon?: string | null;
  workspaces?: string[];
  items: SidebarItem[];
}

export interface AppData {
  app_name: string;
  app_title?: string;
  app_route?: string;
  app_logo_url?: string;
  dock?: Array<{ link_type: string; link_to: string; url?: string | null; icon?: string | null; title: string }>;
  [key: string]: unknown;
}

export interface DeskBoot {
  module_sidebars?: Record<string, ModuleSidebar>;
  app_data?: AppData[];
  home_shell?: string;
  setup_complete?: boolean | 0 | 1;
  sysdefaults?: Record<string, unknown>;
  user?: Record<string, unknown>;
  [key: string]: unknown;
}

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; boot: DeskBoot }>();

/** Extract the `frappe.boot = {...}` object literal from the desk HTML. */
export function parseBootFromHtml(html: string): DeskBoot | null {
  const marker = "frappe.boot = ";
  const start = html.indexOf(marker);
  if (start === -1) return null;
  let i = start + marker.length;
  if (html[i] !== "{") return null;

  // Walk to the matching closing brace, respecting JSON strings.
  let depth = 0;
  let inStr = false;
  for (; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) break;
  }
  try {
    return JSON.parse(html.slice(start + marker.length, i + 1)) as DeskBoot;
  } catch {
    return null;
  }
}

/** Drop a session's cached boot so the next read re-fetches /desk (Desk: `frappe.sessions.clear` then reload). */
export function clearDeskBootCache(sid?: string): void {
  if (sid) cache.delete(sid);
  else cache.clear();
}

export async function getDeskBoot(cookieHeader: string): Promise<DeskBoot | null> {
  const sid = sidFromCookie(cookieHeader);
  if (!sid) return null;

  const hit = cache.get(sid);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.boot;

  let res: Response;
  try {
    res = await backendFetch(`${FRAPPE_BACKEND_URL}/desk`, {
      headers: { Cookie: cookieHeader, Accept: "text/html" },
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const html = await res.text();
  const csrf = parseCsrfFromHtml(html);
  if (csrf) rememberCsrfToken(sid, csrf);
  const boot = parseBootFromHtml(html);
  if (boot) {
    cache.set(sid, { at: Date.now(), boot });
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  }
  return boot;
}
