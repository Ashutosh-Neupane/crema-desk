import { NextResponse } from "next/server";
import { getCookieHeader } from "@/lib/frappe/server";
import { fetchDoctypeMetasServer } from "@/lib/frappe/doctype";

/**
 * GET /api/doctype/:doctype/meta → { data: meta, children: childMetas[] }
 * Merged meta (incl. Custom Fields / Property Setters) via getdoctype.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ doctype: string }> },
) {
  try {
    const { doctype } = await params;
    const cookie = await getCookieHeader();
    const docs = await fetchDoctypeMetasServer(cookie, doctype);
    const data = docs.find((d) => d.name === doctype) ?? docs[0];

    if (!data) {
      return NextResponse.json({ error: "DocType not found" }, { status: 404 });
    }

    return NextResponse.json({ data, children: docs.filter((d) => d !== data) });
  } catch (err: unknown) {
    const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch metadata" },
      { status: status || 500 },
    );
  }
}
