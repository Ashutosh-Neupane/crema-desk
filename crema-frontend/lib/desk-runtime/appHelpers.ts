/**
 * Shared JS that apps put in their Desk bundle and that report scripts expect to find on `erpnext.*`.
 * Desk loads the whole app bundle (app_include_js); Crema can't run those bundles (they reach into Desk's DOM and
 * its build), so it loads the app's own plain source files that report scripts depend on, unchanged, from the
 * site's /assets, and runs them in the report's runtime before the report script — e.g. Balance Sheet is
 * `$.extend({}, erpnext.financial_statements)`.
 *
 * ERPNext (erpnext/public/js, imported by erpnext.bundle.js):
 *   utils.js                       erpnext.utils.get_link_options / add_dimensions / …, get_presentation_currency_list
 *   financial_statements.js        filters, formatter, tree settings, onload of Balance Sheet, P&L, Cash Flow, …
 *   sales_trends_filters.js, purchase_trends_filters.js, subcontracting_inward_report_filters.js
 */
export interface HelperScript {
  label: string;
  code: string;
}

const HELPERS: Array<{ app: string; uses: RegExp; files: string[] }> = [
  {
    app: "erpnext",
    uses: /\berpnext\./,
    files: ["utils.js", "financial_statements.js", "sales_trends_filters.js", "purchase_trends_filters.js", "subcontracting_inward_report_filters.js"],
  },
];

const cache = new Map<string, Promise<string>>();

/** the file's source, or "" when the site doesn't have it (app not installed) */
function fetchAsset(path: string): Promise<string> {
  let p = cache.get(path);
  if (!p) {
    p = fetch(path, { credentials: "include" })
      .then((r) => (r.ok && !(r.headers.get("content-type") ?? "").includes("text/html") ? r.text() : ""))
      .catch(() => "");
    cache.set(path, p);
  }
  return p;
}

/** the helper scripts a report script needs, in load order */
export async function reportHelpers(script: string, installedApps?: string[]): Promise<HelperScript[]> {
  const wanted = HELPERS.filter((h) => h.uses.test(script) && (!installedApps || installedApps.includes(h.app)));
  const out: HelperScript[] = [];
  for (const h of wanted) {
    const codes = await Promise.all(h.files.map((f) => fetchAsset(`/assets/${h.app}/js/${f}`)));
    h.files.forEach((f, i) => codes[i] && out.push({ label: `${h.app}/${f}`, code: codes[i] }));
  }
  return out;
}
