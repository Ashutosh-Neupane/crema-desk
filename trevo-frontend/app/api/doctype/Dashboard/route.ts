import type { NextRequest } from "next/server";

interface ReportResult {
  result: Array<Record<string, unknown>>;
  columns: Array<{ fieldname?: string; label?: string }>;
  chart?: Record<string, unknown>;
}

export async function GET(req: NextRequest) {
  const name = new URL(req.url).pathname.split("/").pop();
  
  try {
    const cookie = req.headers.get("cookie") || "";
    const backendUrl = process.env.FRAPPE_BACKEND_URL || "http://localhost:8000";
    
    const url = new URL(`${backendUrl}/api/method/frappe.desk.dashboard.get`);
    url.searchParams.set("name", name || "default");
    
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Frappe-CSRF-Token": "fetch",
        Cookie: cookie,
      },
      cache: "no-store",
    });

    const text = await res.text();
    if (!res.ok) {
      return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
    }

    const envelope = JSON.parse(text) as { message?: { title?: string; module?: string; widgets?: Array<Record<string, unknown>> } };
    const dashboard = envelope.message ?? {};
    const widgets = dashboard.widgets ?? [];
    
    // Fetch chart data for widgets that have chart_name
    const widgetsWithData = await Promise.all(
      widgets.map(async (widget: Record<string, unknown>) => {
        const chartName = widget.chart_name as string | undefined;
        if (!chartName) return widget;

        try {
          const reportUrl = new URL(`${backendUrl}/api/method/frappe.desk.query_report.run`);
          reportUrl.searchParams.set("report_name", chartName);
          
          const reportRes = await fetch(reportUrl.toString(), {
            headers: {
              Accept: "application/json",
              "X-Frappe-CSRF-Token": "fetch",
              Cookie: cookie,
            },
            cache: "no-store",
          });

          if (reportRes.ok) {
            const reportText = await reportRes.text();
            const reportEnvelope = JSON.parse(reportText) as { message?: ReportResult };
            return {
              ...widget,
              chart_data: reportEnvelope.message?.result ?? [],
              chart_columns: reportEnvelope.message?.columns ?? [],
              chart_options: reportEnvelope.message?.chart ?? {},
            };
          }
        } catch {
          // Continue on error
        }

        return widget;
      })
    );

    return new Response(
      JSON.stringify({
        title: dashboard.title || name || "Dashboard",
        module: dashboard.module,
        widgets: widgetsWithData,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ title: name || "Dashboard", module: undefined, widgets: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * POST /api/doctype/Dashboard/[name]
 * Handles { action: "update_widgets", charts: [...], number_cards: [...] }
 */
export async function POST(req: NextRequest) {
  const name = new URL(req.url).pathname.split("/").pop();
  const cookie = req.headers.get("cookie") || "";
  const backendUrl = process.env.FRAPPE_BACKEND_URL || "http://localhost:8000";

  try {
    const body = await req.json() as {
      action?: string;
      charts?: Array<{ chart_name: string }>;
      number_cards?: Array<{ number_card_name: string }>;
    };

    if (body.action !== "update_widgets") {
      return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
    }

    const res = await fetch(`${backendUrl}/api/resource/Dashboard/${encodeURIComponent(name ?? "")}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Frappe-CSRF-Token": "fetch",
        Cookie: cookie,
      },
      body: JSON.stringify({
        charts: (body.charts ?? []).map((c, i) => ({ chart_name: c.chart_name, order: i })),
        number_cards: (body.number_cards ?? []).map((n, i) => ({ number_card_name: n.number_card_name, order: i })),
      }),
    });

    const text = await res.text();
    return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
