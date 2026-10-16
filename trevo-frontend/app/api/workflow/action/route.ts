import type { NextRequest } from "next/server";
import { backendFetch } from "@/lib/frappe/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { doctype, name, action, next_state } = body as {
      doctype: string;
      name: string;
      action: string;
      next_state: string;
    };

    if (!doctype || !name || !action) {
      return new Response(JSON.stringify({ message: "Missing required fields" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const cookie = req.headers.get("cookie") || "";
    const backendUrl = process.env.FRAPPE_BACKEND_URL || "http://localhost:8000";

    const url = new URL(`${backendUrl}/api/method/frappe.model.workflow.apply`);

    const res = await backendFetch(url.toString(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Frappe-CSRF-Token": "fetch",
        Cookie: cookie,
      },
      body: JSON.stringify({
        doctype,
        name,
        action,
        next_state,
      }),
      cache: "no-store",
    });

    const text = await res.text();
    if (!res.ok) {
      return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
    }

    return new Response(text, { status: 200, headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ message: "Failed to apply workflow action" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
