import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { frappeServerFetch } from "@/lib/frappe/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieJar = await cookies();
    const cookie = cookieJar.toString();
    const res = await frappeServerFetch(cookie, `api/resource/Web Form/${encodeURIComponent(id)}`);
    return NextResponse.json(res.data ?? {});
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieJar = await cookies();
    const cookie = cookieJar.toString();
    const body = await request.json();
    const res = await frappeServerFetch(cookie, `api/resource/Web Form/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    return NextResponse.json(res.data ?? {});
  } catch {
    return NextResponse.json({ error: "Failed to update web form" }, { status: 500 });
  }
}
