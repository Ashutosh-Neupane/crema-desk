"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PrintFormatBuilder } from "@/components/features/print-format";
import { toast } from "sonner";
import Link from "next/link";
import { Card } from "@/components/shadcn/card";
import { Plus, FileText } from "lucide-react";

/**
 * Print Format page — /desk/print-format
 *
 * Lists all Print Format documents and provides a builder for editing them.
 * URL params:
 *   ?doctype=Customer   →  show builder for Customer print format
 *   ?format=My Format   →  load specific named Print Format
 */
export default function PrintFormatPage() {
  const searchParams = useSearchParams();
  const doctype = searchParams.get("doctype") ?? "";
  const formatName = searchParams.get("format") ?? "";

  // If we have a doctype/format, show the builder
  if (doctype || formatName) {
    return <PrintFormatBuilderView doctype={doctype} formatName={formatName} />;
  }

  return <PrintFormatList />;
}

// ─── List of all Print Formats ───────────────────────────────────────────────

function PrintFormatList() {
  const { data: formats = [], isLoading } = useQuery<Array<{ name: string; doc_type: string; custom_format?: number }>>({
    queryKey: ["print-formats"],
    queryFn: async () => {
      const res = await fetch(
        '/api/frappe/api/resource/Print Format?fields=["name","doc_type","custom_format"]&limit=100',
      );
      if (!res.ok) return [];
      const json = await res.json() as { data?: Array<{ name: string; doc_type: string; custom_format?: number }> };
      return json.data ?? [];
    },
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Print Formats</h1>
          <p className="mt-1 text-sm text-zinc-500">Design print templates for your documents</p>
        </div>
        <Link href="/desk/print-format?doctype=Sales Invoice" className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors h-9 rounded-lg px-3 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
          New Print Format
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-3/4 rounded bg-zinc-100 dark:bg-zinc-700" />
                <div className="h-3 w-1/2 rounded bg-zinc-100 dark:bg-zinc-700" />
              </div>
            </Card>
          ))}
        </div>
      ) : formats.length === 0 ? (
        <Card className="p-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-zinc-300" aria-hidden="true" />
          <p className="mt-2 text-sm text-zinc-500">No print formats yet</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {formats.map((fmt) => (
            <Link
              key={fmt.name}
              href={`/desk/print-format?doctype=${encodeURIComponent(fmt.doc_type)}&format=${encodeURIComponent(fmt.name)}`}
            >
              <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">
                    <FileText className="h-5 w-5 text-zinc-600 dark:text-zinc-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{fmt.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{fmt.doc_type}</p>
                    {fmt.custom_format === 1 && (
                      <span className="inline-block mt-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                        Custom
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Builder view ─────────────────────────────────────────────────────────────

function PrintFormatBuilderView({ doctype, formatName }: { doctype: string; formatName: string }) {
  const [saving, setSaving] = useState(false);

  // Load existing Print Format if a name was given
  const { data: existingFormat } = useQuery({
    queryKey: ["print-format-doc", formatName],
    queryFn: async () => {
      const res = await fetch(`/api/print-format/${encodeURIComponent(doctype)}`);
      if (!res.ok) return null;
      const list = await res.json() as Array<{ name: string }>;
      const match = list.find((f) => f.name === formatName);
      return match ?? null;
    },
    enabled: !!formatName,
    retry: false,
  });

  const handleSave = useCallback(
    async (config: Parameters<typeof PrintFormatBuilder>[0]["initialConfig"]) => {
      if (!config) return;
      setSaving(true);
      try {
        // Generate Jinja HTML from sections
        const html = generatePrintFormatHtml(config);

        const body = {
          name: config.name,
          doc_type: doctype || config.doctype,
          html,
          css: config.css ?? "",
          print_format_type: "Jinja",
          custom_format: 1,
          page_size: config.pageSize ?? "A4",
          orientation: config.orientation ?? "Portrait",
          margin_top: config.margin ?? "15",
          margin_bottom: "15",
          margin_left: "15",
          margin_right: "15",
        };

        const method = existingFormat ? "PUT" : "POST";
        const url = existingFormat
          ? `/api/print-format/${encodeURIComponent(doctype)}`
          : `/api/print-format/${encodeURIComponent(doctype)}`;

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error("Save failed");
        toast.success("Print format saved");
      } catch (err) {
        toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        setSaving(false);
      }
    },
    [doctype, existingFormat],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Print Format Builder</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {formatName ? `Editing: ${formatName}` : `New print format for ${doctype}`}
          </p>
        </div>
        <Link
          href="/desk/print-format"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ← All Print Formats
        </Link>
      </div>

      <PrintFormatBuilder
        doctype={doctype}
        formatName={formatName || undefined}
        onSave={handleSave}
      />

      {saving && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
          Saving…
        </div>
      )}
    </div>
  );
}

/** Convert PrintFormatConfig sections into a Jinja HTML string */
function generatePrintFormatHtml(
  config: NonNullable<Parameters<typeof PrintFormatBuilder>[0]["initialConfig"]>,
): string {
  let html = `<div class="print-format">`;
  for (const section of config.sections) {
    if (section.fields.length === 0) continue;
    html += `\n  <div class="section">`;
    if (section.label) html += `\n    <h3>${section.label}</h3>`;
    html += `\n    <table><tr>`;
    for (const field of section.fields) {
      const align = field.align ?? "left";
      const bold = field.bold ? "font-weight:bold;" : "";
      const width = field.width ? `width:${field.width};` : "";
      html += `\n      <td style="text-align:${align};${bold}${width}">`;
      html += `\n        <span class="field-label">${field.label}</span>`;
      if (field.type === "field" && field.fieldname) {
        html += `\n        <span class="field-value">{{ doc.${field.fieldname} }}</span>`;
      } else if (field.value) {
        html += `\n        <span class="field-value">${field.value}</span>`;
      }
      html += `\n      </td>`;
    }
    html += `\n    </tr></table>`;
    html += `\n  </div>`;
  }
  html += `\n</div>`;
  return html;
}
