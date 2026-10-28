import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { frappeServerFetch, getCookieHeader } from "@/lib/frappe/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string; name: string }> },
) {
  try {
    const { doctype, name } = await params;
    const cookie = await getCookieHeader();
    const searchParams = req.nextUrl.searchParams;
    const fieldsParam = searchParams.get("fields");

    const query: Record<string, string | number | boolean | object | null | undefined> = {};
    if (fieldsParam) query.fields = JSON.stringify(fieldsParam.split(","));

    const { data } = await frappeServerFetch<{ data: Record<string, unknown> }>(
      cookie,
      `api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
      { params: query },
    );

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch document" },
      { status: status || 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string; name: string }> },
) {
  try {
    const { doctype, name } = await params;
    const cookie = await getCookieHeader();
    const body = await req.json();

    const { data } = await frappeServerFetch<{ data: Record<string, unknown> }>(
      cookie,
      `api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
      {
        method: "PUT",
        body,
      },
    );

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update document" },
      { status: status || 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string; name: string }> },
) {
  try {
    const { doctype, name } = await params;
    const cookie = await getCookieHeader();

    await frappeServerFetch<void>(
      cookie,
      `api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
      { method: "DELETE" },
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete document" },
      { status: status || 500 },
    );
  }
}
