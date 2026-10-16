/**
 * POST /api/doctype/[doctype]/bulk
 *
 * Bulk operations endpoint for selected documents.
 * Supports: delete, submit, cancel, edit, assign, export
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FRAPPE_BACKEND_URL, backendFetch } from "@/lib/frappe/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  const { doctype } = await params;
  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();

  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      docnames?: string[];
      data?: Record<string, unknown>;
    };
    const { action, docnames, data } = body;

    if (!action || !docnames || !Array.isArray(docnames) || docnames.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: action, docnames" },
        { status: 400 },
      );
    }

    switch (action) {
      case "delete": {
        // Delete multiple documents
        const results = await Promise.allSettled(
          docnames.map((name) =>
            backendFetch(
              `${FRAPPE_BACKEND_URL}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
              {
                method: "DELETE",
                headers: {
                  Accept: "application/json",
                  ...(cookieHeader ? { Cookie: cookieHeader } : {}),
                },
              },
            ),
          ),
        );
        const deleted = results.filter((r) => r.status === "fulfilled" && (r.value as Response).ok).length;
        return NextResponse.json({
          message: `Deleted ${deleted} of ${docnames.length} records`,
          deleted,
          total: docnames.length,
        });
      }

      case "submit": {
        // Submit multiple documents
        const results = await Promise.allSettled(
          docnames.map((name) =>
            backendFetch(
              `${FRAPPE_BACKEND_URL}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
              {
                method: "PUT",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                  ...(cookieHeader ? { Cookie: cookieHeader } : {}),
                },
                body: JSON.stringify({ docstatus: 1 }),
              },
            ),
          ),
        );
        const submitted = results.filter((r) => r.status === "fulfilled" && (r.value as Response).ok).length;
        return NextResponse.json({
          message: `Submitted ${submitted} of ${docnames.length} documents`,
          submitted,
          total: docnames.length,
        });
      }

      case "cancel": {
        // Cancel multiple documents
        const results = await Promise.allSettled(
          docnames.map((name) =>
            backendFetch(
              `${FRAPPE_BACKEND_URL}/api/method/frappe.client.cancel`,
              {
                method: "POST",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                  ...(cookieHeader ? { Cookie: cookieHeader } : {}),
                },
                body: JSON.stringify({ doctype, name }),
              },
            ),
          ),
        );
        const cancelled = results.filter((r) => r.status === "fulfilled" && (r.value as Response).ok).length;
        return NextResponse.json({
          message: `Cancelled ${cancelled} of ${docnames.length} documents`,
          cancelled,
          total: docnames.length,
        });
      }

      case "edit": {
        // Bulk edit a field value
        const { fieldname, value } = (data ?? {}) as {
          fieldname?: string;
          value?: string;
        };
        if (!fieldname) {
          return NextResponse.json({ error: "Missing fieldname" }, { status: 400 });
        }
        const results = await Promise.allSettled(
          docnames.map((name) =>
            backendFetch(
              `${FRAPPE_BACKEND_URL}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
              {
                method: "PUT",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                  ...(cookieHeader ? { Cookie: cookieHeader } : {}),
                },
                body: JSON.stringify({ [fieldname]: value }),
              },
            ),
          ),
        );
        const updated = results.filter((r) => r.status === "fulfilled" && (r.value as Response).ok).length;
        return NextResponse.json({
          message: `Updated ${updated} of ${docnames.length} records`,
          updated,
          total: docnames.length,
        });
      }

      case "assign": {
        // Assign documents to users
        const { users } = (data ?? {}) as { users?: string[] };
        if (!users || !Array.isArray(users) || users.length === 0) {
          return NextResponse.json({ error: "Missing users" }, { status: 400 });
        }
        const results = await Promise.allSettled(
          docnames.map((name) =>
            backendFetch(
              `${FRAPPE_BACKEND_URL}/api/method/frappe.desk.form.assign_to.add`,
              {
                method: "POST",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                  ...(cookieHeader ? { Cookie: cookieHeader } : {}),
                },
                body: JSON.stringify({
                  assign_to: users,
                  doctype,
                  name,
                }),
              },
            ),
          ),
        );
        const assigned = results.filter((r) => r.status === "fulfilled" && (r.value as Response).ok).length;
        return NextResponse.json({
          message: `Assigned to ${assigned} of ${docnames.length} documents`,
          assigned,
          total: docnames.length,
        });
      }

      case "export": {
        // Export selected documents as JSON
        const results = await Promise.allSettled(
          docnames.map((name) =>
            backendFetch(
              `${FRAPPE_BACKEND_URL}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
              {
                method: "GET",
                headers: {
                  Accept: "application/json",
                  ...(cookieHeader ? { Cookie: cookieHeader } : {}),
                },
              },
            ).then((r) => r.json()),
          ),
        );
        const docs = results
          .filter((r) => r.status === "fulfilled")
          .map((r) => (r as PromiseFulfilledResult<unknown>).value);
        return NextResponse.json({ data: docs });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error("Bulk operation error:", err);
    return NextResponse.json(
      { error: "Bulk operation failed" },
      { status: 500 },
    );
  }
}
