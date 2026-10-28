import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { frappeServerFetch } from "@/lib/frappe/server";

function getEmailFromUrl(request: NextRequest): string {
  const { searchParams } = new URL(request.url);
  return searchParams.get("email") ?? "";
}

export async function GET(request: NextRequest) {
  try {
    const email = getEmailFromUrl(request);
    if (!email) return NextResponse.json([], { status: 200 });
    const cookieJar = await cookies();
    const cookie = cookieJar.toString();
    const res = await frappeServerFetch(
      cookie,
      `api/resource/User Role?filters=["[\"parent\",\"=\",\"${email}\"]"]&fields=["role","name"]`,
    );
    return NextResponse.json(res.data ?? []);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const email = getEmailFromUrl(request);
    if (!email) return NextResponse.json({ error: "Missing email param" }, { status: 400 });
    const cookieJar = await cookies();
    const cookie = cookieJar.toString();
    const body = await request.json();
    const res = await frappeServerFetch(cookie, "api/resource/User Role", {
      method: "POST",
      body: JSON.stringify({ ...body, parent: email }),
      headers: { "Content-Type": "application/json" },
    });
    return NextResponse.json(res.data ?? {});
  } catch {
    return NextResponse.json({ error: "Failed to assign role" }, { status: 500 });
  }
}

