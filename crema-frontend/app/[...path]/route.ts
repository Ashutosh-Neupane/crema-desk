/**
 * Every path no Crema route claims goes to the Frappe site as it is (lib/frappe/sitePassthrough.ts): other apps'
 * frontends (`/banking`, `/crm`, `/helpdesk` …), `/apps`, portal and website pages, web forms and `/api/v2`.
 * Crema's own routes (`/desk`, `/login`, `/api/frappe` …) are more specific and always win.
 */
import type { NextRequest } from "next/server";
import { passThrough } from "@/lib/frappe/sitePassthrough";

type Ctx = { params: Promise<{ path: string[] }> };
const handle = async (req: NextRequest, { params }: Ctx) => passThrough(req, (await params).path);

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
