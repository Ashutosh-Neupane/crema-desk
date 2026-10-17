import type { NextRequest } from "next/server";
import { proxyFile } from "@/lib/frappe/fileProxy";

/** Frappe's built assets (print CSS, letterhead images) referenced by server-rendered HTML */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyFile(req, "/assets", (await params).path);
}
