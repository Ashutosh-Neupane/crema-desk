"use client";

/**
 * Query report dialogs. Desk: query_report.js get_menu_items → "Save" (frappe.ui.Dialog "Save Report")
 * and "PDF" (frappe.ui.get_print_settings(…, is_query_report) "PDF Settings" prompt).
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";

const field = "mt-1 h-8 w-full rounded-md border border-zinc-200 bg-transparent px-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700";
const btn = "inline-flex h-8 items-center justify-center rounded-lg px-3 text-sm font-medium disabled:opacity-50";
const primary = `${btn} bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white`;
const secondary = `${btn} border border-zinc-200 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800`;

export function SaveReportDialog({ open, onClose, defaultName, busy, onSave }: { open: boolean; onClose: () => void; defaultName: string; busy: boolean; onSave: (name: string) => void }) {
  const [name, setName] = useState(defaultName);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onSave(name.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>Save Report</DialogTitle>
          </DialogHeader>
          <label className="block text-sm text-zinc-700 dark:text-zinc-300" htmlFor="qr-save-name">
            Report Name <span className="text-red-500">*</span>
          </label>
          <input id="qr-save-name" className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          <DialogFooter>
            <button type="button" className={secondary} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={primary} disabled={busy || !name.trim()}>
              {busy ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface PdfSettings {
  orientation: "Landscape" | "Portrait";
  includeFilters: boolean;
  /** fieldnames to print; null = all visible columns */
  columns: string[] | null;
}

export function PdfSettingsDialog({ open, onClose, columns, busy, onSubmit }: { open: boolean; onClose: () => void; columns: Array<{ fieldname: string; label: string }>; busy: boolean; onSubmit: (s: PdfSettings) => void }) {
  const [orientation, setOrientation] = useState<PdfSettings["orientation"]>("Landscape");
  const [includeFilters, setIncludeFilters] = useState(true);
  const [pick, setPick] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(columns.map((c) => c.fieldname)));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ orientation, includeFilters, columns: pick ? columns.filter((c) => chosen.has(c.fieldname)).map((c) => c.fieldname) : null });
          }}
        >
          <DialogHeader>
            <DialogTitle>PDF Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
            <div>
              <label htmlFor="qr-pdf-orientation">Orientation</label>
              <select id="qr-pdf-orientation" className={field} value={orientation} onChange={(e) => setOrientation(e.target.value as PdfSettings["orientation"])}>
                <option value="Landscape">Landscape</option>
                <option value="Portrait">Portrait</option>
              </select>
              {orientation === "Portrait" && columns.length > 10 && <p className="mt-1 text-xs text-zinc-500">Report with more than 10 columns looks better in Landscape mode.</p>}
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeFilters} onChange={(e) => setIncludeFilters(e.target.checked)} /> Include filters
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={pick} onChange={(e) => setPick(e.target.checked)} /> Pick Columns
            </label>
            {pick && (
              <div className="grid max-h-48 grid-cols-2 gap-1 overflow-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-700">
                {columns.map((c) => (
                  <label key={c.fieldname} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={chosen.has(c.fieldname)}
                      onChange={() =>
                        setChosen((s) => {
                          const n = new Set(s);
                          if (n.has(c.fieldname)) n.delete(c.fieldname);
                          else n.add(c.fieldname);
                          return n;
                        })
                      }
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <button type="button" className={secondary} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={primary} disabled={busy}>
              {busy ? "Generating PDF…" : "Download PDF"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
