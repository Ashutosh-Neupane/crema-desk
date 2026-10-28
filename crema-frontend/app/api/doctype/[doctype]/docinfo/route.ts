import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { frappeServerFetch, getCookieHeader } from "@/lib/frappe/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  try {
    const { doctype } = await params;
    const name = req.nextUrl.searchParams.get("name");

    if (!name) {
      return NextResponse.json({ error: "Missing name parameter" }, { status: 400 });
    }

    const cookie = await getCookieHeader();

    const { data } = await frappeServerFetch<{
      docinfo: {
        comments?: Array<Record<string, unknown>>;
        attachments?: Array<Record<string, unknown>>;
        assignments?: Array<Record<string, unknown>>;
        versions?: Array<Record<string, unknown>>;
        shared?: Array<Record<string, unknown>>;
        tags?: string[];
        workflow_state?: string | null;
        energy_point_logs?: Array<Record<string, unknown>>;
      };
    }>(
      cookie,
      "api/method/frappe.desk.form.load.get_doc_info",
      {
        params: { doctype, name },
      },
    );

    return NextResponse.json({ data: data ?? {} });
  } catch (err: unknown) {
    const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch doc info" },
      { status: status || 500 },
    );
  }
}
