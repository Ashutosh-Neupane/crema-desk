import { NextResponse } from "next/server";
import { getCookieHeader } from "@/lib/frappe/server";
import { fetchDoctypeMetasServer } from "@/lib/frappe/doctype";
import type { DoctypeBrief } from "@/lib/frappe/doctypeBrief";

/**
 * GET /api/doctype/:doctype/brief → { title_field, is_submittable, has_status }
 *
 * The few meta facts a summary screen (the dynamic home, My work) needs, without sending the full getdoctype
 * payload (fields, scripts, child tables: 300–700 KB for a transaction) to the browser. Same permission as getdoctype.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ doctype: string }> }) {
  try {
    const { doctype } = await params;
    const docs = await fetchDoctypeMetasServer(await getCookieHeader(), doctype);
    const meta = docs.find((d) => d.name === doctype) ?? docs[0];
    if (!meta) return NextResponse.json({ error: "DocType not found" }, { status: 404 });
    const tf = typeof meta.title_field === "string" ? meta.title_field : "";
    const column = tf && tf !== "name" && meta.fields?.some((f) => f.fieldname === tf && !f.is_virtual);
    const brief: DoctypeBrief = {
      title_field: column ? tf : null,
      is_submittable: !!meta.is_submittable,
      has_status: !!meta.fields?.some((f) => f.fieldname === "status" && f.fieldtype === "Select"),
    };
    return NextResponse.json(brief, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (err: unknown) {
    const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to fetch metadata" }, { status: status || 500 });
  }
}
