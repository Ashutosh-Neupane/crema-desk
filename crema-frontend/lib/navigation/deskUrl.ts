/**
 * Desk's URLs, so every link Crema writes is the URL Desk would show (Desk router.make_url / slug,
 * frappe/public/js/frappe/router.js; utils.generate_route). proxy.ts serves them in place.
 *
 *   doctypeUrl("Sales Order")                  /desk/sales-order
 *   doctypeUrl("Sales Order", "report")        /desk/sales-order/view/report
 *   docUrl("Sales Order", "SAL-ORD-0001")      /desk/sales-order/SAL-ORD-0001
 *   newDocUrl("Sales Order")                   /desk/sales-order/new
 *   workspaceUrl("Selling")                    /desk/selling
 *   workspaceUrl("Mine-jane@x.com")            /desk/private/mine
 *   pageUrl("point-of-sale")                   /desk/point-of-sale
 *   dashboardUrl("Accounts")                   /desk/dashboard-view/Accounts
 */
const enc = encodeURIComponent;

/** Desk's frappe.router.slug: "Sales Invoice" → "sales-invoice" */
export const deskSlug = (name: string) => name.toLowerCase().replace(/ /g, "-");

/** A doctype's list, or one of its views (report, kanban, calendar, gantt, image, tree) with an optional view name */
export function doctypeUrl(doctype: string, view?: string, viewName?: string): string {
  const base = `/desk/${enc(deskSlug(doctype))}`;
  if (!view || view === "list") return base;
  return `${base}/view/${view}${viewName ? `/${enc(viewName)}` : ""}`;
}

export const docUrl = (doctype: string, name: string) => `/desk/${enc(deskSlug(doctype))}/${enc(name)}`;
export const newDocUrl = (doctype: string) => `/desk/${enc(deskSlug(doctype))}/new`;

// A private workspace is named `<title>-<owner email>`; Desk spells it by its title under /desk/private/
// (router.js respell_private_workspace)
const PRIVATE_WS = /^(.*)-([^\s@-]+@[^\s@]+)$/;
export function workspaceUrl(name: string): string {
  const m = PRIVATE_WS.exec(name);
  return m ? `/desk/private/${enc(deskSlug(m[1]))}` : `/desk/${enc(deskSlug(name))}`;
}

/** A Desk Page by its route name (`point-of-sale`, `permission-manager/User`) */
export const pageUrl = (route: string) => `/desk/${route.split("/").map(enc).join("/")}`;

export const reportUrl = (name: string) => `/desk/query-report/${enc(name)}`;
export const dashboardUrl = (name: string) => `/desk/dashboard-view/${enc(name)}`;
