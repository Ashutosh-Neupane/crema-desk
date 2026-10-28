/**
 * /api/boot — Assembles boot info (equivalent to get_bootinfo, which is NOT whitelisted).
 * Composes: user + User resource + installed apps into a single response.
 */
import { NextResponse } from "next/server";
import { assembleBootInfo } from "@/lib/frappe/boot";
import { getCookieHeader } from "@/lib/frappe/server";

export async function GET() {
  try {
    const cookie = await getCookieHeader();
    const info = await assembleBootInfo(cookie);
    if (!info) {
      return NextResponse.json({ user: null }, { status: 200 });
    }
    return NextResponse.json(info);
  } catch (err) {
    console.error("/api/boot error:", err);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
