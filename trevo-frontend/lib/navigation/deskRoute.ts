/**
 * Desk route arrays (frappe.set_route / frappe.get_route) → Trevo URLs.
 * `options` are Desk's frappe.route_options; they become ?field=value, which lists read as filters and new
 * forms apply as initial values (DocForm route options).
 */
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

/** Record/list/report routes only; null for anything else (pages, unknown) */
export function trevoUrlForRoute(route: string[], options?: Record<string, unknown> | null): string | null {
  const [kind, a, b] = route;
  let url: string | null = null;
  if (kind === "Form" && a) url = b ? `/desk/doctype/${enc(a)}/${enc(b)}` : `/desk/doctype/${enc(a)}/new`;
  else if (kind === "List" && a) {
    const view = (b ?? "").toLowerCase();
    url = `/desk/doctype/${enc(a)}${["report", "calendar", "gantt", "kanban", "image", "tree"].includes(view) ? `/view/${view}` : ""}`;
  } else if (kind === "Tree" && a) url = `/desk/doctype/${enc(a)}/view/tree`;
  else if (kind === "query-report" && a) url = `/desk/query-report/${enc(a)}`;
  else if (kind === "Workspaces" && a) url = `/desk/workspace/${enc(a)}`;
  return url && withQuery(url, options);
}

/**
 * Any Desk route: records as above; anything else (a slug like "sales-invoice", a workspace, a Desk Page)
 * goes to `/desk/<parts>`, which the server resolves from the boot (app/(desk)/desk/[slug]) like Desk's router.
 */
export function deskRouteToUrl(route: string[], options?: Record<string, unknown> | null): string | null {
  const parts = route.filter((p) => p !== undefined && p !== null && p !== "");
  if (!parts.length) return "/desk";
  return trevoUrlForRoute(parts, options) ?? withQuery(`/desk/${parts.map(enc).join("/")}`, options);
}

/** Desk's frappe.router.slug: "Sales Invoice" → "sales-invoice" */
export const deskSlug = (name: string) => name.toLowerCase().replace(/ /g, "-");
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

const STANDARD = new Set(["List", "Form", "Tree", "query-report", "Workspaces"]);

/**
 * A Desk URL path (`/desk/<shell>/<slug>/...` or `/app/...`) → Trevo URL, resolved like Desk's
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
  const ws = workspaces.get(first);
  if (ws) return `/desk/workspace/${enc(ws)}${q}`;
  const dt = doctypes.get(first);
  if (dt) {
    if (rest[0] === "view" && rest[1]) return `${trevoUrlForRoute(["List", dt, rest[1]])}${q}`;
    if (rest[0] === "new") return `/desk/doctype/${enc(dt)}/new${q}`;
    if (rest.length) return `/desk/doctype/${enc(dt)}/${enc(rest.join("/"))}${q}`;
    return `/desk/doctype/${enc(dt)}${q}`;
  }
  if (STANDARD.has(first)) return `${trevoUrlForRoute(segs) ?? "/desk"}${q}`;
  return `/desk/page/${segs.map(enc).join("/")}${q}`;
}
