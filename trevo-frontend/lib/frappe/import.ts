import Papa from "papaparse";

export interface ImportResult {
  total: number;
  imported: number;
  errors: Array<{ row: number; message: string }>;
}

export async function importCsvToDocType(
  file: File,
  doctype: string,
  fieldMap: Array<{ fieldname: string; header: string }>,
): Promise<ImportResult> {
  const text = await file.text();
  const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true });
  const rows = parsed.data as string[][];
  if (rows.length === 0) return { total: 0, imported: 0, errors: [] };

  const headers = rows[0].map((h: string) => h.trim());
  const body = rows.slice(1);

  const fieldMapByHeader = new Map(fieldMap.map((f) => [f.header.toLowerCase(), f.fieldname]));
  const cols = headers.map((h: string) => fieldMapByHeader.get(h.toLowerCase()) ?? h.toLowerCase());

  let imported = 0;
  const errors: ImportResult["errors"] = [];

  for (let i = 0; i < body.length; i++) {
    const values = body[i];
    const doc: Record<string, unknown> = { doctype };
    for (let j = 0; j < cols.length && j < values.length; j++) {
      if (cols[j]) doc[cols[j]] = values[j]?.trim() ?? "";
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || ""}/api/doctype/${encodeURIComponent(doctype)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        errors.push({ row: i + 2, message: text || `HTTP ${res.status}` });
      } else {
        imported++;
      }
    } catch (e) {
      errors.push({ row: i + 2, message: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return { total: body.length, imported, errors };
}
