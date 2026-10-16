import type { NextRequest } from "next/server";
import { backendFetch } from "@/lib/frappe/server";

export async function GET(req: NextRequest) {
  const doctype = new URL(req.url).pathname.split("/").pop();
  if (!doctype) {
    return new Response(JSON.stringify({ message: "Missing doctype" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  try {
    const cookie = req.headers.get("cookie") || "";
    const url = new URL(`${process.env.FRAPPE_BACKEND_URL || "http://localhost:8000"}/api/resource/${encodeURIComponent(doctype)}`);
    url.searchParams.set("fields", JSON.stringify(["name", "parent", "is_group", "name"]));
    url.searchParams.set("order_by", "name asc");
    url.searchParams.set("limit", "1000");

    const res = await backendFetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Frappe-CSRF-Token": "fetch",
        Cookie: cookie,
      },
      cache: "no-store",
    });

    const text = await res.text();
    if (!res.ok) {
      return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
    }

    const envelope = JSON.parse(text) as { data?: Array<{ name: string; parent?: string; is_group?: number }> };
    const nodes = (envelope.data || []).map((doc) => ({
      id: doc.name,
      parentId: doc.parent || null,
      isGroup: doc.is_group === 1,
    }));

    return new Response(JSON.stringify({ nodes }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ message: "Failed to fetch tree data" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
