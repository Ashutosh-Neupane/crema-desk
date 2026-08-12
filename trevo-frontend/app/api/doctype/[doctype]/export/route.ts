/**
 * POST /api/doctype/[doctype]/export
 * Server-side export for large datasets (> 500 rows).
 * Calls Frappe's reportview export endpoint and streams back the file.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FRAPPE_BACKEND_URL } from "@/lib/frappe/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  const { doctype } = await params;
  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();

  const body = await req.json().catch(() => ({})) as {
    fields?: string[];
    filters?: unknown[];
    file_format?: "CSV" | "Excel";
    limit?: number;
  };

  const fileFormat = body.file_format ?? "CSV";

  try {
    const res = await fetch(`${FRAPPE_BACKEND_URL}/api/method/frappe.desk.reportview.export_query`, {
      method: "POST",
      headers: {
        Accept: "application/json, text/csv, application/vnd.ms-excel",
        "Content-Type": "application/json",
        "X-Frappe-CSRF-Token": "fetch",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({
        doctype,
        fields: JSON.stringify(body.fields ?? ["name"]),
        filters: JSON.stringify(body.filters ?? []),
        file_format_type: fileFormat,
        with_comments: 0,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text || "Export failed" }, { status: res.status });
    }

    const blob = await res.blob();
    const ext = fileFormat === "Excel" ? "xlsx" : "csv";
    const contentType = fileFormat === "Excel"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv";

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(doctype)}_export.${ext}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
