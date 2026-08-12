/**
 * GET /api/doctype/Dashboard/chart?chart_name=<name>
 *
 * Fetches live data for a Frappe Dashboard Chart document.
 * Calls frappe.desk.doctype.dashboard_chart.dashboard_chart.get
 * and normalises the result into { labels, datasets } for recharts.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { frappeServerFetch } from "@/lib/frappe/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chartName = searchParams.get("chart_name");
  const timespan = searchParams.get("timespan") ?? "Last Year";
  const timegrain = searchParams.get("timegrain") ?? "Monthly";

  if (!chartName) {
    return NextResponse.json({ error: "chart_name is required" }, { status: 400 });
  }

  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();

  try {
    // Fetch the Dashboard Chart document first to get its config
    const { data: chartDoc } = await frappeServerFetch<Record<string, unknown>>(
      cookieHeader,
      `api/resource/Dashboard Chart/${encodeURIComponent(chartName)}`,
    );

    if (!chartDoc) {
      return NextResponse.json({ error: "Chart not found" }, { status: 404 });
    }

    // Call the chart data method
    const { data: chartData } = await frappeServerFetch<{
      labels: string[];
      datasets: Array<{ name: string; values: number[] }>;
      chart_type?: string;
    }>(cookieHeader, "api/method/frappe.desk.doctype.dashboard_chart.dashboard_chart.get", {
      method: "POST",
      body: {
        chart_name: chartName,
        timespan,
        timegrain,
        filters: chartDoc.filters_json ?? "[]",
      },
    }).catch(() => ({ data: null }));

    if (!chartData?.labels) {
      // Fallback: try query_report if chart has a report
      if (chartDoc.report_name) {
        const { data: reportData } = await frappeServerFetch<{
          result: Array<Record<string, unknown>>;
          columns: Array<{ fieldname?: string; label: string }>;
        }>(cookieHeader, "api/method/frappe.desk.query_report.run", {
          method: "POST",
          body: { report_name: chartDoc.report_name, filters: {} },
        }).catch(() => ({ data: null }));

        if (reportData?.result?.length) {
          const cols = reportData.columns;
          const xKey = cols[0]?.fieldname ?? "x";
          const yKey = cols[1]?.fieldname ?? "y";
          const rows = reportData.result.map((r) => ({
            [xKey]: String(r[xKey] ?? ""),
            [yKey]: Number(r[yKey] ?? 0),
          }));
          return NextResponse.json({
            chart_type: chartDoc.chart_type ?? "bar",
            rows,
            xKey,
            yKey,
            title: chartDoc.chart_name ?? chartName,
          });
        }
      }
      return NextResponse.json({ chart_type: chartDoc.chart_type ?? "bar", rows: [], xKey: "x", yKey: "y", title: chartName });
    }

    // Normalise to rows format for recharts
    const rows = chartData.labels.map((label, i) => ({
      x: label,
      ...(chartData.datasets ?? []).reduce<Record<string, number>>((acc, ds) => {
        acc[ds.name] = ds.values[i] ?? 0;
        return acc;
      }, {}),
    }));

    const datasetNames = (chartData.datasets ?? []).map((d) => d.name);

    return NextResponse.json({
      chart_type: chartDoc.chart_type ?? "line",
      rows,
      xKey: "x",
      yKey: datasetNames[0] ?? "y",
      datasetNames,
      title: chartDoc.chart_name ?? chartName,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch chart";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
