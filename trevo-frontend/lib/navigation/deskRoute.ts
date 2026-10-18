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

/** Any Desk route: records as above, everything else is a Desk Page (native or via the legacy host) */
export function deskRouteToUrl(route: string[], options?: Record<string, unknown> | null): string | null {
  const parts = route.filter((p) => p !== undefined && p !== null && p !== "");
  if (!parts.length) return "/desk";
  return trevoUrlForRoute(parts, options) ?? withQuery(`/desk/page/${parts.map(enc).join("/")}`, options);
}
