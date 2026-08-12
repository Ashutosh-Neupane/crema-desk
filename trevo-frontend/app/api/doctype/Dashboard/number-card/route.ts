/**
 * GET /api/doctype/Dashboard/number-card?card_name=<name>
 *
 * Fetches the live numeric value for a Frappe Number Card.
 * Calls frappe.desk.doctype.number_card.number_card.get_result.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { frappeServerFetch } from "@/lib/frappe/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cardName = searchParams.get("card_name");

  if (!cardName) {
    return NextResponse.json({ error: "card_name is required" }, { status: 400 });
  }

  const cookieJar = await cookies();
  const cookieHeader = cookieJar.toString();

  try {
    // Fetch the Number Card document first
    const { data: cardDoc } = await frappeServerFetch<Record<string, unknown>>(
      cookieHeader,
      `api/resource/Number Card/${encodeURIComponent(cardName)}`,
    );

    if (!cardDoc) {
      return NextResponse.json({ error: "Number card not found" }, { status: 404 });
    }

    // Get the live result
    const { data: result } = await frappeServerFetch<{ result: number | string }>(
      cookieHeader,
      "api/method/frappe.desk.doctype.number_card.number_card.get_result",
      {
        method: "POST",
        body: {
          doc: cardDoc,
          filters: cardDoc.filters_json ?? "[]",
        },
      },
    ).catch(() => ({ data: null }));

    return NextResponse.json({
      card_name: cardName,
      label: cardDoc.label ?? cardName,
      value: result?.result ?? null,
      doctype: cardDoc.document_type,
      color: cardDoc.color ?? "#2490ef",
      is_public: cardDoc.is_public ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch number card";
    return NextResponse.json({ error: msg, value: null }, { status: 500 });
  }
}
