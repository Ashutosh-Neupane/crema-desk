import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { frappeServerFetch, getCookieHeader } from "@/lib/frappe/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  try {
    const { doctype } = await params;
    const cookie = await getCookieHeader();
    const searchParams = req.nextUrl.searchParams;

    const { data } = await frappeServerFetch<{ data: unknown[] }>(
      cookie,
      `api/resource/${encodeURIComponent(doctype)}`,
      {
        params: Object.fromEntries(searchParams.entries()),
      },
    );

    return NextResponse.json({ data: data ?? [] });
  } catch (err: unknown) {
    const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch documents" },
      { status: status || 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  try {
    const { doctype } = await params;
    const cookie = await getCookieHeader();
    const body = await req.json();

    const { data } = await frappeServerFetch<{ data: Record<string, unknown> }>(
      cookie,
      `api/resource/${encodeURIComponent(doctype)}`,
      {
        method: "POST",
        body,
      },
    );

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create document" },
      { status: status || 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  try {
    const { doctype } = await params;
    const cookie = await getCookieHeader();
    const body = await req.json().catch(() => ({}));
    const names: string[] = Array.isArray(body.names) ? body.names : [];

    if (names.length === 0) {
      return NextResponse.json({ error: "No names provided" }, { status: 400 });
    }

    const results = { deleted: [] as string[], failed: [] as { name: string; error: string }[] };

    for (const name of names) {
      try {
        await frappeServerFetch(
          cookie,
          `api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
          { method: "DELETE" },
        );
        results.deleted.push(name);
      } catch (err: unknown) {
        results.failed.push({
          name,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      message: `Deleted ${results.deleted.length} of ${names.length} records`,
      ...results,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bulk delete failed" },
      { status: 500 },
    );
  }
}
