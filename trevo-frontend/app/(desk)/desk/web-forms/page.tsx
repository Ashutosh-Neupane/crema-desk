"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { WebFormList } from "@/components/features/web-form";
import { WebFormBuilder } from "@/components/features/web-form";
import { toast } from "sonner";

/**
 * Web Forms page — /desk/web-forms
 *
 * - Default: shows WebFormList (list of all Web Form documents)
 * - ?edit=<name>: shows WebFormBuilder for that web form
 */
export default function WebFormsPage() {
  const searchParams = useSearchParams();
  const editName = searchParams.get("edit") ?? "";

  if (editName) return <WebFormBuilderView name={editName} />;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Web Forms</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Public-facing forms for external users
        </p>
      </div>
      <WebFormList />
    </div>
  );
}

// ─── Builder view ─────────────────────────────────────────────────────────────

function WebFormBuilderView({ name }: { name: string }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Load existing Web Form document
  const { data: webFormDoc, isLoading } = useQuery<Record<string, unknown>>({
    queryKey: ["web-form-doc", name],
    queryFn: async () => {
      const res = await fetch(`/api/web-form/${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error("Not found");
      return res.json() as Promise<Record<string, unknown>>;
    },
    staleTime: 30_000,
  });

  // Save draft
  const handleSave = useCallback(
    async (config: Parameters<typeof WebFormBuilder>[0]["initialConfig"]) => {
      if (!config) return;
      setSaving(true);
      try {
        const body = {
          title: config.title,
          description: config.description ?? "",
          doctype: config.doctype,
          web_form_fields: config.fields.map((f, idx) => ({
            fieldname: f.fieldname,
            label: f.label,
            fieldtype: f.fieldtype,
            reqd: f.required ? 1 : 0,
            idx,
          })),
          button_label: config.submitButtonLabel ?? "Submit",
          success_message: config.successMessage ?? "",
        };

        const res = await fetch(`/api/web-form/${encodeURIComponent(name)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error("Save failed");
        toast.success("Web form saved");
        qc.invalidateQueries({ queryKey: ["web-form-doc", name] });
        qc.invalidateQueries({ queryKey: ["web-forms"] });
      } catch (err) {
        toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        setSaving(false);
      }
    },
    [name, qc],
  );

  // Publish / Unpublish
  const togglePublish = useMutation({
    mutationFn: async (publish: boolean) => {
      const res = await fetch(`/api/web-form/${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: publish ? 1 : 0 }),
      });
      if (!res.ok) throw new Error("Failed to update publish status");
    },
    onSuccess: (_, publish) => {
      toast.success(publish ? "Web form published" : "Web form unpublished");
      qc.invalidateQueries({ queryKey: ["web-form-doc", name] });
      qc.invalidateQueries({ queryKey: ["web-forms"] });
    },
    onError: () => toast.error("Failed to update publish status"),
  });

  const isPublished = webFormDoc?.published === 1;

  // Build initialConfig from existing doc
  const initialConfig = webFormDoc
    ? {
        name: String(webFormDoc.name ?? name),
        title: String(webFormDoc.title ?? name),
        description: String(webFormDoc.description ?? ""),
        doctype: String(webFormDoc.doc_type ?? webFormDoc.doctype ?? ""),
        fields: (webFormDoc.web_form_fields as Array<Record<string, unknown>> ?? []).map((f) => ({
          fieldname: String(f.fieldname ?? ""),
          label: String(f.label ?? f.fieldname ?? ""),
          fieldtype: String(f.fieldtype ?? "Data"),
          required: f.reqd === 1,
        })),
        submitButtonLabel: String(webFormDoc.button_label ?? "Submit"),
        successMessage: String(webFormDoc.success_message ?? ""),
        published: isPublished,
      }
    : undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {webFormDoc?.title as string ?? name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Web Form — {webFormDoc?.doc_type as string}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/desk/web-forms"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← All Web Forms
          </Link>
          <button
            type="button"
            onClick={() => togglePublish.mutate(!isPublished)}
            disabled={togglePublish.isPending}
            className={[
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              isPublished
                ? "border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:bg-orange-900/20 dark:text-orange-300"
                : "border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300",
            ].join(" ")}
          >
            {togglePublish.isPending
              ? "Updating…"
              : isPublished
              ? "Unpublish"
              : "Publish"}
          </button>
          <Link
            href={`/api/web-form/${encodeURIComponent(name)}/submissions`}
            target="_blank"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            View Submissions ↗
          </Link>
        </div>
      </div>

      {isPublished && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
          This form is published and publicly accessible.{" "}
          <Link
            href={`/${name}`}
            target="_blank"
            className="underline hover:no-underline"
          >
            View live form ↗
          </Link>
        </div>
      )}

      <WebFormBuilder
        initialConfig={initialConfig}
        onSave={handleSave}
        onPublish={(cfg) => { handleSave(cfg); togglePublish.mutate(true); }}
      />

      {saving && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">
          Saving…
        </div>
      )}
    </div>
  );
}
