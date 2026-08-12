import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { frappeServerFetch } from "@/lib/frappe/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieJar = await cookies();
    const cookie = cookieJar.toString();
    const res = await frappeServerFetch(cookie, `api/resource/Web Form Submission?filters=[["web_form","=","${id}"]]&limit_page_length=50`);
    return NextResponse.json(res.data ?? []);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieJar = await cookies();
    const cookie = cookieJar.toString();
    const body = await request.json();
    const res = await frappeServerFetch(cookie, "api/method/trevo.web_form.submit", {
      method: "POST",
      body: JSON.stringify({ form_id: id, data: body }),
      headers: { "Content-Type": "application/json" },
    });
    return NextResponse.json(res.data ?? { success: true });
  } catch {
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }
}
