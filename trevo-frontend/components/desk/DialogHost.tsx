"use client";

/** Renders frappe.ui.Dialog / frappe.prompt / frappe.confirm opened by app scripts. */
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import FormBody from "@/components/form/FormBody";
import HtmlHost from "@/components/form/HtmlHost";
import DialogTable from "@/components/desk/DialogTable";
import { dialogStore, type DeskDialog, type DialogField } from "@/lib/desk-runtime/dialogs";
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
  const ind = typeof d.opts.indicator === "string" ? { color: d.opts.indicator, label: "" } : d.opts.indicator;
  const dot = ({ green: "bg-green-500", red: "bg-red-500", orange: "bg-orange-500", yellow: "bg-yellow-500", blue: "bg-blue-500", purple: "bg-purple-500", gray: "bg-zinc-400", grey: "bg-zinc-400" } as Record<string, string>)[ind?.color ?? ""] ?? "bg-zinc-400";
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
          {ind && (
            <span className="indicator inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              <span className={`h-2 w-2 rounded-full ${dot}`} />
              {ind.label}
            </span>
          )}
          <button type="button" onClick={() => d.hide()} aria-label="Close" className="ml-auto rounded-md p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5" onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && void primary()}>
          {/* frappe.confirm/msgprint HTML comes from the app's own scripts (Desk renders it as HTML too) */}
          {/* react-doctor-disable-next-line dangerous-html-sink */}
          {d.opts.message && <p className="pb-2 text-sm text-zinc-700 dark:text-zinc-200" dangerouslySetInnerHTML={{ __html: d.opts.message }} />}
          {meta.fields.length > 0 && (
            <FormBody meta={meta} values={d.values} errors={d.errors} onChange={(f, v) => void d.set_value(f, v)}
              compact
              renderTable={(df) => <DialogTable d={d} df={df as unknown as DialogField} />}
              renderHtml={(df) => <HtmlHost el={d.htmlWrapper(df.fieldname)} html={typeof df.options === "string" ? df.options : null} />}
              getQuery={(f) => () => d.fields_dict[f]?.df.get_query?.call(d.fields_dict[f])}
              onButton={(f) => void d.fields_dict[f]?.df.click?.call(d.fields_dict[f])}
            />
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3">
          {d.customActions.map((a, i) => (
            <button key={`${i}-${a.label}`} type="button" onClick={() => void a.action?.call(d)} className="mr-auto rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100">
              {a.label}
            </button>
          ))}
          {d.opts.secondary_action_label && (
            <button type="button" onClick={() => void d.opts.secondary_action?.()} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100">
              {d.opts.secondary_action_label}
            </button>
          )}
          {d.opts.primary_action && (
            <button type="button" onClick={() => void primary()} disabled={busy || d.primaryDisabled} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
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
  // Escape closes the topmost dialog, like Desk's bootstrap modals (static dialogs stay open)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const top = dialogStore.get().at(-1);
      if (top && !top.opts.static) top.hide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      {dialogs.map((d) => (
        <DialogView key={d.id} d={d} version={d.version} />
      ))}
    </>
  );
}
