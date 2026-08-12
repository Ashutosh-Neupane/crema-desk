/*
 * POST /api/auth/login
 *
 * Proxies Frappe /api/method/login, then re-issues the `sid` cookie on the
 * Next.js domain so all subsequent API calls carry the session cookie.
 *
 * Security enhancements:
 * - Rate limiting via rateLimiter service
 * - Input validation for email/password
 * - CSRF token generation on successful login
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FRAPPE_BACKEND_URL } from "@/lib/frappe/server";
import { checkRateLimit } from "@/lib/services/rateLimiter";
import { generateCsrfToken } from "@/lib/services/csrf";
import { loginSchema } from "@/lib/schemas/auth-login.schema";

export async function POST(req: Request) {
  // Check rate limit first
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const rateCheck = checkRateLimit(ip, { maxRequests: 5, windowSeconds: 60 });
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { message: "Too many login attempts. Please try again later." },
      { status: 429, headers: rateCheck.headers },
    );
  }

  const rawBody = await req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400, headers: rateCheck.headers },
    );
  }
  const { email, password } = parsed.data;

  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();

  const url = `${FRAPPE_BACKEND_URL}/api/method/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ usr: email, pwd: password }),
  });

  const json = (await res.json().catch(() => null)) as {
    message?: string;
    home_page?: string;
    full_name?: string;
  } | null;

  if (!res.ok) {
    return NextResponse.json(
      { message: json?.message ?? "Invalid credentials" },
      { status: res.status, headers: rateCheck.headers },
    );
  }

  // Extract the `sid` value Frappe set and re-issue it on our domain.
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const response = NextResponse.json(json ?? { message: "Logged In" }, { status: 200 });

  let sidValue: string | null = null;
  for (const sc of setCookies) {
    const sidMatch = sc.match(/^sid=([^;]+)/);
    if (sidMatch) {
      sidValue = sidMatch[1];
    }
  }

  if (sidValue) {
    response.cookies.set("sid", sidValue, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days, matches Frappe default
    });

    // Set CSRF token for the session
    const csrfToken = generateCsrfToken();
    response.cookies.set("csrf-token", csrfToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  return response;
}
