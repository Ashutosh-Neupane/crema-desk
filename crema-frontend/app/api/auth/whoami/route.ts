/**
 * GET /api/auth/whoami
 *
 * Returns the currently logged-in user's email (or null).
 * Uses the whitelisted frappe.auth.get_logged_user (verified working).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FRAPPE_BACKEND_URL, backendFetch } from "@/lib/frappe/server";

export async function GET() {
  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();

  // Quick local check: if no sid cookie, not logged in
  const sid = cookieJar.get("sid")?.value;
  if (!sid || sid === "Guest") {
    return NextResponse.json({ message: null, user: null }, { status: 200 });
  }

  try {
    const res = await backendFetch(
      `${FRAPPE_BACKEND_URL}/api/method/frappe.auth.get_logged_user`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      return NextResponse.json({ message: null, user: null }, { status: 200 });
    }

    const json = (await res.json().catch(() => null)) as { message?: string } | null;
    const message = json?.message ?? null;

    if (!message || message === "Guest") {
      return NextResponse.json({ message: null, user: null }, { status: 200 });
    }

    return NextResponse.json({ message, user: message }, { status: 200 });
  } catch {
    return NextResponse.json({ message: null, user: null }, { status: 200 });
  }
}
