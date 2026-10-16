/**
 * GET /api/doctype/[doctype]/gantt
 *
 * Returns Gantt chart data for a given doctype.
 * Expects the doctype to have date fields for start/end.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FRAPPE_BACKEND_URL, backendFetch } from "@/lib/frappe/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  const { doctype } = await params;
  const { searchParams } = new URL(req.url);
  const startField = searchParams.get("start_field") ?? "expected_start_date";
  const endField = searchParams.get("end_field") ?? "expected_end_date";
  const progressField = searchParams.get("progress_field") ?? "progress";
  const titleField = searchParams.get("title_field") ?? "subject";
  const filters = searchParams.get("filters");

  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();

  try {
    const filterParam = filters
      ? `&filters=${encodeURIComponent(filters)}`
      : "";

    const res = await backendFetch(
      `${FRAPPE_BACKEND_URL}/api/resource/${encodeURIComponent(doctype)}?fields=["${titleField}","${startField}","${endField}","${progressField}","name","docstatus","modified"]&limit=500${filterParam}`,
      {
        headers: {
          Accept: "application/json",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      return NextResponse.json({ tasks: [] });
    }

    const json = await res.json();
    const data = json?.data ?? [];

    const tasks = data
      .filter(
        (doc: Record<string, unknown>) =>
          doc[startField as string] && doc[endField as string],
      )
      .map((doc: Record<string, unknown>) => ({
        id: doc.name as string,
        title: (doc[titleField as string] ?? doc.name) as string,
        start: doc[startField as string] as string,
        end: doc[endField as string] as string,
        progress: Number(doc[progressField as string] ?? 0),
        docstatus: doc.docstatus as number,
        modified: doc.modified as string,
      }));

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error("Gantt fetch error:", err);
    return NextResponse.json({ tasks: [] });
  }
}
