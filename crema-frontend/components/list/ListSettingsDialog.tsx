"use client";

/**
 * "List Settings" dialog — transcribed from frappe/public/js/frappe/list/list_settings.js:
 *  - the List View Settings doctype's checks (Disable Count, Disable Comment Count, Disable Sidebar Stats, …)
 *  - the column list (reorder, width in px, remove; "+ Add / Remove Fields" picker with "Reset Fields")
 *  - Save → frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings
 *    { doctype, listview_settings: { …checks, fields: JSON }, removed_listview_fields }
 *  - Reset Fields → …list_view_settings.get_default_listview_fields
 * Default column set when no settings exist yet: set_list_view_fields (subject, Status, in_list_view fields).
 */
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { Checkbox } from "@/components/shadcn/checkbox";
import { NO_VALUE } from "@/components/list/filters";
import { deskCall } from "@/lib/frappe/form";
import { parseColumnSettings, type ListColumnSetting, type ListViewSettingsDoc } from "@/lib/list/useListViewSettings";
import type { DocTypeMeta } from "@/lib/frappe/types";

const CHECKS: Array<[keyof ListViewSettingsDoc, string]> = [
  ["disable_count", "Disable Count"],
  ["disable_sidebar_stats", "Disable Sidebar Stats"],
  ["disable_auto_refresh", "Disable Auto Refresh"],
  ["disable_comment_count", "Disable Comment Count"],
  ["allow_edit", "Allow Bulk Editing"],
  ["disable_automatic_recency_filters", "Disable Automatic Recency Filters"],
  ["disable_scrolling", "Disable Scrolling"],
  ["show_tags", "Show Tags"],
];
const MAX_FIELDS = 50;

export function defaultColumns(meta: DocTypeMeta, hasIndicator: boolean): ListColumnSetting[] {
  const title = typeof meta.title_field === "string" ? meta.title_field.trim() : "";
  const tf = title ? meta.fields?.find((f) => f.fieldname === title) : undefined;
  const subject = tf ? { fieldname: tf.fieldname, label: tf.label ?? tf.fieldname } : { fieldname: "name", label: "ID" };
  const out: ListColumnSetting[] = [subject];
  if (hasIndicator) out.push({ fieldname: "status_field", label: "Status" });
  for (const f of meta.fields ?? []) {
    if (f.in_list_view && !NO_VALUE.has(f.fieldtype) && f.fieldname !== subject.fieldname && !(hasIndicator && f.fieldname === "status")) out.push({ fieldname: f.fieldname, label: f.label ?? f.fieldname });
  }
  return out;
}

export default function ListSettingsDialog({
  meta,
  settings,
  hasIndicator,
  onClose,
  onSaved,
}: {
  meta: DocTypeMeta;
  settings: ListViewSettingsDoc | null;
  hasIndicator: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const doctype = meta.name;
  const initial = useMemo(() => {
    const saved = parseColumnSettings(settings);
    return saved.length ? saved : defaultColumns(meta, hasIndicator);
  }, [settings, meta, hasIndicator]);
  const [fields, setFields] = useState<ListColumnSetting[]>(initial);
  const [checks, setChecks] = useState<Record<string, number>>(() => Object.fromEntries(CHECKS.map(([k]) => [k, Number(settings?.[k] ?? 0)])));
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const subject = fields[0]?.fieldname;
  const pickable = useMemo(() => (meta.fields ?? []).filter((f) => !NO_VALUE.has(f.fieldtype) && f.fieldname), [meta]);

  const move = (i: number, d: number) =>
    setFields((fs) => {
      const j = i + d;
      if (i < 1 || j < 1 || j >= fs.length) return fs; // the subject column stays first
      const n = [...fs];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const openPicker = () => {
    setPicked(new Set(fields.map((f) => f.fieldname)));
    setPicking(true);
  };
  // column_selector Save: subject first, Status kept, then the ticked fields (existing widths survive)
  const applyPicker = () => {
    const keep = new Map(fields.map((f) => [f.fieldname, f]));
    const next: ListColumnSetting[] = [fields[0]];
    if (hasIndicator && keep.has("status_field")) next.push(keep.get("status_field")!);
    for (const f of pickable) {
      if (next.length >= MAX_FIELDS) break;
      if (picked.has(f.fieldname) && f.fieldname !== subject) next.push(keep.get(f.fieldname) ?? { fieldname: f.fieldname, label: f.label ?? f.fieldname });
    }
    setFields(next);
    setPicking(false);
  };
  const resetPicker = async () => {
    try {
      const { env } = await deskCall("frappe.desk.doctype.list_view_settings.list_view_settings.get_default_listview_fields", { doctype });
      setPicked(new Set((env.message as string[]) ?? []));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const final = fields.map((f) => ({ fieldname: f.fieldname, label: f.label ?? f.fieldname, ...(f.width ? { width: f.width } : {}) }));
      const finalNames = new Set(final.map((f) => f.fieldname));
      const removed = initial.map((f) => f.fieldname).filter((n) => !finalNames.has(n));
      await deskCall("frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings", {
        doctype,
        listview_settings: { ...checks, fields: JSON.stringify(final) },
        removed_listview_fields: removed,
      });
      toast.success("Saved");
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{doctype === "List View Settings" ? "List View Settings" : `${doctype} List View Settings`}</DialogTitle>
        </DialogHeader>

        {picking ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Select Fields (Up to {MAX_FIELDS})</span>
              <button type="button" onClick={resetPicker} className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Reset Fields</button>
            </div>
            <div className="grid max-h-72 grid-cols-2 gap-1 overflow-y-auto">
              {pickable.map((f) => (
                <label key={f.fieldname} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                  <Checkbox
                    checked={picked.has(f.fieldname) || f.fieldname === subject}
                    disabled={f.fieldname === subject}
                    onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(f.fieldname); else n.delete(f.fieldname); return n; })}
                    aria-label={`Field ${f.label ?? f.fieldname}`}
                  />
                  {f.label ?? f.fieldname}
                </label>
              ))}
            </div>
            <DialogFooter>
              <button type="button" onClick={() => setPicking(false)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700">Cancel</button>
              <button type="button" onClick={applyPicker} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">Apply</button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {CHECKS.map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                  <Checkbox checked={!!checks[k]} onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked ? 1 : 0 }))} aria-label={label} />
                  {label}
                </label>
              ))}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                <span>Fields</span>
                <button type="button" onClick={openPicker} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">+ Add / Remove Fields</button>
              </div>
              <ul aria-label="List columns" className="space-y-1">
                {fields.map((f, i) => (
                  <li key={f.fieldname} data-fieldname={f.fieldname} className="flex items-center gap-2 rounded-md border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-700">
                    <span className="flex-1 truncate">{f.label ?? f.fieldname}</span>
                    <input
                      inputMode="numeric"
                      aria-label={`Width of ${f.label ?? f.fieldname}`}
                      placeholder="px"
                      value={f.width ?? ""}
                      onChange={(e) => setFields((fs) => fs.map((x, j) => (j === i ? { ...x, width: parseInt(e.target.value, 10) || undefined } : x)))}
                      className="h-6 w-14 rounded border border-zinc-200 bg-transparent px-1 text-right text-xs dark:border-zinc-700"
                    />
                    {i > 0 && (
                      <>
                        <button type="button" aria-label={`Move ${f.label ?? f.fieldname} up`} onClick={() => move(i, -1)} className="text-zinc-400 hover:text-zinc-700"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label={`Move ${f.label ?? f.fieldname} down`} onClick={() => move(i, 1)} className="text-zinc-400 hover:text-zinc-700"><ArrowDown className="h-3.5 w-3.5" /></button>
                      </>
                    )}
                    {i > 0 && f.fieldname !== "status_field" && (
                      <button type="button" aria-label={`Remove ${f.label ?? f.fieldname}`} onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))} className="text-zinc-400 hover:text-zinc-700"><X className="h-3.5 w-3.5" /></button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <DialogFooter>
              <button type="button" onClick={onClose} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700">Cancel</button>
              <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">Save</button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
