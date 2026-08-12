import { NextResponse } from "next/server";

/** Standard success response */
export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

/** Standard error response */
export function apiError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Forward a Frappe error response with its original status */
export function frappeError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message, source: "frappe" }, { status });
}
