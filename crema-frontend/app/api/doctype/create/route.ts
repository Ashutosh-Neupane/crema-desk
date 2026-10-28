/**
 * POST /api/doctype/create
 *
 * Creates a DocType + DocField children through the Frappe backend.
 * This lets users create custom DocTypes entirely from the Crema UI
 * (exactly like Frappe's own DocType Studio / "New DocType" dialog).
 */
import { NextResponse } from "next/server";
import { frappeServerFetch, getCookieHeader } from "@/lib/frappe/server";

interface CreateDocTypeBody {
  name: string;
  module: string;
  istable?: boolean;
  issingle?: boolean;
  is_submittable?: boolean;
  track_changes?: boolean;
  in_create?: boolean;
  custom?: boolean;
  fields: Array<{
    fieldname: string;
    label?: string;
    fieldtype: string;
    options?: string;
    reqd?: boolean;
    in_list_view?: boolean;
    in_standard_filter?: boolean;
    default?: string;
    description?: string;
    read_only?: boolean;
  }>;
}

export async function POST(req: Request) {
  const cookie = await getCookieHeader();
  let body: CreateDocTypeBody;
  try {
    body = (await req.json()) as CreateDocTypeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "DocType name is required" }, { status: 400 });
  }
  if (!body.module?.trim()) {
    return NextResponse.json({ error: "Module is required" }, { status: 400 });
  }

  const payload = {
    name: body.name.trim(),
    module: body.module.trim(),
    istable: body.istable ? 1 : 0,
    issingle: body.issingle ? 1 : 0,
    is_submittable: body.is_submittable ? 1 : 0,
    track_changes: body.track_changes ? 1 : 0,
    custom: body.custom !== false ? 1 : 0,
    in_create: body.in_create ? 1 : 0,
    fields: (body.fields ?? []).map((f) => ({
      fieldname: f.fieldname,
      label: f.label || f.fieldname,
      fieldtype: f.fieldtype,
      options: f.options || undefined,
      reqd: f.reqd ? 1 : 0,
      in_list_view: f.in_list_view ? 1 : 0,
      in_standard_filter: f.in_standard_filter ? 1 : 0,
      default: f.default || undefined,
      description: f.description || undefined,
      read_only: f.read_only ? 1 : 0,
    })),
  };

  try {
    const res = await frappeServerFetch(
      cookie,
      "api/resource/DocType",
      {
        method: "POST",
        body: JSON.stringify(payload),
        throwOnError: false,
      },
    );

    if (!res.ok || res.status >= 400) {
      const envelope = res.envelope as unknown as
        | { exc?: string; exception?: string; _server_messages?: string | null }
        | null
        | undefined;
      const msg =
        envelope?.exc?.split("\n").filter(Boolean).slice(-1)[0] ??
        envelope?.exception ??
        (res.data as { error?: string } | null)?.error ??
        `Failed to create DocType (${res.status})`;
      return NextResponse.json({ error: msg }, { status: res.status >= 400 ? res.status : 400 });
    }

    return NextResponse.json({
      message: "DocType created successfully",
      data: res.data ?? res.envelope,
    });
  } catch (err) {
    console.error("DocType create error:", err);
    const msg = err instanceof Error ? err.message : "Failed to create DocType";
    return NextResponse.json(
      { error: msg },
      { status: 500 },
    );
  }
}

