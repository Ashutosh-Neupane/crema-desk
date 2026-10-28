/**
 * GET /api/module/[module]
 *
 * Returns metadata for a single Module Def: doctypes, reports, pages,
 * web forms and workspaces belonging to that module.
 * Any app's modules work automatically because this is generated from the
 * backend's Module Def metadata.
 */
import { NextResponse } from "next/server";
import { frappeServerFetch, getCookieHeader } from "@/lib/frappe/server";

interface ModuleDefRecord {
  name: string;
  module_name?: string;
  app_name?: string;
  color?: string;
  icon?: string;
  [key: string]: unknown;
}

interface ModuleContents {
  module: ModuleDefRecord | null;
  doctypes: Array<{ name: string; module: string }>;
  reports: Array<{ name: string }>;
  pages: Array<{ name: string }>;
  web_forms: Array<{ name: string }>;
  workspaces: Array<{ name: string; title: string }>;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ module: string }> },
) {
  const { module } = await params;
  const cookie = await getCookieHeader();

  const contents: ModuleContents = {
    module: null,
    doctypes: [],
    reports: [],
    pages: [],
    web_forms: [],
    workspaces: [],
  };

  try {
    // 1. Module Def record itself
    const moduleRes = await frappeServerFetch<ModuleDefRecord>(
      cookie,
      `api/resource/Module Def/${encodeURIComponent(module)}`,
    );
    contents.module = moduleRes.data;

    // 2. Doctypes in module
    try {
      const { data } = await frappeServerFetch<{ name: string; module: string }[]>(
        cookie,
        `api/resource/DocType?filters=${encodeURIComponent(JSON.stringify([["module", "=", module]]))}&fields=["name","module"]&limit=500&order_by=name asc`,
      );
      contents.doctypes = Array.isArray(data) ? data : [];
    } catch {
      // ignore
    }

    // 3. Reports in module
    try {
      const { data } = await frappeServerFetch<{ name: string }[]>(
        cookie,
        `api/resource/Report?filters=${encodeURIComponent(JSON.stringify([["module", "=", module]]))}&fields=["name"]&limit=500&order_by=name asc`,
      );
      contents.reports = Array.isArray(data) ? data : [];
    } catch {
      // ignore
    }

    // 4. Custom Pages in module
    try {
      const { data } = await frappeServerFetch<{ name: string }[]>(
        cookie,
        `api/resource/Page?filters=${encodeURIComponent(JSON.stringify([["module", "=", module]]))}&fields=["name"]&limit=500&order_by=name asc`,
      );
      contents.pages = Array.isArray(data) ? data : [];
    } catch {
      // ignore
    }

    // 5. Web Forms in module
    try {
      const { data } = await frappeServerFetch<{ name: string }[]>(
        cookie,
        `api/resource/Web Form?filters=${encodeURIComponent(JSON.stringify([["module", "=", module]]))}&fields=["name"]&limit=500&order_by=name asc`,
      );
      contents.web_forms = Array.isArray(data) ? data : [];
    } catch {
      // ignore
    }

    // 6. Workspaces (pages) in module
    try {
      const { data } = await frappeServerFetch<{ name: string; title: string }[]>(
        cookie,
        `api/resource/Workspace?filters=${encodeURIComponent(JSON.stringify([["module", "=", module]]))}&fields=["name","title","module"]&limit=200&order_by=title asc`,
      );
      contents.workspaces = Array.isArray(data) ? data : [];
    } catch {
      // ignore
    }

    return NextResponse.json(contents);
  } catch (err) {
    console.error(`[module/${module}] error:`, err);
    return NextResponse.json(contents, { status: 200 });
  }
}

