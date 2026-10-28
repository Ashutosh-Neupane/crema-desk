/**
 * GET  /api/doctype/[doctype]/[name]/follow  — check if current user follows this doc
 * POST /api/doctype/[doctype]/[name]/follow  — follow or unfollow { action: "follow"|"unfollow" }
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { frappeServerFetch } from "@/lib/frappe/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ doctype: string; name: string }> },
) {
  const { doctype, name } = await params;
  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();

  try {
    const { data } = await frappeServerFetch<boolean>(
      cookieHeader,
      "api/method/frappe.desk.form.document_follow.is_following",
      { method: "POST", body: { doctype, name } },
    );
    return NextResponse.json({ following: data ?? false });
  } catch {
    return NextResponse.json({ following: false });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string; name: string }> },
) {
  const { doctype, name } = await params;
  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();
  const body = await req.json().catch(() => ({})) as { action?: "follow" | "unfollow" };
  const action = body.action ?? "follow";
  const method = action === "follow"
    ? "frappe.desk.form.document_follow.follow_document"
    : "frappe.desk.form.document_follow.unfollow_document";

  try {
    await frappeServerFetch(cookieHeader, `api/method/${method}`, {
      method: "POST",
      body: { doctype, name },
    });
    return NextResponse.json({ message: `${action}ed` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
