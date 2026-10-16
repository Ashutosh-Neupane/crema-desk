import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { FrappeError, frappeServerFetch, getCookieHeader } from "@/lib/frappe/server";

/**
 * POST /api/doctype/:doctype/save  body: { ...doc, action?: "Save" | "Submit" | "Update" }
 *
 * Same endpoint Desk's frm.save() uses (frappe.desk.form.save.savedocs), so
 * every server hook runs: before_validate, validate, before_save, on_update,
 * before_submit/on_submit, Server Scripts, … Responds with the document *as the
 * server saved it* — hooks may set values (totals, naming, status), and the
 * form must replace its local state with it, exactly like Desk.
 *
 * Errors: { error, exc_type, server_messages } with Frappe's human message.
 */
const VALID_ACTIONS = ["Save", "Submit", "Update"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  const { doctype } = await params;
  const cookie = await getCookieHeader();
  const body = (await req.json()) as Record<string, unknown>;
  const action = typeof body.action === "string" && VALID_ACTIONS.includes(body.action) ? body.action : "Save";
  delete body.action;

  const doc: Record<string, unknown> = { ...body, doctype };
  // A doc without a name is new: like Desk, give it a temporary local name
  // (new-<doctype-slug>-1) and __islocal so savedocs inserts it
  if (!doc.name || doc.__islocal) {
    doc.name = typeof doc.name === "string" && doc.name.startsWith("new-")
      ? doc.name
      : `new-${doctype.toLowerCase().replace(/\s+/g, "-")}-1`;
    doc.__islocal = 1;
  }

  try {
    const { envelope } = await frappeServerFetch<unknown>(cookie, "api/method/frappe.desk.form.save.savedocs", {
      method: "POST",
      body: { doc: JSON.stringify(doc), action },
    });
    const saved = (envelope as { docs?: Record<string, unknown>[] } | null)?.docs?.[0] ?? null;
    return NextResponse.json({ data: saved, action }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof FrappeError) {
      return NextResponse.json(
        { error: err.message, exc_type: err.excType, server_messages: err.serverMessages },
        { status: err.status || 500 },
      );
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save document" }, { status: 500 });
  }
}
