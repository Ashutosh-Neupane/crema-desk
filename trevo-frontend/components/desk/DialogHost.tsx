"use client";

/** Renders frappe.ui.Dialog / frappe.prompt / frappe.confirm opened by app scripts. */
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import FormBody from "@/components/form/FormBody";
import { dialogStore, type DeskDialog } from "@/lib/desk-runtime/dialogs";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";

const EMPTY: DeskDialog[] = [];

// `version` re-renders the view when the dialog's values change (same DeskDialog object)
function DialogView({ d }: { d: DeskDialog; version: number }) {
  const [busy, setBusy] = useState(false);
  let breaks = 0;
  const meta = {
    name: d.opts.title ?? "Dialog",
    fields: d.flatFields().map((f) => ({ ...f, fieldname: f.fieldname ?? `__break_${breaks++}` }) as DocField),
  } as DocTypeMeta;
  const width = d.opts.size === "extra-large" ? "max-w-4xl" : d.opts.size === "large" ? "max-w-2xl" : "max-w-lg";

  const primary = async () => {
    setBusy(true);
    try {
      await d.runPrimary();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-[10vh] backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && !d.opts.static && d.hide()}>
      <div role="dialog" aria-modal="true" aria-label={d.opts.title} className={`w-full ${width} rounded-xl border border-zinc-200 bg-zinc-50 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950`}>
        <div className="flex items-center gap-2 px-5 py-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{d.opts.title}</h2>
          <button type="button" onClick={() => d.hide()} aria-label="Close" className="ml-auto rounded-md p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5" onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && void primary()}>
          {/* frappe.confirm/msgprint HTML comes from the app's own scripts (Desk renders it as HTML too) */}
          {/* react-doctor-disable-next-line dangerous-html-sink */}
          {d.opts.message && <p className="pb-2 text-sm text-zinc-700 dark:text-zinc-200" dangerouslySetInnerHTML={{ __html: d.opts.message }} />}
          {meta.fields.length > 0 && (
            <FormBody meta={meta} values={d.values} errors={d.errors} onChange={(f, v) => void d.set_value(f, v)} compact />
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3">
          {d.opts.secondary_action_label && (
            <button type="button" onClick={() => void d.opts.secondary_action?.()} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100">
              {d.opts.secondary_action_label}
            </button>
          )}
          {d.opts.primary_action && (
            <button type="button" onClick={() => void primary()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {d.opts.primary_action_label ?? "Submit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DialogHost() {
  const dialogs = useSyncExternalStore(dialogStore.subscribe, dialogStore.get, () => EMPTY);
  // Desk's router hides open dialogs on navigation (scripts rely on it after set_route)
  const pathname = usePathname();
  useEffect(() => {
    for (const d of dialogStore.get()) d.hide();
  }, [pathname]);
  return (
    <>
      {dialogs.map((d) => (
        <DialogView key={d.id} d={d} version={d.version} />
      ))}
    </>
  );
}
