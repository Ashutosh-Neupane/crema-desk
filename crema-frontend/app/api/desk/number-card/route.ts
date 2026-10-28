/**
 * GET /api/desk/number-card?name=<Number Card>
 *  → { name, label, value, fieldtype, currency, color, change: number | null, interval }
 *
 * Mirrors Desk's number card widget (frappe/public/js/frappe/widgets/number_card_widget.js):
 *  - Document Type → number_card.get_result(doc, filters)
 *  - Report        → run the report, aggregate `report_field` with `report_function`
 *  - Custom        → call the card's whitelisted `method` with its filters
 * plus `get_percentage_difference` when show_percentage_stats is on.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { FrappeError, frappeServerFetch, getCookieHeader } from "@/lib/frappe/server";
import { getDeskBoot } from "@/lib/frappe/deskBoot";
import { applyDynamicFilters, dynamicContextFromBoot } from "@/lib/frappe/dynamicFilters";

interface CardDoc {
  name: string;
  label?: string;
  type?: "Document Type" | "Report" | "Custom";
  document_type?: string;
  function?: string;
  aggregate_function_based_on?: string;
  filters_json?: string;
  dynamic_filters_json?: string;
  report_name?: string;
  report_field?: string;
  report_function?: "Sum" | "Average" | "Minimum" | "Maximum";
  method?: string;
  color?: string;
  currency?: string;
  show_percentage_stats?: 0 | 1;
  stats_time_interval?: string;
}

const NC = "frappe.desk.doctype.number_card.number_card";
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
function parse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw) return (raw as T) ?? fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? req.nextUrl.searchParams.get("card_name");
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const cookie = await getCookieHeader();

  try {
    const { data: card } = await frappeServerFetch<CardDoc>(cookie, `api/resource/Number Card/${encodeURIComponent(name)}`);
    if (!card) return NextResponse.json({ error: "Number card not found" }, { status: 404 });
    const ctx = dynamicContextFromBoot(await getDeskBoot(cookie));
    const type = card.type ?? "Document Type";

    let value: number | null = null;
    let fieldtype = card.function === "Count" ? "Int" : "Float";
    let change: number | null = null;

    if (type === "Report") {
      const filters = applyDynamicFilters(parse<Record<string, unknown>>(card.filters_json, {}), card.dynamic_filters_json, ctx);
      const { data } = await frappeServerFetch<{
        result?: Array<Record<string, unknown>>;
        columns?: Array<{ fieldname?: string; fieldtype?: string }>;
      }>(cookie, "api/method/frappe.desk.query_report.run", {
        method: "POST",
        body: { report_name: card.report_name, filters, ignore_prepared_report: 1 },
      });
      const rows = (data?.result ?? []).filter((r) => r && typeof r === "object" && !Array.isArray(r));
      const vals = rows.map((r) => num(r[card.report_field ?? ""]));
      fieldtype = data?.columns?.find((c) => c.fieldname === card.report_field)?.fieldtype ?? "Float";
      const fn = card.report_function ?? "Sum";
      value = !vals.length ? 0
        : fn === "Average" ? vals.reduce((a, b) => a + b, 0) / vals.length
        : fn === "Minimum" ? Math.min(...vals)
        : fn === "Maximum" ? Math.max(...vals)
        : vals.reduce((a, b) => a + b, 0);
    } else if (type === "Custom" && card.method) {
      const filters = applyDynamicFilters(parse(card.filters_json, {}), card.dynamic_filters_json, ctx);
      const { data } = await frappeServerFetch<number | { value?: number; fieldtype?: string }>(cookie, `api/method/${card.method}`, {
        method: "POST",
        body: { filters: JSON.stringify(filters) },
      });
      value = typeof data === "object" && data ? num(data.value) : num(data);
      if (typeof data === "object" && data?.fieldtype) fieldtype = data.fieldtype;
    } else {
      const filters = applyDynamicFilters(parse<unknown[]>(card.filters_json, []), card.dynamic_filters_json, ctx);
      const { data } = await frappeServerFetch<number>(cookie, `api/method/${NC}.get_result`, {
        method: "POST",
        body: { doc: JSON.stringify(card), filters: JSON.stringify(filters) },
      });
      value = num(data);
      if (card.show_percentage_stats) {
        const { data: diff } = await frappeServerFetch<number | null>(cookie, `api/method/${NC}.get_percentage_difference`, {
          method: "POST",
          body: { doc: JSON.stringify(card), filters: JSON.stringify(filters), result: value },
        }).catch(() => ({ data: null }));
        change = typeof diff === "number" && Number.isFinite(diff) ? diff : null;
      }
      if (card.function && card.function !== "Count") fieldtype = "Currency";
    }

    return NextResponse.json({
      name,
      label: card.label || name,
      value,
      fieldtype,
      currency: card.currency || (ctx.defaults.currency as string | undefined) || null,
      color: card.color || null,
      change,
      interval: card.stats_time_interval || "Daily",
      doctype: card.document_type || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load number card";
    return NextResponse.json({ error: message, value: null }, { status: err instanceof FrappeError ? err.status : 500 });
  }
}
