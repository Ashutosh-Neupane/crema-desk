/**
 * POST /api/doctype/[doctype]/import
 *
 * Imports data into a Frappe DocType by proxying to Frappe's data import endpoint.
 * Accepts CSV/JSON payloads and returns the import result.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FRAPPE_BACKEND_URL, backendFetch } from "@/lib/frappe/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  const { doctype } = await params;
  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const importType = (formData.get("import_type") as string) ?? "Insert New Records";
    const submitAfter = formData.get("submit_after") === "true";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const frappeFormData = new FormData();
    frappeFormData.append("file", file, file.name);
    frappeFormData.append("doctype", doctype);
    frappeFormData.append("import_type", importType);
    frappeFormData.append("submit_after", String(submitAfter));

    const res = await backendFetch(
      `${FRAPPE_BACKEND_URL}/api/method/frappe.data_import.importer.import_file`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        body: frappeFormData,
      },
    );

    const responseText = await res.text();
    let json;
    try {
      json = JSON.parse(responseText);
    } catch {
      json = { message: responseText };
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: json?.message || json?.exc || "Import failed" },
        { status: res.status },
      );
    }

    return NextResponse.json({
      message: "Import completed",
      data: json?.message || json?.data || json,
    });
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 },
    );
  }
}
