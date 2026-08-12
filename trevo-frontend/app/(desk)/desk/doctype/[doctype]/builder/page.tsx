"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDoctype } from "@/lib/hooks/useDoctype";
import { FormBuilder, type BuilderLayoutSection } from "@/components/features/form-builder";
import { Card } from "@/components/shadcn/card";
import { Skeleton } from "@/components/Skeleton";
import { toast } from "sonner";
import Link from "next/link";

/**
 * Form Builder page — /desk/doctype/[doctype]/builder
 *
 * Wires FormBuilder to frappe.client.save on the Custom Form doctype so
 * layout changes persist in Frappe.
 *
 * Load path:  GET /api/doctype/[doctype]/builder  →  frappe.client.get Custom Form
 * Save path:  POST /api/doctype/[doctype]/builder  →  frappe.client.save Custom Form
 */
export default function FormBuilderPage() {
  const params = useParams<{ doctype: string }>();
  const doctype = decodeURIComponent(params.doctype);
  const queryClient = useQueryClient();
  const { data: meta, isLoading: metaLoading } = useDoctype(doctype);
  const [saving, setSaving] = useState(false);

  // Fetch existing Custom Form customizations
  const { data: existingCustomForm, isLoading: cfLoading } = useQuery({
    queryKey: ["custom-form", doctype],
    queryFn: async () => {
      const res = await fetch(
        `/api/frappe/api/resource/Custom Form/${encodeURIComponent(doctype)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return null;
      const json = await res.json() as { data?: Record<string, unknown> };
      return json.data ?? null;
    },
    retry: false,
  });

  // Build initial sections from Custom Form fields
  const initialSections = useMemo<BuilderLayoutSection[] | undefined>(() => {
    if (!existingCustomForm) return undefined;
    const rawFields = (existingCustomForm.fields as Array<{
      fieldname?: string;
      label?: string;
      fieldtype?: string;
      reqd?: number;
      hidden?: number;
      read_only?: number;
      description?: string;
    }>) ?? [];

    const section: BuilderLayoutSection = {
      id: "section-1",
      name: "Main Section",
      columns: [{ id: "col-1", fields: rawFields.map((f) => ({
        fieldname: f.fieldname ?? "",
        label: f.label ?? f.fieldname ?? "",
        fieldtype: f.fieldtype ?? "Data",
        required: f.reqd === 1,
        hidden: f.hidden === 1,
        read_only: f.read_only === 1,
        description: f.description ?? undefined,
      })) }],
    };
    return [section];
  }, [existingCustomForm]);

  const handleSave = useCallback(
    async (layout: BuilderLayoutSection[]) => {
      setSaving(true);
      try {
        // Flatten sections → fields array in Frappe Custom Form format
        const fields = layout.flatMap((section) => [
          { fieldtype: "Section Break", label: section.name },
          ...section.columns.flatMap((col, colIdx) => [
            ...(colIdx > 0 ? [{ fieldtype: "Column Break" }] : []),
            ...col.fields.map((f) => ({
              fieldname: f.fieldname,
              label: f.label,
              fieldtype: f.fieldtype,
              reqd: f.required ? 1 : 0,
              hidden: f.hidden ? 1 : 0,
              read_only: f.read_only ? 1 : 0,
              description: f.description ?? "",
            })),
          ]),
        ]);

        const res = await fetch(`/api/frappe/api/resource/Custom Form`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dt: doctype, fields }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { exc?: string };
          throw new Error(err.exc ?? "Save failed");
        }

        toast.success("Form customizations saved");
      } catch (err) {
        toast.error(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [doctype],
  );

  const handleReset = useCallback(async () => {
    if (!confirm("Reset all customizations for this form? This cannot be undone.")) return;
    try {
      await fetch(`/api/frappe/api/resource/Custom Form/${encodeURIComponent(doctype)}`, {
        method: "DELETE",
      });
      toast.success("Customizations reset");
      queryClient.setQueryData(["custom-form", doctype], null);
    } catch {
      toast.error("Failed to reset customizations");
    }
  }, [doctype, queryClient]);

  const isLoading = metaLoading || cfLoading;

  const fields = (meta?.fields ?? [])
    .filter((f) => !["Section Break", "Column Break", "Tab Break", "Heading"].includes(f.fieldtype))
    .map((f) => ({
      fieldname: f.fieldname,
      label: (f.label ?? f.fieldname) as string,
      fieldtype: f.fieldtype,
      options: (f.options ?? undefined) as string | undefined,
      required: f.reqd === 1,
      hidden: f.hidden === 1,
      read_only: f.read_only === 1,
      description: f.description ?? undefined,
    })) as Parameters<typeof FormBuilder>[0]["initialFields"];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Card className="p-6"><Skeleton className="h-96 w-full" /></Card>
      </div>
    );
  }

  if (!meta) {
    return <div className="p-6 text-sm text-red-600" role="alert">DocType not found.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Form Builder</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Customizing layout for <strong>{doctype}</strong>
            {existingCustomForm && (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                Custom form active
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/desk/doctype/${encodeURIComponent(doctype)}`}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← Back to List
          </Link>
          {existingCustomForm && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
            >
              Reset to Default
            </button>
          )}
        </div>
      </div>

      <FormBuilder
        doctype={doctype}
        initialFields={fields}
        initialSections={initialSections}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}
