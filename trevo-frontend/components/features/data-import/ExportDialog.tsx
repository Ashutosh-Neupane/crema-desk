"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/shadcn/dialog";
import { Download, FileSpreadsheet, FileJson, Clipboard, FileType } from "lucide-react";
import { exportToCSV, exportToJSON } from "@/lib/frappe/export";
import * as XLSX from "xlsx";

interface ExportableField {
  fieldname: string;
  label: string;
  selected?: boolean;
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctype: string;
  data: Array<Record<string, unknown>>;
  fields: ExportableField[];
  totalRecords?: number;
}

const SERVER_SIDE_THRESHOLD = 500;

export function ExportDialog({
  open,
  onOpenChange,
  doctype,
  data,
  fields: initialFields,
  totalRecords,
}: ExportDialogProps) {
  const [fields, setFields] = useState<ExportableField[]>(
    initialFields.map((f) => ({ ...f, selected: true })),
  );
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "xlsx">("csv");
  const [exportAll, setExportAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [useServerSide] = useState(false);

  const selectedFields = useMemo(
    () => fields.filter((f) => f.selected),
    [fields],
  );

  const needsServerSide = useMemo(() => {
    return exportAll && (totalRecords ?? data.length) > SERVER_SIDE_THRESHOLD;
  }, [exportAll, totalRecords, data.length]);

  const toggleField = useCallback((fieldname: string) => {
    setFields((prev) =>
      prev.map((f) =>
        f.fieldname === fieldname ? { ...f, selected: !f.selected } : f,
      ),
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    const allSelected = fields.every((f) => f.selected);
    setFields((prev) =>
      prev.map((f) => ({ ...f, selected: !allSelected })),
    );
  }, [fields]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const cols = selectedFields.map((f) => ({
        fieldname: f.fieldname,
        label: f.label,
      }));

      if (useServerSide) {
        const res = await fetch(`/api/doctype/${encodeURIComponent(doctype)}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: cols.map((c) => c.fieldname),
            filters: [],
            format: exportFormat,
          }),
        });

        if (!res.ok) {
          throw new Error("Server-side export failed");
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${doctype}_export.${exportFormat === "xlsx" ? "xlsx" : "csv"}`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (exportFormat === "csv") {
        exportToCSV(data, cols, `${doctype}_export.csv`);
      } else if (exportFormat === "xlsx") {
        const ws = XLSX.utils.json_to_sheet(
          data.map((row) => {
            const obj: Record<string, unknown> = {};
            cols.forEach((c) => { obj[c.label || c.fieldname] = row[c.fieldname]; });
            return obj;
          }),
        );
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        XLSX.writeFile(wb, `${doctype}_export.xlsx`);
      } else {
        exportToJSON(data, `${doctype}_export.json`);
      }
      onOpenChange(false);
    } finally {
      setExporting(false);
    }
  }, [selectedFields, exportFormat, data, doctype, onOpenChange, useServerSide]);

  const handleCopyToClipboard = useCallback(async () => {
    const cols = selectedFields.map((f) => f.fieldname);
    const header = cols.join("\t");
    const rows = data.map((row) =>
      cols.map((col) => String(row[col] ?? "")).join("\t"),
    );
    const text = [header, ...rows].join("\n");

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }, [selectedFields, data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Export {doctype}
            {totalRecords !== undefined && (
              <span className="ml-2 text-sm font-normal text-zinc-500">
                ({totalRecords} records)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format selection */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Export Format
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setExportFormat("csv")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                  exportFormat === "csv"
                    ? "border-zinc-900 bg-zinc-50 text-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-100"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
                }`}
              >
                <FileSpreadsheet className="h-5 w-5" />
                CSV
              </button>
              <button
                onClick={() => setExportFormat("xlsx")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                  exportFormat === "xlsx"
                    ? "border-zinc-900 bg-zinc-50 text-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-100"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
                }`}
              >
                <FileType className="h-5 w-5" />
                Excel
              </button>
              <button
                onClick={() => setExportFormat("json")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                  exportFormat === "json"
                    ? "border-zinc-900 bg-zinc-50 text-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-100"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
                }`}
              >
                <FileJson className="h-5 w-5" />
                JSON
              </button>
            </div>
          </div>

          {/* Export scope */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="export-all"
              checked={exportAll}
              onChange={(e) => setExportAll(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <label htmlFor="export-all" className="text-sm text-zinc-600 dark:text-zinc-400">
              Export all records (instead of current page)
            </label>
            {needsServerSide && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                Server-side
              </span>
            )}
          </div>

          {/* Field selection */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Fields to export ({selectedFields.length} selected)
              </label>
              <button
                onClick={toggleSelectAll}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {fields.every((f) => f.selected) ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              {fields.map((field) => (
                <label
                  key={field.fieldname}
                  className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 last:border-b-0 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={field.selected ?? false}
                    onChange={() => toggleField(field.fieldname)}
                    className="rounded border-zinc-300"
                  />
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {field.label || field.fieldname}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCopyToClipboard} disabled={exporting}>
            <Clipboard className="mr-1 h-4 w-4" />
            Copy
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={selectedFields.length === 0 || exporting}>
            {exporting ? "Exporting..." : (
              <>
                <Download className="mr-1 h-4 w-4" />
                Export as {exportFormat.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
