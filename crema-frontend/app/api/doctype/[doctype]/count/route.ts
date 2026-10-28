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
    const filters = req.nextUrl.searchParams.get("filters");

    const query: Record<string, string | number | boolean | object | null | undefined> = { doctype };
    if (filters) {
      try {
        query.filters = JSON.parse(filters);
      } catch {
        query.filters = filters;
      }
    }

    const { data } = await frappeServerFetch<number>(
      cookie,
      "api/method/frappe.client.get_count",
      { params: query },
    );

    return NextResponse.json({ count: data ?? 0 });
  } catch (err: unknown) {
    const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch count" },
      { status: status || 500 },
    );
  }
}
