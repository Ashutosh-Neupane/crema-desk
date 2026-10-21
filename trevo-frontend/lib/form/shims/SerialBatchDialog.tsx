"use client";

/**
 * Self-contained dialog for erpnext.SerialBatchPackageSelector. Desk builds a frappe.ui.Dialog with an editable
 * Table field (`entries`: serial_no / batch_no / qty rows); Trevo's DeskDialog renders no Table fields (a dialog has
 * no child DocType meta, FormBody's Table control needs one), so the selector gets its own small React dialog,
 * mounted with react-dom/client into document.body. `SBDialog` mirrors the slice of the frappe.ui.Dialog API that
 * serial_no_batch_selector.js uses (get_value(s), set_value, fields_dict.entries.df.data, grid.refresh, hide).
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Loader2, Plus, X } from "lucide-react";
import { searchLink } from "@/lib/frappe/search";

export interface SBRow {
  serial_no?: string;
  batch_no?: string;
  qty?: number | string;
  name?: string;
  [k: string]: unknown;
}
export interface LinkQuery {
  query?: string;
  filters?: unknown;
}
export interface SBConfig {
  title: string;
  primaryLabel: string;
  secondaryLabel: string;
  itemCode: string;
  hasSerial: boolean;
  hasBatch: boolean;
  outward: boolean;
  /** "Serial Nos" / "Batch Nos" / "Serial Nos / Batch Nos" and the Add / Update prefix, for the CSV and manual section titles */
  csvTitle: string;
  manualTitle: string;
  workOrder?: string | null;
  warehouse?: string | null;
  basedOn?: string;
  onPrimary: () => unknown;
  onSecondary: () => unknown;
  /** Desk's per-field onchange / change hooks */
  on: Partial<Record<"warehouse" | "qty" | "based_on" | "scan_serial_no" | "scan_batch_no" | "serial_no_range" | "attach_serial_batch_csv" | "enter_manually" | "import_using_csv_file" | "download_csv" | "batch_row", (row?: SBRow) => unknown>>;
  warehouseQuery: () => LinkQuery;
  batchQuery: () => LinkQuery;
  serialQuery: () => LinkQuery;
}

type Listener = () => void;

export class SBDialog {
  values: Record<string, unknown> = {};
  version = 0;
  busy = false;
  csvName = "";
  uploading = false;
  private listeners = new Set<Listener>();
  private root?: Root;
  private host?: HTMLElement;
  /** frappe.ui.Dialog.fields_dict slice the selector touches */
  fields_dict: Record<string, { df: { data: SBRow[] }; grid: { refresh: () => void }; set_value: (v: unknown) => Promise<void> }>;

  constructor(readonly cfg: SBConfig) {
    const set = (f: string) => ({ df: { data: [] as SBRow[] }, grid: { refresh: () => this.touch() }, set_value: (v: unknown) => this.set_value(f, v) });
    this.fields_dict = { entries: set("entries"), scan_serial_no: set("scan_serial_no"), scan_batch_no: set("scan_batch_no") };
    this.values = {
      item_code: cfg.itemCode,
      warehouse: cfg.warehouse ?? "",
      based_on: cfg.basedOn,
      // get_attach_field (inward only)
      ...(cfg.outward ? {} : { enter_manually: cfg.hasSerial ? 1 : undefined, import_using_csv_file: !cfg.hasSerial ? 1 : 0 }),
    };
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
  getVersion = () => this.version;
  touch() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  has_field(f: string) {
    const c = this.cfg;
    switch (f) {
      case "qty":
      case "based_on":
        return c.outward;
      case "scan_serial_no":
        return c.hasSerial;
      case "scan_batch_no":
        return c.hasBatch && !c.hasSerial;
      case "enter_manually":
        return !c.outward && c.hasSerial;
      case "import_using_csv_file":
      case "attach_serial_batch_csv":
        return !c.outward;
      case "serial_no_range":
      case "upload_serial_nos":
        return !c.outward && c.hasSerial;
      default:
        return true;
    }
  }

  /** set without running the field's onchange (typing); onchange runs on blur */
  setLocal(f: string, v: unknown) {
    this.values = { ...this.values, [f]: v };
    this.touch();
  }

  setRow(i: number, patch: Partial<SBRow>) {
    const rows = this.fields_dict.entries.df.data;
    rows[i] = { ...rows[i], ...patch };
    this.touch();
  }
  addRow() {
    this.fields_dict.entries.df.data.push({});
    this.touch();
  }
  removeRow(i: number) {
    this.fields_dict.entries.df.data.splice(i, 1);
    this.touch();
  }
  setUploading(b: boolean) {
    this.uploading = b;
    this.touch();
  }

  get_value(f: string): unknown {
    if (f === "entries") return this.fields_dict.entries.df.data;
    return this.values[f];
  }
  get_values() {
    const entries = this.fields_dict.entries.df.data.filter((r) => r.serial_no || r.batch_no);
    return { ...this.values, entries };
  }
  /** frappe.ui.Dialog.set_value: set, refresh dependencies, run the field's onchange */
  async set_value(f: string, v: unknown) {
    if (!this.has_field(f)) return; // Desk: dialog.set_value on a field the dialog does not have is a no-op
    this.values = { ...this.values, [f]: v };
    this.touch();
    const h = this.cfg.on[f as keyof SBConfig["on"]];
    if (h && f !== "batch_row") await h();
  }

  show() {
    this.host = document.createElement("div");
    document.body.appendChild(this.host);
    this.root = createRoot(this.host);
    this.root.render(<SBView d={this} />);
  }
  hide() {
    const root = this.root;
    const host = this.host;
    this.root = this.host = undefined;
    // unmount outside the current React/handler turn
    setTimeout(() => {
      root?.unmount();
      host?.remove();
    });
  }
}

// ---- view -------------------------------------------------------------------------------------------------------

const input = "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 read-only:bg-zinc-100 read-only:dark:bg-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100";
const btn = "rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100";

/** Link control: text input + suggestions from frappe.desk.search.search_link (with the field's query/filters) */
function LinkInput({ value, doctype, getQuery, onCommit, label, readOnly, id }: { value: string; doctype: string; getQuery?: () => LinkQuery; onCommit: (v: string) => void; label: string; readOnly?: boolean; id: string }) {
  const [text, setText] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(value);
  }
  const [opts, setOpts] = useState<Array<{ value: string; description?: string }>>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const search = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      let query: LinkQuery | undefined;
      try {
        query = getQuery?.();
      } catch {
        query = undefined;
      }
      try {
        setOpts(await searchLink(doctype, q, { filters: query?.filters, query: query?.query, page_length: 20 }));
      } catch {
        setOpts([]);
      }
    }, 200);
  };
  return (
    <>
      <input
        id={id}
        aria-label={label}
        list={`${id}-opts`}
        className={input}
        value={text}
        readOnly={readOnly}
        autoComplete="off"
        onFocus={() => search(text)}
        onChange={(e) => {
          setText(e.target.value);
          search(e.target.value);
        }}
        onBlur={() => text !== value && onCommit(text)}
        onKeyDown={(e) => e.key === "Enter" && text !== value && onCommit(text)}
      />
      <datalist id={`${id}-opts`}>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.description}
          </option>
        ))}
      </datalist>
    </>
  );
}

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3 min-w-0 flex-1">
      <label htmlFor={htmlFor} className="mb-1 block text-xs text-zinc-500">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

function SBView({ d }: { d: SBDialog }) {
  useSyncExternalStore(d.subscribe, d.getVersion, d.getVersion);
  const c = d.cfg;
  const v = d.values;
  const rows = d.fields_dict.entries.df.data;
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => unknown) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      // frappe.throw already toasted; keep the dialog open like Desk
      console.warn("[serial-batch]", e);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // the topmost dialog closes first: leave Escape to the frappe.confirm dialog while it is open
      if (e.key === "Escape" && !document.querySelector('[role="dialog"][aria-label="Confirm"]')) d.hide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [d]);

  // depends_on of the Desk fields
  const manual = v.enter_manually === 1 || v.enter_manually === true;
  const csv = v.import_using_csv_file === 1 || v.import_using_csv_file === true;
  const showEnterManually = !c.outward && c.hasSerial && !csv;
  const showCsvCheck = !c.outward && !manual;
  const showTable = !manual || rows.length > 0;
  const setRow = (i: number, patch: Partial<SBRow>) => d.setRow(i, patch);
  const upload = async (file: File) => {
    d.setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("is_private", "1");
      const res = await fetch("/api/frappe/api/method/upload_file", { method: "POST", body: fd, credentials: "include" });
      const url = (await res.json())?.message?.file_url as string | undefined;
      if (!url) throw new Error("Upload failed");
      d.csvName = file.name;
      await d.set_value("attach_serial_batch_csv", url);
    } finally {
      d.setUploading(false);
    }
  };
  const id = (n: string) => `sb-${n}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-[8vh] backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && d.hide()}>
      <div role="dialog" aria-modal="true" aria-label={c.title} className="w-full max-w-3xl rounded-xl border border-zinc-200 bg-zinc-50 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
        <div className="flex items-center gap-2 px-5 py-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{c.title}</h2>
          <button type="button" onClick={() => d.hide()} aria-label="Close" className="ml-auto rounded-md p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5">
          {c.outward && (
            <div className="flex gap-4 border-b border-zinc-200 pb-2 dark:border-zinc-800">
              <Field label="Qty to Fetch" htmlFor={id("qty")}>
                <input
                  id={id("qty")}
                  type="number"
                  className={input}
                  value={String(v.qty ?? "")}
                  onChange={(e) => d.setLocal("qty", e.target.value === "" ? undefined : Number(e.target.value))}
                  onBlur={() => void c.on.qty?.()}
                />
              </Field>
              <Field label="Fetch Based On" htmlFor={id("based_on")}>
                <select id={id("based_on")} className={input} value={String(v.based_on ?? "FIFO")} onChange={(e) => void d.set_value("based_on", e.target.value)}>
                  {["FIFO", "LIFO", "Expiry"].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          <div className="flex gap-4 pt-3">
            <div className="flex min-w-0 flex-1 gap-4">
              <Field label="Item Code" htmlFor={id("item")}>
                <LinkInput id={id("item")} label="Item Code" doctype="Item" value={String(v.item_code ?? "")} readOnly onCommit={() => {}} />
              </Field>
              <Field label="Warehouse" htmlFor={id("warehouse")}>
                <LinkInput id={id("warehouse")} label="Warehouse" doctype="Warehouse" value={String(v.warehouse ?? "")} getQuery={c.warehouseQuery} onCommit={(x) => void d.set_value("warehouse", x)} />
              </Field>
            </div>
            <div className="min-w-0 flex-1">
              {c.workOrder !== undefined && c.workOrder !== null && (
                <Field label="For Work Order" htmlFor={id("wo")}>
                  <LinkInput id={id("wo")} label="For Work Order" doctype="Work Order" value={c.workOrder} readOnly onCommit={() => {}} />
                </Field>
              )}
              {c.hasSerial && (
                <Field label="Scan Serial No" htmlFor={id("scan_serial_no")}>
                  <input
                    id={id("scan_serial_no")}
                    className={input}
                    value={String(v.scan_serial_no ?? "")}
                    autoComplete="off"
                    onChange={(e) => d.setLocal("scan_serial_no", e.target.value)}
                    onBlur={() => v.scan_serial_no && void c.on.scan_serial_no?.()}
                    onKeyDown={(e) => e.key === "Enter" && v.scan_serial_no && void c.on.scan_serial_no?.()}
                  />
                </Field>
              )}
              {c.hasBatch && !c.hasSerial && (
                <Field label="Scan Batch No" htmlFor={id("scan_batch_no")}>
                  <input
                    id={id("scan_batch_no")}
                    className={input}
                    value={String(v.scan_batch_no ?? "")}
                    autoComplete="off"
                    onChange={(e) => d.setLocal("scan_batch_no", e.target.value)}
                    onBlur={() => v.scan_batch_no && void c.on.scan_batch_no?.()}
                    onKeyDown={(e) => e.key === "Enter" && v.scan_batch_no && void c.on.scan_batch_no?.()}
                  />
                </Field>
              )}
              {!c.outward && (
                <div className="flex gap-4 pb-2">
                  {showEnterManually && (
                    <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                      <input type="checkbox" checked={manual} onChange={(e) => void d.set_value("enter_manually", e.target.checked ? 1 : 0).then(() => (e.target.checked ? d.set_value("import_using_csv_file", 0) : undefined))} />
                      Enter Manually
                    </label>
                  )}
                  {showCsvCheck && (
                    <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                      <input type="checkbox" checked={csv} onChange={(e) => void d.set_value("import_using_csv_file", e.target.checked ? 1 : 0).then(() => (e.target.checked ? d.set_value("enter_manually", 0) : undefined))} />
                      Import Using CSV file
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>

          {!c.outward && csv && (
            <div className="mb-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">{c.csvTitle}</p>
              <div className="flex items-end gap-4">
                <button type="button" className={btn} onClick={() => void c.on.download_csv?.()}>
                  Download CSV Template
                </button>
                <Field label="Attach CSV File" htmlFor={id("csv")}>
                  <input id={id("csv")} type="file" accept=".csv" className="text-sm" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
                  {d.uploading && <Loader2 className="mt-1 h-4 w-4 animate-spin" />}
                </Field>
              </div>
            </div>
          )}

          {!c.outward && c.hasSerial && manual && (
            <div className="mb-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">{c.manualTitle}</p>
              <div className="flex gap-4">
                <Field label="Serial No Range" htmlFor={id("range")} hint={'"SN-01::10" for "SN-01" to "SN-10"'}>
                  <input
                    id={id("range")}
                    className={input}
                    value={String(v.serial_no_range ?? "")}
                    onChange={(e) => d.setLocal("serial_no_range", e.target.value)}
                    onBlur={() => void c.on.serial_no_range?.()}
                  />
                </Field>
                <Field label="Enter Serial Nos" htmlFor={id("serials")} hint="Enter each serial no in a new line">
                  <textarea id={id("serials")} rows={4} className={input} value={String(v.upload_serial_nos ?? "")} onChange={(e) => d.setLocal("upload_serial_nos", e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {showTable && (
            <div className="mb-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm" aria-label="Serial and Batch entries">
                <thead>
                  <tr className="bg-zinc-100 text-left text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                    <th className="w-10 px-2 py-1.5">No.</th>
                    {c.hasSerial && <th className="px-2 py-1.5">Serial No</th>}
                    {c.hasBatch && <th className="px-2 py-1.5">Batch No</th>}
                    {c.hasBatch && !c.hasSerial && <th className="px-2 py-1.5">Quantity</th>}
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${i}-${r.name ?? ""}`} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="px-2 py-1 text-zinc-500">{i + 1}</td>
                      {c.hasSerial && (
                        <td className="px-2 py-1">
                          <LinkInput id={id(`s${i}`)} label={`Serial No row ${i + 1}`} doctype="Serial No" value={String(r.serial_no ?? "")} getQuery={c.serialQuery} onCommit={(x) => setRow(i, { serial_no: x })} />
                        </td>
                      )}
                      {c.hasBatch && (
                        <td className="px-2 py-1">
                          <LinkInput
                            id={id(`b${i}`)}
                            label={`Batch No row ${i + 1}`}
                            doctype="Batch"
                            value={String(r.batch_no ?? "")}
                            getQuery={c.batchQuery}
                            onCommit={(x) => {
                              setRow(i, { batch_no: x });
                              void c.on.batch_row?.(d.fields_dict.entries.df.data[i]);
                            }}
                          />
                        </td>
                      )}
                      {c.hasBatch && !c.hasSerial && (
                        <td className="px-2 py-1">
                          <input aria-label={`Quantity row ${i + 1}`} type="number" className={input} value={String(r.qty ?? "")} onChange={(e) => setRow(i, { qty: e.target.value === "" ? undefined : Number(e.target.value) })} />
                        </td>
                      )}
                      <td className="px-1 py-1">
                        <button
                          type="button"
                          aria-label={`Delete row ${i + 1}`}
                          className="rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                          onClick={() => d.removeRow(i)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={5} className="px-2 py-4 text-center text-zinc-500">
                        No Data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="border-t border-zinc-200 p-2 dark:border-zinc-800">
                <button
                  type="button"
                  className={`${btn} inline-flex items-center gap-1`}
                  onClick={() => d.addRow()}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Row
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3">
          <button type="button" className={btn} onClick={() => void run(c.onSecondary)}>
            {c.secondaryLabel}
          </button>
          <button type="button" disabled={busy} onClick={() => void run(c.onPrimary)} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {c.primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
