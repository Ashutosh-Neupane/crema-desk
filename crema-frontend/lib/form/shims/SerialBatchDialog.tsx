"use client";

/**
 * Self-contained dialog for erpnext.SerialBatchPackageSelector. Desk builds a frappe.ui.Dialog with an editable
 * Table field (`entries`: serial_no / batch_no / qty rows); Crema's DeskDialog renders no Table fields (a dialog has
 * no child DocType meta, FormBody's Table control needs one), so the selector gets its own small React dialog,
 * mounted with react-dom/client into document.body. `SBDialog` mirrors the slice of the frappe.ui.Dialog API that
 * serial_no_batch_selector.js uses (get_value(s), set_value, fields_dict.entries.df.data, grid.refresh, hide).
 */
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
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
  /** stable React keys for the entries rows (rows carry no id until saved; the selector also replaces df.data) */
  private rowKeys = new WeakMap<SBRow, number>();
  private nextRowKey = 0;
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

  rowKey(row: SBRow): number {
    let k = this.rowKeys.get(row);
    if (k === undefined) {
      k = this.nextRowKey++;
      this.rowKeys.set(row, k);
    }
    return k;
  }

  setRow(i: number, patch: Partial<SBRow>) {
    const rows = this.fields_dict.entries.df.data;
    const next = { ...rows[i], ...patch };
    this.rowKeys.set(next, this.rowKey(rows[i]));
    rows[i] = next;
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

/** the dialog's two checkboxes are exclusive (Desk enter_manually / import_using_csv_file onchange) */
async function toggleExclusive(d: SBDialog, field: string, other: string, checked: boolean) {
  await d.set_value(field, checked ? 1 : 0);
  if (checked) await d.set_value(other, 0);
}

/** upload the CSV through upload_file, then set attach_serial_batch_csv (Desk Attach control) */
async function uploadCsv(d: SBDialog, file: File) {
  d.setUploading(true);
  try {
    const fd = new FormData();
    fd.append("file", file, file.name);
    fd.append("is_private", "1");
    const res = await fetch("/api/frappe/api/method/upload_file", { method: "POST", body: fd, credentials: "include" });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    const url = (await res.json())?.message?.file_url as string | undefined;
    if (!url) throw new Error("Upload failed");
    d.csvName = file.name;
    await d.set_value("attach_serial_batch_csv", url);
  } finally {
    d.setUploading(false);
  }
}

const sbId = (n: string) => `sb-${n}`;
const isChecked = (x: unknown) => x === 1 || x === true;
const FOCUSABLE = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Desk's bootstrap modal behaviour: Escape and a backdrop click close the dialog (the topmost dialog first, so Escape
 * is left to a frappe.confirm dialog while one is open), and focus moves into the dialog when it opens.
 */
function useModalDialog(d: SBDialog, backdrop: RefObject<HTMLDivElement | null>, panel: RefObject<HTMLElement | null>) {
  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"][aria-label="Confirm"]')) d.hide();
    };
    const onDown = (e: MouseEvent) => {
      if (e.target === backdrop.current) d.hide();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [d, backdrop, panel]);
}

/** focus trap: Tab / Shift+Tab cycle through the dialog's controls instead of leaving the modal */
function trapFocus(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== "Tab") return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === e.currentTarget)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

function OutwardFields({ d }: { d: SBDialog }) {
  const v = d.values;
  return (
    <div className="flex gap-4 border-b border-zinc-200 pb-2 dark:border-zinc-800">
      <Field label="Qty to Fetch" htmlFor={sbId("qty")}>
        <input
          id={sbId("qty")}
          type="number"
          className={input}
          value={String(v.qty ?? "")}
          onChange={(e) => d.setLocal("qty", e.target.value === "" ? undefined : Number(e.target.value))}
          onBlur={() => void d.cfg.on.qty?.()}
        />
      </Field>
      <Field label="Fetch Based On" htmlFor={sbId("based_on")}>
        <select id={sbId("based_on")} className={input} value={String(v.based_on ?? "FIFO")} onChange={(e) => void d.set_value("based_on", e.target.value)}>
          {["FIFO", "LIFO", "Expiry"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Field>
    </div>
  );
}

/** a Data field whose onchange runs on blur / Enter once it has a value (Desk scan_serial_no / scan_batch_no) */
function ScanField({ d, field, label }: { d: SBDialog; field: "scan_serial_no" | "scan_batch_no"; label: string }) {
  const value = d.values[field];
  const fire = () => value && void d.cfg.on[field]?.();
  return (
    <Field label={label} htmlFor={sbId(field)}>
      <input id={sbId(field)} className={input} value={String(value ?? "")} autoComplete="off" onChange={(e) => d.setLocal(field, e.target.value)} onBlur={fire} onKeyDown={(e) => e.key === "Enter" && fire()} />
    </Field>
  );
}

/** inward only: Enter Manually / Import Using CSV file (each hidden while the other is ticked, Desk depends_on) */
function InwardChecks({ d, manual, csv }: { d: SBDialog; manual: boolean; csv: boolean }) {
  return (
    <div className="flex gap-4 pb-2">
      {d.cfg.hasSerial && !csv && (
        <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
          <input type="checkbox" checked={manual} onChange={(e) => void toggleExclusive(d, "enter_manually", "import_using_csv_file", e.target.checked)} />
          Enter Manually
        </label>
      )}
      {!manual && (
        <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
          <input type="checkbox" checked={csv} onChange={(e) => void toggleExclusive(d, "import_using_csv_file", "enter_manually", e.target.checked)} />
          Import Using CSV file
        </label>
      )}
    </div>
  );
}

function SideFields({ d, manual, csv }: { d: SBDialog; manual: boolean; csv: boolean }) {
  const c = d.cfg;
  return (
    <div className="min-w-0 flex-1">
      {c.workOrder !== undefined && c.workOrder !== null && (
        <Field label="For Work Order" htmlFor={sbId("wo")}>
          <LinkInput id={sbId("wo")} label="For Work Order" doctype="Work Order" value={c.workOrder} readOnly onCommit={() => {}} />
        </Field>
      )}
      {c.hasSerial && <ScanField d={d} field="scan_serial_no" label="Scan Serial No" />}
      {c.hasBatch && !c.hasSerial && <ScanField d={d} field="scan_batch_no" label="Scan Batch No" />}
      {!c.outward && <InwardChecks d={d} manual={manual} csv={csv} />}
    </div>
  );
}

function CsvSection({ d }: { d: SBDialog }) {
  return (
    <div className="mb-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">{d.cfg.csvTitle}</p>
      <div className="flex items-end gap-4">
        <button type="button" className={btn} onClick={() => void d.cfg.on.download_csv?.()}>
          Download CSV Template
        </button>
        <Field label="Attach CSV File" htmlFor={sbId("csv")}>
          <input id={sbId("csv")} type="file" accept=".csv" className="text-sm" onChange={(e) => e.target.files?.[0] && void uploadCsv(d, e.target.files[0])} />
          {d.uploading && <Loader2 className="mt-1 h-4 w-4 animate-spin" />}
        </Field>
      </div>
    </div>
  );
}

function ManualSection({ d }: { d: SBDialog }) {
  const v = d.values;
  return (
    <div className="mb-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">{d.cfg.manualTitle}</p>
      <div className="flex gap-4">
        <Field label="Serial No Range" htmlFor={sbId("range")} hint={'"SN-01::10" for "SN-01" to "SN-10"'}>
          <input id={sbId("range")} className={input} value={String(v.serial_no_range ?? "")} onChange={(e) => d.setLocal("serial_no_range", e.target.value)} onBlur={() => void d.cfg.on.serial_no_range?.()} />
        </Field>
        <Field label="Enter Serial Nos" htmlFor={sbId("serials")} hint="Enter each serial no in a new line">
          <textarea id={sbId("serials")} rows={4} className={input} value={String(v.upload_serial_nos ?? "")} onChange={(e) => d.setLocal("upload_serial_nos", e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

function EntryRow({ d, r, i }: { d: SBDialog; r: SBRow; i: number }) {
  const c = d.cfg;
  return (
    <tr className="border-t border-zinc-200 dark:border-zinc-800">
      <td className="px-2 py-1 text-zinc-500">{i + 1}</td>
      {c.hasSerial && (
        <td className="px-2 py-1">
          <LinkInput id={sbId(`s${i}`)} label={`Serial No row ${i + 1}`} doctype="Serial No" value={String(r.serial_no ?? "")} getQuery={c.serialQuery} onCommit={(x) => d.setRow(i, { serial_no: x })} />
        </td>
      )}
      {c.hasBatch && (
        <td className="px-2 py-1">
          <LinkInput
            id={sbId(`b${i}`)}
            label={`Batch No row ${i + 1}`}
            doctype="Batch"
            value={String(r.batch_no ?? "")}
            getQuery={c.batchQuery}
            onCommit={(x) => {
              d.setRow(i, { batch_no: x });
              void c.on.batch_row?.(d.fields_dict.entries.df.data[i]);
            }}
          />
        </td>
      )}
      {c.hasBatch && !c.hasSerial && (
        <td className="px-2 py-1">
          <input aria-label={`Quantity row ${i + 1}`} type="number" className={input} value={String(r.qty ?? "")} onChange={(e) => d.setRow(i, { qty: e.target.value === "" ? undefined : Number(e.target.value) })} />
        </td>
      )}
      <td className="px-1 py-1">
        <button type="button" aria-label={`Delete row ${i + 1}`} className="rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800" onClick={() => d.removeRow(i)}>
          <X className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

function EntriesTable({ d }: { d: SBDialog }) {
  const c = d.cfg;
  const rows = d.fields_dict.entries.df.data;
  return (
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
            <EntryRow key={d.rowKey(r)} d={d} r={r} i={i} />
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
        <button type="button" className={`${btn} inline-flex items-center gap-1`} onClick={() => d.addRow()}>
          <Plus className="h-3.5 w-3.5" /> Add Row
        </button>
      </div>
    </div>
  );
}

function Footer({ d }: { d: SBDialog }) {
  const c = d.cfg;
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
  return (
    <div className="flex items-center justify-end gap-2 px-5 py-3">
      <button type="button" className={btn} onClick={() => void run(c.onSecondary)}>
        {c.secondaryLabel}
      </button>
      <button type="button" disabled={busy} onClick={() => void run(c.onPrimary)} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {c.primaryLabel}
      </button>
    </div>
  );
}

function SBView({ d }: { d: SBDialog }) {
  useSyncExternalStore(d.subscribe, d.getVersion, d.getVersion);
  const c = d.cfg;
  const v = d.values;
  const backdrop = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  useModalDialog(d, backdrop, panel);

  // depends_on of the Desk fields
  const manual = isChecked(v.enter_manually);
  const csv = isChecked(v.import_using_csv_file);
  const showTable = !manual || d.fields_dict.entries.df.data.length > 0;

  return (
    <div ref={backdrop} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-[8vh] backdrop-blur-[2px]">
      {/* non-modal <dialog open>: a frappe.confirm / msgprint opened on top of it, portalled to <body>, must stay usable (a modal dialog would make it inert) */}
      <dialog open ref={panel} aria-modal="true" aria-label={c.title} tabIndex={-1} onKeyDown={trapFocus} className="static m-0 w-full max-w-3xl rounded-xl border border-zinc-200 bg-zinc-50 p-0 text-inherit shadow-2xl outline-none dark:border-zinc-700 dark:bg-zinc-950">
        <div className="flex items-center gap-2 px-5 py-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{c.title}</h2>
          <button type="button" onClick={() => d.hide()} aria-label="Close" className="ml-auto rounded-md p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5">
          {c.outward && <OutwardFields d={d} />}
          <div className="flex gap-4 pt-3">
            <div className="flex min-w-0 flex-1 gap-4">
              <Field label="Item Code" htmlFor={sbId("item")}>
                <LinkInput id={sbId("item")} label="Item Code" doctype="Item" value={String(v.item_code ?? "")} readOnly onCommit={() => {}} />
              </Field>
              <Field label="Warehouse" htmlFor={sbId("warehouse")}>
                <LinkInput id={sbId("warehouse")} label="Warehouse" doctype="Warehouse" value={String(v.warehouse ?? "")} getQuery={c.warehouseQuery} onCommit={(x) => void d.set_value("warehouse", x)} />
              </Field>
            </div>
            <SideFields d={d} manual={manual} csv={csv} />
          </div>
          {!c.outward && csv && <CsvSection d={d} />}
          {!c.outward && c.hasSerial && manual && <ManualSection d={d} />}
          {showTable && <EntriesTable d={d} />}
        </div>
        <Footer d={d} />
      </dialog>
    </div>
  );
}
