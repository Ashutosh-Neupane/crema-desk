/**
 * GET  /api/doctype/[doctype]/views          — list saved views for this doctype
 * POST /api/doctype/[doctype]/views          — create a new saved view
 * DELETE /api/doctype/[doctype]/views?name=  — delete a saved view
 *
 * Frappe stores per-user list view settings in the "List View Settings" doctype.
 * We read/write those settings here so saved views persist across sessions.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { frappeServerFetch } from "@/lib/frappe/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  const { doctype } = await params;
  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();

  try {
    const { data } = await frappeServerFetch(cookieHeader, "api/method/frappe.client.get_list", {
      method: "POST",
      body: {
        doctype: "List View Settings",
        filters: [["reference_doctype", "=", doctype]],
        fields: ["name", "reference_doctype", "fields", "filters", "sort_by", "sort_order", "group_by"],
        limit: 50,
      },
    });

    const views = Array.isArray(data) ? data : [];
    return NextResponse.json({ views });
  } catch {
    // List View Settings may not exist for this doctype — return empty list
    return NextResponse.json({ views: [] });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  const { doctype } = await params;
  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();

  const body = await req.json().catch(() => ({})) as {
    name?: string;
    fields?: string[];
    filters?: unknown;
    sort_by?: string;
    sort_order?: string;
    group_by?: string;
  };

  if (!body.name) {
    return NextResponse.json({ error: "View name is required" }, { status: 400 });
  }

  try {
    const { data } = await frappeServerFetch(cookieHeader, "api/method/frappe.client.insert", {
      method: "POST",
      body: {
        doc: {
          doctype: "List View Settings",
          reference_doctype: doctype,
          name: body.name,
          fields: JSON.stringify(body.fields ?? []),
          filters: JSON.stringify(body.filters ?? []),
          sort_by: body.sort_by ?? "modified",
          sort_order: body.sort_order ?? "desc",
          group_by: body.group_by ?? "",
        },
      },
    });
    return NextResponse.json({ view: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save view";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  await params; // doctype not needed for delete
  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();

  const { searchParams } = new URL(req.url);
  const viewName = searchParams.get("name");

  if (!viewName) {
    return NextResponse.json({ error: "View name is required" }, { status: 400 });
  }

  try {
    await frappeServerFetch(cookieHeader, "api/method/frappe.client.delete", {
      method: "POST",
      body: { doctype: "List View Settings", name: viewName },
    });
    return NextResponse.json({ message: "View deleted" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete view";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
