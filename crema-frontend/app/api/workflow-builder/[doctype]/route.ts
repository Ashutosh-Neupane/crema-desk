/**
 * GET /api/workflow-builder/[doctype]
 * POST /api/workflow-builder/[doctype]
 *
 * Workflow CRUD operations.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FRAPPE_BACKEND_URL, backendFetch } from "@/lib/frappe/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  const { doctype } = await params;
  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();

  try {
    const res = await backendFetch(
      `${FRAPPE_BACKEND_URL}/api/resource/Workflow?filters=${JSON.stringify(JSON.stringify([["document_type", "=", doctype]]))}&fields=["*"]`,
      {
        headers: {
          Accept: "application/json",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        cache: "no-store",
      },
    );
    const json = await res.json();
    return NextResponse.json(json?.data ?? []);
  } catch (err) {
    console.error("Workflow fetch error:", err);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  const { doctype } = await params;
  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();
  const body = await req.json();

  try {
    const res = await backendFetch(
      `${FRAPPE_BACKEND_URL}/api/resource/Workflow`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        body: JSON.stringify({ ...body, document_type: doctype }),
      },
    );
    const json = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: json.message ?? "Failed to save" }, { status: 500 });
    }
    return NextResponse.json(json?.data ?? {});
  } catch (err) {
    console.error("Workflow save error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
