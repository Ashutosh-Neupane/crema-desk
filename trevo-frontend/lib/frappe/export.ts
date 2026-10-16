"use client";

export function exportToCSV(rows: Array<Record<string, unknown>>, columns: Array<{ fieldname: string; label?: string | undefined }>, filename = "export.csv") {
  if (!rows.length) return;

  const headers = columns.map((c) => (c.label || c.fieldname).replace(/"/g, '""'));
  const csvRows = rows.map((row) =>
    columns.map((c) => {
      const val = row[c.fieldname];
      const str = val === null || val === undefined ? "" : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    }).join(",")
  );

  const csv = [headers.join(","), ...csvRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportToJSON(rows: Array<Record<string, unknown>>, filename = "export.json") {
  if (!rows.length) return;
  const json = JSON.stringify(rows, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
