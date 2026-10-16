/**
 * POST /api/auth/logout
 *
 * Calls Frappe logout, then clears the `sid` cookie on the Next.js domain
 * so the user is fully signed out of our frontend.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FRAPPE_BACKEND_URL, backendFetch } from "@/lib/frappe/server";

export async function POST() {
  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();

  try {
    await backendFetch(`${FRAPPE_BACKEND_URL}/api/method/logout`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });
  } catch {
    // Ignore Frappe-side errors; still clear local cookie
  }

  const response = NextResponse.json({ message: "Logged Out" }, { status: 200 });

  // Clear sid on Next domain
  response.cookies.set("sid", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
