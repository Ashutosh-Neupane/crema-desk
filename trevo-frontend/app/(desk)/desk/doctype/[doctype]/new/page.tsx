"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import FormRenderer from "@/lib/trevo-form/renderers/FormRenderer";
import { useDoctype } from "@/lib/hooks/useDoctype";
import { Label } from "@/components/shadcn/label";
import { PREFILL_KEY } from "@/components/DocumentActions";
import type { FrappeDocument } from "@/lib/frappe/types";

/**
 * New Document page.
 * Adds a Naming Series picker when the DocType uses `autoname = "naming_series:"`.
 */
export default function DoctypeNewPage() {
  const params = useParams<{ doctype: string }>();
  const router = useRouter();
  const doctype = decodeURIComponent(params.doctype);

  const { data: meta, isLoading: metaLoading } = useDoctype(doctype);
  const [namingSeries, setNamingSeries] = useState<string>("");
  const [seriesOptions, setSeriesOptions] = useState<string[]>([]);
  // Values copied from an existing document via Duplicate/Amend
  const [prefillDoc, setPrefillDoc] = useState<FrappeDocument | null>(null);

  // Consume Duplicate/Amend prefill handed over via sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem(PREFILL_KEY(doctype));
    if (!raw) return;
    sessionStorage.removeItem(PREFILL_KEY(doctype));
    try {
      const values = JSON.parse(raw) as Record<string, unknown>;
      if (values && typeof values === "object") {
        /* eslint-disable-next-line react-hooks/set-state-in-effect */ // one-time sessionStorage hand-off from Duplicate/Amend
        setPrefillDoc({ name: "", doctype, docstatus: 0, ...values });
      }
    } catch {
      // Ignore malformed prefill — start with a blank form
    }
  }, [doctype]);

  // Detect if this DocType uses naming_series
  const usesNamingSeries = meta?.autoname?.startsWith("naming_series:");

  // Fetch available naming series options when needed
  useEffect(() => {
    if (!usesNamingSeries || !doctype) return;

    async function fetchSeries() {
      try {
        const res = await fetch(
          `/api/frappe/api/method/frappe.model.get_series_options?` +
            new URLSearchParams({ doctype }),
        );
        if (!res.ok) return;
        const json = await res.json();
        const opts: string[] = Array.isArray(json?.message) ? json.message : [];
        setSeriesOptions(opts);
        if (opts.length > 0) setNamingSeries(opts[0]);
      } catch {
        // Ignore — naming series is optional
      }
    }
    fetchSeries();
  }, [doctype, usesNamingSeries]);

  const handleSave = async (values: Record<string, unknown>) => {
    const payload: Record<string, unknown> = { ...values };
    // Include naming_series in the document payload if applicable
    if (usesNamingSeries && namingSeries) {
      payload.naming_series = namingSeries;
    }

    const res = await fetch(`/api/doctype/${encodeURIComponent(doctype)}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || "Failed to save");
    }

    const json = await res.json();
    const newName = (json as { data?: { name?: string } }).data?.name || String(values.name ?? "");
    toast.success(`${doctype} created successfully`);
    router.push(
      `/desk/doctype/${encodeURIComponent(doctype)}/${encodeURIComponent(newName)}`,
    );
  };

  const handleCancel = () => router.back();

  if (metaLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" aria-label="Loading" />
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="p-6 text-sm text-red-600" role="alert">
        Failed to load DocType metadata.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            New {doctype}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Create a new {doctype} record
          </p>
        </div>
      </div>

      {/* Naming Series picker — shown only when DocType uses naming_series autoname */}
      {usesNamingSeries && seriesOptions.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center gap-4">
            <Label
              htmlFor="naming-series-select"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap"
            >
              Series
            </Label>
            <select
              id="naming-series-select"
              value={namingSeries}
              onChange={(e) => setNamingSeries(e.target.value)}
              aria-label="Naming series"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
            >
              {seriesOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span className="text-xs text-zinc-400">
              The document will be named using this series
            </span>
          </div>
        </div>
      )}

      <FormRenderer
        meta={meta}
        doc={prefillDoc}
        editable={true}
        readOnly={false}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}
