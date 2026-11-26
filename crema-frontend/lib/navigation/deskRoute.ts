/**
 * Desk route arrays (frappe.set_route / frappe.get_route) and Desk URL paths.
 *
 * Two kinds of URL: the public ones are Desk's own (lib/navigation/deskUrl.ts), and every link uses them; the
 * internal ones are the Crema screens that show them (`/desk/doctype/<DocType>/…`, `/desk/workspace/<name>`,
 * `/desk/page/<page>`), reached only through proxy.ts, which rewrites a Desk URL with resolveDeskPath.
 * `options` are Desk's frappe.route_options; they become ?field=value, which lists read as filters and new
 * forms apply as initial values (DocForm route options).
 */
import { deskSlug, docUrl, doctypeUrl, newDocUrl, reportUrl, workspaceUrl } from "./deskUrl";

export { deskSlug } from "./deskUrl";

const enc = encodeURIComponent;

function withQuery(url: string, options?: Record<string, unknown> | null): string {
  if (!options || typeof options !== "object") return url;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(options)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  const s = q.toString();
  return s ? `${url}${url.includes("?") ? "&" : "?"}${s}` : url;
}

const VIEWS = ["report", "calendar", "gantt", "kanban", "image", "tree"];

/** Record/list/report routes as Desk URLs; null for anything else (pages, unknown) */
export function cremaUrlForRoute(route: string[], options?: Record<string, unknown> | null): string | null {
  const [kind, a, b, c] = route;
  let url: string | null = null;
  if (kind === "Form" && a) url = b ? docUrl(a, b) : newDocUrl(a);
  else if (kind === "List" && a) {
    const view = (b ?? "").toLowerCase();
    url = VIEWS.includes(view) ? doctypeUrl(a, view, c) : doctypeUrl(a);
  } else if (kind === "Tree" && a) url = doctypeUrl(a, "tree");
  else if (kind === "query-report" && a) url = reportUrl(a);
  else if (kind === "Workspaces" && a) url = workspaceUrl(a);
  else if ((kind === "print-format-builder-beta" || kind === "print-format-builder") && a)
    url = `/desk/print-format-builder/${enc(a)}${kind === "print-format-builder" ? "?ui=classic" : ""}`;
  return url && withQuery(url, options);
}

/** The Crema screen (internal path) for a standard route; what proxy.ts rewrites a Desk URL to */
function internalUrlForRoute(route: string[], options?: Record<string, unknown> | null): string | null {
  const [kind, a, b] = route;
  let url: string | null = null;
  if (kind === "Form" && a) url = b ? `/desk/doctype/${enc(a)}/${enc(b)}` : `/desk/doctype/${enc(a)}/new`;
  else if (kind === "List" && a) {
    const view = (b ?? "").toLowerCase();
    url = `/desk/doctype/${enc(a)}${VIEWS.includes(view) ? `/view/${view}` : ""}`;
  } else if (kind === "Tree" && a) url = `/desk/doctype/${enc(a)}/view/tree`;
  else if (kind === "query-report" && a) url = `/desk/query-report/${enc(a)}`;
  else if (kind === "Workspaces" && a) url = `/desk/workspace/${enc(a)}`;
  // Print Format "Edit Format" (print_format.js): Crema's full-screen builder host
  else if ((kind === "print-format-builder-beta" || kind === "print-format-builder") && a)
    url = `/desk/print-format-builder/${enc(a)}${kind === "print-format-builder" ? "?ui=classic" : ""}`;
  return url && withQuery(url, options);
}

/**
 * Any Desk route: records as above; anything else (a slug like "sales-invoice", a workspace, a Desk Page)
 * goes to `/desk/<parts>`, which the server resolves from the boot (app/(desk)/desk/[slug]) like Desk's router.
 */
export function deskRouteToUrl(route: string[], options?: Record<string, unknown> | null): string | null {
  const parts = route.filter((p) => p !== undefined && p !== null && p !== "");
  if (!parts.length) return "/desk";
  return cremaUrlForRoute(parts, options) ?? withQuery(`/desk/${parts.map(enc).join("/")}`, options);
}

/** Desk's frappe.router.shell_slug: "Shift & Attendance" → "shift-and-attendance" */
export const shellSlug = (name: string) => name.toLowerCase().replace(/&/g, " and ").trim().replace(/\s+/g, "-");

/** What a Desk URL can name, from the boot (Desk router.setup / desk.setup_workspaces) */
export interface DeskRouteRegistry {
  /** boot.user.can_read */
  doctypes: string[];
  /** boot.workspaces.pages[].name */
  workspaces: string[];
  /** keys of boot.module_sidebars */
  shells: string[];
}

const PRIVATE_WS = /^(.*)-([^\s@-]+@[^\s@]+)$/;
const STANDARD = new Set(["List", "Form", "Tree", "query-report", "Workspaces"]);

/**
 * A Desk URL path (`/desk/<shell>/<slug>/...` or `/app/...`) → Crema URL, resolved like Desk's
 * router.convert_to_standard_route: optional shell prefix, then workspace slug, then doctype slug
 * (`x` list, `x/view/report`, `x/new`, `x/<name>`), standard routes (`List/User`), else a Desk Page.
 */
export function resolveDeskPath(path: string, reg: DeskRouteRegistry, search = ""): string {
  const segs = path
    .replace(/^\/?(app|desk)(\/|$)/, "")
    .split("/")
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
  const q = search && !search.startsWith("?") ? `?${search}` : search;
  if (!segs.length) return `/desk${q}`;
  const workspaces = new Map(reg.workspaces.map((w) => [deskSlug(w), w]));
  const doctypes = new Map(reg.doctypes.map((d) => [deskSlug(d), d]));
  const shells = new Set(reg.shells.map(shellSlug));
  const names = (s: string) => workspaces.has(s) || doctypes.has(s) || STANDARD.has(s);
  // `/desk/stock/item` = Item in the Stock shell; the shell only comes off when what follows names something
  if (segs.length > 1 && shells.has(segs[0]) && names(segs[1])) segs.shift();
  const [first, ...rest] = segs;
  const enc = encodeURIComponent;
  // /desk/private/<title>: one of this user's private workspaces (named `<title>-<email>`), spelled by its title
  if (first === "private" && rest[0]) {
    const mine = reg.workspaces.find((w) => PRIVATE_WS.test(w) && deskSlug(w.replace(PRIVATE_WS, "$1")) === rest[0]);
    if (mine) return `/desk/workspace/${enc(mine)}${q}`;
  }
  // Desk's dashboard page (/desk/dashboard-view/<name>) is Crema's dashboard screen
  if (first === "dashboard-view" && rest[0]) return `/desk/dashboard/${enc(rest[0])}${q}`;
  const ws = workspaces.get(first);
  if (ws) return `/desk/workspace/${enc(ws)}${q}`;
  const dt = doctypes.get(first);
  if (dt) {
    if (rest[0] === "view" && rest[1]) return `${internalUrlForRoute(["List", dt, rest[1]])}${rest[2] ? `/${enc(rest.slice(2).join("/"))}` : ""}${q}`;
    if (rest[0] === "new") return `/desk/doctype/${enc(dt)}/new${q}`;
    if (rest.length) return `/desk/doctype/${enc(dt)}/${enc(rest.join("/"))}${q}`;
    return `/desk/doctype/${enc(dt)}${q}`;
  }
  if (STANDARD.has(first)) return `${internalUrlForRoute(segs) ?? "/desk"}${q}`;
  return `/desk/page/${segs.map(enc).join("/")}${q}`;
}
