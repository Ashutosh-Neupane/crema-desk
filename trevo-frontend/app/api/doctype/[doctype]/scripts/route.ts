/**
 * GET /api/doctype/[doctype]/scripts
 *
 * Fetches all Client Script documents attached to the given DocType.
 * Returns the list of script strings so the form can execute them in the sandbox.
 *
 * Frappe stores these in the "Client Script" doctype (frappe.core.doctype.client_script).
 * Each script has: name, dt (doctype), script, enabled
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { frappeServerFetch } from "@/lib/frappe/server";

interface ClientScriptDoc {
  name: string;
  dt: string;
  script: string;
  enabled: number;
  view: string; // "Form" | "List" | "Both"
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  const { doctype } = await params;
  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();

  try {
    const { data } = await frappeServerFetch<ClientScriptDoc[] | { data: ClientScriptDoc[] }>(
      cookieHeader,
      "api/method/frappe.client.get_list",
      {
        method: "POST",
        body: {
          doctype: "Client Script",
          filters: [
            ["dt", "=", doctype],
            ["enabled", "=", 1],
          ],
          fields: ["name", "dt", "script", "enabled", "view"],
          limit: 50,
        },
      },
    );

    let scripts: ClientScriptDoc[] = [];
    if (Array.isArray(data)) {
      scripts = data as ClientScriptDoc[];
    } else if (data && typeof data === "object" && Array.isArray((data as { data: ClientScriptDoc[] }).data)) {
      scripts = (data as { data: ClientScriptDoc[] }).data;
    }

    // Filter to Form view scripts only
    const formScripts = scripts.filter(
      (s) => s.view === "Form" || s.view === "Both" || !s.view,
    );

    return NextResponse.json({
      scripts: formScripts.map((s) => ({
        name: s.name,
        script: s.script,
      })),
    });
  } catch {
    // Client Script doctype may not exist on all Frappe setups — graceful fallback
    return NextResponse.json({ scripts: [] });
  }
}
