import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { frappeServerFetch } from "@/lib/frappe/server";

export async function POST(request: NextRequest) {
  try {
    const cookieJar = await cookies();
    const cookie = cookieJar.toString();
    const body = await request.json();
    const query = String(body.query || "").trim();

    if (!query) {
      return NextResponse.json({ error: "Empty query" }, { status: 400 });
    }

    const lower = query.toLowerCase();
    if (lower.startsWith("drop") || lower.startsWith("delete") || lower.startsWith("truncate") || lower.startsWith("alter")) {
      return NextResponse.json({ error: "Write operations are not allowed" }, { status: 403 });
    }

    const res = await frappeServerFetch(cookie, "api/method/trevo.system_console.execute", {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });

    const data = res.data as { result?: Array<Record<string, unknown>>; columns?: string[] } | null;
    if (!data) {
      return NextResponse.json({ columns: [], rows: [] });
    }

    const columns = data.columns ?? [];
    const rows = (data.result ?? []).map((r) => columns.map((c) => r[c]));

    return NextResponse.json({ columns, rows });
  } catch {
    return NextResponse.json({ error: "Query execution failed" }, { status: 500 });
  }
}
