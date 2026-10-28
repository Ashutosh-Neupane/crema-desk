/**
 * GET /api/doctype/[doctype]/kanban?board_name=xxx
 * POST /api/doctype/[doctype]/kanban
 *
 * Kanban board data and operations.
 * GET: Returns kanban board columns and cards.
 * POST: Creates/updates kanban board settings.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FRAPPE_BACKEND_URL, backendFetch } from "@/lib/frappe/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  const { doctype } = await params;
  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();

  // Fetch kanban boards for this doctype from Frappe
  try {
    const res = await backendFetch(
      `${FRAPPE_BACKEND_URL}/api/resource/Kanban Board?filters=${JSON.stringify(
        JSON.stringify([["reference_doctype", "=", doctype]]),
      )}&fields=["*"]`,
      {
        headers: {
          Accept: "application/json",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      return NextResponse.json({ columns: [], cards: [] });
    }

    const json = await res.json();
    const boards = json?.data ?? [];

    if (boards.length === 0) {
      return NextResponse.json({ columns: [], cards: [] });
    }

    // Use the first board
    const board = boards[0];

    // Parse columns
    const columns = (board.columns ?? []).map((col: { column_name?: string; order?: number; status?: string }) => ({
      id: col.column_name ?? "untitled",
      title: col.column_name ?? "Untitled",
      order: col.order ?? 0,
      status: col.status ?? "active",
    }));

    // Fetch cards for this board
    const cardRes = await backendFetch(
      `${FRAPPE_BACKEND_URL}/api/resource/${encodeURIComponent(doctype)}?filters=${JSON.stringify(
        JSON.stringify([["kanban_board", "=", board.name]]),
      )}&limit=1000`,
      {
        headers: {
          Accept: "application/json",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        cache: "no-store",
      },
    );

    const cardJson = await cardRes.json().catch(() => ({ data: [] }));
    const cards = (cardJson?.data ?? []).map((doc: Record<string, unknown>) => ({
      id: doc.name as string,
      title: (doc[board.field_name ?? "subject"] ?? doc.name) as string,
      column: (doc[board.column_field ?? "status"] ?? "Open") as string,
      data: doc,
    }));

    return NextResponse.json({
      board: {
        name: board.name,
        field_name: board.field_name ?? "subject",
        column_field: board.column_field ?? "status",
      },
      columns,
      cards,
    });
  } catch (err) {
    console.error("Kanban fetch error:", err);
    return NextResponse.json({ columns: [], cards: [] });
  }
}

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
      card_id?: string;
      column?: string;
      data?: Record<string, unknown>;
    };
    const { action, card_id, column, data } = body;

    switch (action) {
      case "move_card": {
        // Move a card to a different column
        if (!card_id || !column) {
          return NextResponse.json({ error: "Missing card_id or column" }, { status: 400 });
        }
        // Fetch the current doc to get the column field name
        const metaRes = await backendFetch(
          `${FRAPPE_BACKEND_URL}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(card_id)}`,
          {
            headers: {
              Accept: "application/json",
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
          },
        );
        const metaJson = await metaRes.json().catch(() => null);
        if (!metaJson?.data) {
          return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        // Update the column field
        const updateRes = await backendFetch(
          `${FRAPPE_BACKEND_URL}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(card_id)}`,
          {
            method: "PUT",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
            body: JSON.stringify({ [data?.column_field as string ?? "status"]: column }),
          },
        );

        if (!updateRes.ok) {
          const err = await updateRes.json().catch(() => ({ message: "Update failed" }));
          return NextResponse.json({ error: err.message }, { status: 500 });
        }

        return NextResponse.json({ message: "Card moved successfully" });
      }

      case "create_card": {
        // Create a new card in the specified column
        if (!data) {
          return NextResponse.json({ error: "Missing card data" }, { status: 400 });
        }
        const createRes = await backendFetch(
          `${FRAPPE_BACKEND_URL}/api/resource/${encodeURIComponent(doctype)}`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
            body: JSON.stringify({
              ...data,
              [data.column_field as string ?? "status"]: column ?? "Open",
            }),
          },
        );

        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({ message: "Create failed" }));
          return NextResponse.json({ error: err.message }, { status: 500 });
        }

        const newDoc = await createRes.json();
        return NextResponse.json({ message: "Card created", data: newDoc?.data });
      }

      case "add_column": {
        const colBody = body as { column_name?: string };
        if (!colBody.column_name) return NextResponse.json({ error: "column_name required" }, { status: 400 });
        // Find existing board for this doctype
        const boardsRes = await backendFetch(
          `${FRAPPE_BACKEND_URL}/api/resource/Kanban Board?filters=${JSON.stringify(JSON.stringify([["reference_doctype","=",doctype]]))}`,
          { headers: { Accept: "application/json", ...(cookieHeader ? { Cookie: cookieHeader } : {}) }, cache: "no-store" },
        );
        const boardsJson = await boardsRes.json().catch(() => ({ data: [] }));
        const boardDoc = boardsJson?.data?.[0];
        if (!boardDoc) return NextResponse.json({ error: "No board found" }, { status: 404 });
        // Append column
        const existing: Array<Record<string,unknown>> = boardDoc.columns ?? [];
        existing.push({ column_name: colBody.column_name, order: existing.length });
        const upRes = await backendFetch(`${FRAPPE_BACKEND_URL}/api/resource/Kanban Board/${encodeURIComponent(boardDoc.name)}`, {
          method: "PUT", headers: { Accept: "application/json", "Content-Type": "application/json", ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
          body: JSON.stringify({ columns: existing }),
        });
        if (!upRes.ok) return NextResponse.json({ error: "Failed to add column" }, { status: 500 });
        return NextResponse.json({ message: "Column added" });
      }

      case "archive_column":
      case "restore_column": {
        const colBody2 = body as { column_id?: string };
        if (!colBody2.column_id) return NextResponse.json({ error: "column_id required" }, { status: 400 });
        const boardsRes2 = await backendFetch(
          `${FRAPPE_BACKEND_URL}/api/resource/Kanban Board?filters=${JSON.stringify(JSON.stringify([["reference_doctype","=",doctype]]))}`,
          { headers: { Accept: "application/json", ...(cookieHeader ? { Cookie: cookieHeader } : {}) }, cache: "no-store" },
        );
        const boardsJson2 = await boardsRes2.json().catch(() => ({ data: [] }));
        const boardDoc2 = boardsJson2?.data?.[0];
        if (!boardDoc2) return NextResponse.json({ error: "No board found" }, { status: 404 });
        const newStatus = action === "archive_column" ? "Archived" : "Active";
        const updatedCols = (boardDoc2.columns ?? []).map((c: Record<string,unknown>) =>
          c.column_name === colBody2.column_id ? { ...c, status: newStatus } : c,
        );
        const upRes2 = await backendFetch(`${FRAPPE_BACKEND_URL}/api/resource/Kanban Board/${encodeURIComponent(boardDoc2.name)}`, {
          method: "PUT", headers: { Accept: "application/json", "Content-Type": "application/json", ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
          body: JSON.stringify({ columns: updatedCols }),
        });
        if (!upRes2.ok) return NextResponse.json({ error: "Failed to update column" }, { status: 500 });
        return NextResponse.json({ message: `Column ${newStatus.toLowerCase()}` });
      }

      case "create_board": {
        const createBody = body as { board_name?: string };
        if (!createBody.board_name) return NextResponse.json({ error: "board_name required" }, { status: 400 });
        const createRes = await backendFetch(`${FRAPPE_BACKEND_URL}/api/resource/Kanban Board`, {
          method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
          body: JSON.stringify({
            doctype: "Kanban Board",
            name: createBody.board_name,
            reference_doctype: doctype,
            field_name: "subject",
            column_field: "status",
            columns: [
              { column_name: "Open", order: 0 },
              { column_name: "In Progress", order: 1 },
              { column_name: "Done", order: 2 },
            ],
          }),
        });
        if (!createRes.ok) return NextResponse.json({ error: "Failed to create board" }, { status: 500 });
        return NextResponse.json({ message: "Board created" });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error("Kanban operation error:", err);
    return NextResponse.json({ error: "Kanban operation failed" }, { status: 500 });
  }
}
