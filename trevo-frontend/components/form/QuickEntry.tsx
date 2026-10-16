"use client";

/**
 * Quick Entry modal — port of Desk's frappe.ui.form.QuickEntryForm
 * (frappe/public/js/frappe/form/quick_entry.js): for DocTypes with
 * `quick_entry` that aren't submittable, show only mandatory +
 * allow_in_quick_entry fields in a dialog; fall back to the full form
 * when there are mandatory tables or too many fields.
 */
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Maximize2, X } from "lucide-react";
import FormRenderer, { type FormHandle } from "@/lib/trevo-form/renderers/FormRenderer";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { getNewDoc } from "@/lib/trevo-form/newDoc";
import { saveDoc, type Doc } from "@/lib/frappe/form";
import { PREFILL_KEY } from "@/components/DocumentActions";
import type { DocField, DocTypeMeta, FrappeDocument } from "@/lib/frappe/types";

const LAYOUT = new Set(["Section Break", "Column Break", "Tab Break", "Fold", "HTML", "Button", "Heading"]);

function quickFields(meta: DocTypeMeta): DocField[] {
  return (meta.fields ?? []).filter(
    (f) => !LAYOUT.has(f.fieldtype) && !f.hidden && !f.read_only && (f.allow_in_quick_entry || (f.reqd && !f.default)),
  );
}

/** Desk's QuickEntryForm.is_quick_entry() */
export function canQuickEntry(meta: DocTypeMeta): boolean {
  if (!meta.quick_entry || meta.is_submittable || meta.issingle || meta.istable) return false;
  const fields = quickFields(meta);
  if (fields.some((f) => f.fieldtype === "Table" || f.fieldtype === "Table MultiSelect")) return false;
  if ((meta.fields ?? []).some((f) => f.reqd && (f.fieldtype === "Table" || f.fieldtype === "Table MultiSelect"))) return false;
  return fields.length > 0 && fields.length <= 7;
}

export default function QuickEntry({
  meta,
  onClose,
  onCreated,
  initial,
}: {
  meta: DocTypeMeta;
  onClose: () => void;
  onCreated: (name: string, doc: Doc) => void;
  /** values to start with (e.g. the text typed into a Link field) */
  initial?: Record<string, unknown>;
}) {
  const router = useRouter();
  const { data: ctx } = useDeskContext();
  const formRef = useRef<FormHandle>(null);
  const [busy, setBusy] = useState(false);

  const promptName = meta.autoname === "Prompt";
  const quickMeta = useMemo<DocTypeMeta>(() => {
    const fields = quickFields(meta);
    const nameField: DocField[] = promptName ? [{ fieldname: "__newname", label: `${meta.name} Name`, fieldtype: "Data", reqd: 1 } as DocField] : [];
    return { ...meta, fields: [...nameField, ...fields] };
  }, [meta, promptName]);

  const doc = useMemo(() => (ctx ? ({ ...getNewDoc(meta, ctx), ...initial } as Doc) : null), [meta, ctx, initial]);

  const save = async (values: Record<string, unknown>) => {
    if (!doc) return;
    const { doc: saved } = await saveDoc({ ...doc, ...values } as Doc, "Save");
    onCreated(saved.name, saved);
  };

  const onSave = async () => {
    setBusy(true);
    try {
      const ok = await formRef.current?.save();
      if (ok === false) toast.error("Please fill all mandatory fields");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save", { duration: 8000 });
    } finally {
      setBusy(false);
    }
  };

  const fullForm = () => {
    const values = formRef.current?.getValues() ?? {};
    sessionStorage.setItem(PREFILL_KEY(meta.name), JSON.stringify({ ...initial, ...values }));
    router.push(`/desk/doctype/${encodeURIComponent(meta.name)}/new`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-[10vh] backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`New ${meta.name}`}
    >
      <div className="w-full max-w-xl rounded-xl border border-zinc-200 bg-zinc-50 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
        <div className="flex items-center gap-2 px-5 py-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">New {meta.name}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto rounded-md p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-3" onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && void onSave()}>
          {doc && <FormRenderer formRef={formRef} hideActions meta={quickMeta} doc={doc as unknown as FrappeDocument} onSave={save} />}
        </div>
        <div className="flex items-center gap-2 px-5 py-3">
          <button type="button" onClick={fullForm} className="inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            <Maximize2 className="h-3.5 w-3.5" /> Edit full form
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
