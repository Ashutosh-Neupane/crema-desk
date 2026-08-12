import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { frappeServerFetch } from "@/lib/frappe/server";

export async function GET() {
  try {
    const cookieJar = await cookies();
    const cookie = cookieJar.toString();
    const res = await frappeServerFetch(cookie, 'api/resource/Role?fields=["name","role_name","description"]&limit_page_length=100');
    return NextResponse.json(res.data ?? []);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieJar = await cookies();
    const cookie = cookieJar.toString();
    const body = await request.json();
    const res = await frappeServerFetch(cookie, "api/resource/Role", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    return NextResponse.json(res.data ?? {});
  } catch {
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }
}
