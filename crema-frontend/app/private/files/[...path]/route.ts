import type { NextRequest } from "next/server";
import { proxyFile } from "@/lib/frappe/fileProxy";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyFile(req, "/private/files", (await params).path);
}
