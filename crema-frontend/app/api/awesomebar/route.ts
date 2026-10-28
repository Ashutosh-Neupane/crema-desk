/**
 * GET /api/awesomebar → the searchable index behind ⌘K, from the desk boot:
 * DocTypes the user can read (with create/single flags), allowed reports, and
 * module workspaces — the same sources Desk's awesomebar ranks over.
 */
import { NextResponse } from "next/server";
import { getCookieHeader } from "@/lib/frappe/server";
import { getDeskBoot } from "@/lib/frappe/deskBoot";

export interface AwesomebarIndex {
  doctypes: Array<{ name: string; single: boolean; create: boolean }>;
  reports: Array<{ name: string; ref_doctype?: string; report_type?: string }>;
  workspaces: Array<{ name: string; module: string }>;
}

export async function GET() {
  const boot = await getDeskBoot(await getCookieHeader());
  if (!boot) {
    return NextResponse.json({ doctypes: [], reports: [], workspaces: [] } satisfies AwesomebarIndex);
  }

  const user = (boot.user ?? {}) as Record<string, unknown>;
  const list = (k: string) => new Set(Array.isArray(user[k]) ? (user[k] as string[]) : []);
  const canRead = list("can_read");
  const canCreate = list("can_create");
  const singles = new Set(Array.isArray(boot.single_types) ? (boot.single_types as string[]) : []);

  const doctypes = [...canRead]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, single: singles.has(name), create: canCreate.has(name) && !singles.has(name) }));

  const allowed = (boot.allowed_reports ?? {}) as Record<string, { ref_doctype?: string; report_type?: string }>;
  const reports = Object.entries(allowed).map(([name, r]) => ({
    name,
    ref_doctype: r.ref_doctype,
    report_type: r.report_type,
  }));

  const workspaces: AwesomebarIndex["workspaces"] = [];
  for (const sb of Object.values(boot.module_sidebars ?? {})) {
    for (const w of sb.workspaces ?? []) workspaces.push({ name: w, module: sb.name });
  }

  return NextResponse.json({ doctypes, reports, workspaces } satisfies AwesomebarIndex, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
