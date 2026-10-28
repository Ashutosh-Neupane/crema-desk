/**
 * GET /api/desk/chart?name=<Dashboard Chart>[&timespan=&time_interval=]
 *  → { name, type, labels, datasets: [{ name, values }], timespan, time_interval, fieldtype? }
 *
 * Resolves a Dashboard Chart the way Desk's chart widget does
 * (frappe/public/js/frappe/widgets/chart_widget.js):
 *  - Count / Sum / Average / Group By → dashboard_chart.get (time series or grouped)
 *  - Report → run the report with the chart's saved filters; use the report's own
 *    `chart` when use_report_chart, else x_field + y_axis rows
 *  - Custom → the Dashboard Chart Source's JS config names a whitelisted `method`
 * `type` is the visual (line | bar | donut | pie | percentage | heatmap) — not
 * `chart_type`, which is the data source.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { FrappeError, frappeServerFetch, getCookieHeader } from "@/lib/frappe/server";
import { getDeskBoot } from "@/lib/frappe/deskBoot";
import { applyDynamicFilters, dynamicContextFromBoot, type DynamicContext } from "@/lib/frappe/dynamicFilters";

interface ChartDoc {
  name: string;
  chart_type: "Count" | "Sum" | "Average" | "Group By" | "Report" | "Custom";
  type?: string;
  timespan?: string;
  time_interval?: string;
  filters_json?: string;
  dynamic_filters_json?: string;
  report_name?: string;
  use_report_chart?: 0 | 1;
  x_field?: string;
  y_axis?: Array<{ y_field: string; color?: string }>;
  source?: string;
  color?: string;
}

interface Series {
  labels: string[];
  datasets: Array<{ name: string; values: number[] }>;
  fieldtype?: string;
}

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === "") return fallback;
  if (typeof raw !== "string") return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function fromReport(cookie: string, chart: ChartDoc, ctx: DynamicContext): Promise<Series> {
  const filters = applyDynamicFilters(parseJson<Record<string, unknown>>(chart.filters_json, {}), chart.dynamic_filters_json, ctx);
  const { data } = await frappeServerFetch<{
    result?: Array<Record<string, unknown> | unknown[]>;
    columns?: Array<{ fieldname?: string; label?: string; fieldtype?: string } | string>;
    chart?: { data?: { labels?: string[]; datasets?: Array<{ name?: string; values?: unknown[] }> }; fieldtype?: string };
  }>(cookie, "api/method/frappe.desk.query_report.run", {
    method: "POST",
    body: { report_name: chart.report_name, filters, ignore_prepared_report: 1, are_default_filters: false },
  });

  if (chart.use_report_chart && data?.chart?.data?.labels) {
    return {
      labels: data.chart.data.labels.map(String),
      datasets: (data.chart.data.datasets ?? []).map((d, i) => ({ name: d.name ?? `Series ${i + 1}`, values: (d.values ?? []).map(num) })),
      fieldtype: data.chart.fieldtype,
    };
  }

  const cols = (data?.columns ?? []).map((c) => (typeof c === "string" ? { fieldname: c.split(":")[0], label: c.split(":")[0] } : c));
  const rows = (data?.result ?? []).map((r) => {
    if (!Array.isArray(r)) return r as Record<string, unknown>;
    const o: Record<string, unknown> = {};
    cols.forEach((c, i) => (o[c.fieldname ?? String(i)] = r[i]));
    return o;
  });
  const x = chart.x_field ?? cols[0]?.fieldname ?? "";
  const ys = chart.y_axis?.length ? chart.y_axis.map((y) => y.y_field) : cols.slice(1, 2).map((c) => c.fieldname ?? "");
  const label = (f: string) => cols.find((c) => c.fieldname === f)?.label ?? f;
  const usable = rows.filter((r) => r[x] != null && r[x] !== "" && !("bold" in r && r.bold));
  return {
    labels: usable.map((r) => String(r[x])),
    datasets: ys.map((y) => ({ name: label(y), values: usable.map((r) => num(r[y])) })),
  };
}

async function fromCustomSource(cookie: string, chart: ChartDoc, timespan: string, interval: string, ctx: DynamicContext): Promise<Series> {
  // The source's JS config ({ method: "app.module.get", filters: [...] }) lives with the source doctype
  const { data: config } = await frappeServerFetch<string>(
    cookie,
    "api/method/frappe.desk.doctype.dashboard_chart_source.dashboard_chart_source.get_config",
    { params: { name: chart.source } },
  );
  const method = String(config ?? "").match(/method\s*:\s*["'`]([\w.]+)["'`]/)?.[1];
  if (!method) throw new Error(`Chart source "${chart.source}" has no method`);
  const { data } = await frappeServerFetch<{ labels?: string[]; datasets?: Array<{ name?: string; values?: unknown[] }> }>(
    cookie,
    `api/method/${method}`,
    {
      method: "POST",
      body: {
        chart_name: chart.name,
        filters: JSON.stringify(applyDynamicFilters(parseJson(chart.filters_json, {}), chart.dynamic_filters_json, ctx)),
        timespan,
        time_interval: interval,
        timegrain: interval,
        refresh: 1,
      },
    },
  );
  return {
    labels: (data?.labels ?? []).map(String),
    datasets: (data?.datasets ?? []).map((d, i) => ({ name: d.name ?? `Series ${i + 1}`, values: (d.values ?? []).map(num) })),
  };
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const cookie = await getCookieHeader();

  try {
    const { data: chart } = await frappeServerFetch<ChartDoc>(cookie, `api/resource/Dashboard Chart/${encodeURIComponent(name)}`);
    if (!chart) return NextResponse.json({ error: "Chart not found" }, { status: 404 });

    const timespan = req.nextUrl.searchParams.get("timespan") || chart.timespan || "Last Year";
    const interval = req.nextUrl.searchParams.get("time_interval") || chart.time_interval || "Monthly";

    const ctx = dynamicContextFromBoot(await getDeskBoot(cookie));
    let series: Series;
    if (chart.chart_type === "Report") {
      series = await fromReport(cookie, chart, ctx);
    } else if (chart.chart_type === "Custom") {
      series = await fromCustomSource(cookie, chart, timespan, interval, ctx);
    } else {
      const filters = applyDynamicFilters(parseJson<unknown[]>(chart.filters_json, []), chart.dynamic_filters_json, ctx);
      const { data } = await frappeServerFetch<{ labels?: unknown[]; datasets?: Array<{ name?: string; values?: unknown[] }> }>(
        cookie,
        "api/method/frappe.desk.doctype.dashboard_chart.dashboard_chart.get",
        { method: "POST", body: { chart_name: name, timespan, time_interval: interval, filters: JSON.stringify(filters), refresh: 1 } },
      );
      series = {
        labels: (data?.labels ?? []).map(String),
        datasets: (data?.datasets ?? []).map((d, i) => ({ name: d.name ?? `Series ${i + 1}`, values: (d.values ?? []).map(num) })),
      };
    }

    return NextResponse.json({
      name,
      chart_type: chart.chart_type,
      type: String(chart.type ?? "Line").toLowerCase(),
      timespan,
      time_interval: interval,
      time_series: !["Report", "Custom", "Group By"].includes(chart.chart_type),
      ...series,
    });
  } catch (err) {
    const message = err instanceof FrappeError || err instanceof Error ? err.message : "Failed to load chart";
    return NextResponse.json({ error: message }, { status: err instanceof FrappeError ? err.status : 500 });
  }
}
