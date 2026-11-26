"use client";

/**
 * Print Format Builder inspector (docs/GAPS.md § 2.19 B), the right-hand panel: settings for the selected field,
 * the selected section or zone, or the page when nothing is selected.
 */
import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Copy, Trash2, X } from "lucide-react";
import { checkbox, input } from "@/components/print-builder/styles";
import CodeField from "@/lib/crema-form/controls/CodeField";
import { fetchDoctypeMetaClient } from "@/lib/frappe/doctype";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import { setColumnCount, tableColumnChoices, updateSection, type PFField, type PFLayout, type PFSection, type SectionKey, type TableColumn } from "@/lib/print-builder/layout";

const PAGE_NUMBERS = ["Hide", "Top Left", "Top Center", "Top Right", "Bottom Left", "Bottom Center", "Bottom Right"];
const RENDERERS: Array<[string, string]> = [["chrome", "Chromium"], ["wkhtmltopdf", "wkhtmltopdf"], ["WeasyPrint", "WeasyPrint"], ["Typst", "Typst"]];
const MARGINS = ["margin_top", "margin_right", "margin_bottom", "margin_left"] as const;
/** fieldtypes without a label / alignment and font / "print when empty" option */
const NO_LABEL = new Set(["Spacer", "Divider", "HTML", "Static Text", "Image"]);
const NO_TEXT_STYLE = new Set(["Spacer", "Divider", "HTML", "Table", "Table MultiSelect"]);
const NO_EMPTY = new Set(["Spacer", "Divider", "HTML", "Static Text", "Image", "Barcode"]);
const BARCODE_SOURCES = new Set(["Data", "Link", "Barcode", "Small Text"]);
const HTML_FIELD = { fieldname: "html", label: "HTML", fieldtype: "Code", options: "HTML" } as DocField;
const CSS_FIELD = { fieldname: "css", label: "CSS", fieldtype: "Code", options: "CSS" } as DocField;

type PatchField = (patch: Partial<PFField>) => void;

function Row({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2">
      <label htmlFor={htmlFor} className="text-xs text-zinc-500">{label}</label>
      {children}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}

/** one printed column of a Table block: width, order, remove */
function TableColumnRow({ c, i, count, onWidth, onMove, onRemove }: { c: TableColumn; i: number; count: number; onWidth: (w: number | undefined) => void; onMove: (d: number) => void; onRemove: () => void }) {
  const name = c.label || c.fieldname;
  return (
    <li className="flex items-center gap-1">
      <span className="min-w-0 flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200" title={c.fieldname}>{name}</span>
      <input type="number" min={1} max={100} aria-label={`Width of ${name}`} title="Width (% of the table)" className={`${input} w-12 px-1 text-center`} value={String(c.width ?? "")} onChange={(e) => onWidth(Number(e.target.value) || undefined)} />
      <button type="button" aria-label={`Move ${name} up`} disabled={i === 0} onClick={() => onMove(-1)} className="rounded p-0.5 text-zinc-400 hover:text-zinc-800 disabled:opacity-30 dark:hover:text-zinc-100"><ArrowUp className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label={`Move ${name} down`} disabled={i === count - 1} onClick={() => onMove(1)} className="rounded p-0.5 text-zinc-400 hover:text-zinc-800 disabled:opacity-30 dark:hover:text-zinc-100"><ArrowDown className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label={`Remove column ${name}`} onClick={onRemove} className="rounded p-0.5 text-zinc-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
    </li>
  );
}

/** Table block columns: which child-table fields print, in what order, how wide (Desk's table column picker) */
function TableColumns({ field, onChange }: { field: PFField; onChange: (cols: TableColumn[]) => void }) {
  const [child, setChild] = useState<DocTypeMeta | null>(null);
  const childType = String(field.options ?? "");
  useEffect(() => {
    let alive = true;
    if (childType) void fetchDoctypeMetaClient(childType).then((m) => alive && setChild(m)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [childType]);
  const cols = (field.table_columns as TableColumn[] | undefined) ?? [];
  const used = new Set(cols.map((c) => c.fieldname));
  const choices = child ? tableColumnChoices(child).filter((tf) => !used.has(tf.fieldname)) : [];
  const total = cols.reduce((n, c) => n + (Number(c.width) || 0), 0);
  const move = (i: number, d: number) => {
    const next = [...cols];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const addColumn = (fieldname: string) => {
    const tf = choices.find((x) => x.fieldname === fieldname);
    if (tf) onChange([...cols, { label: tf.label, fieldname: tf.fieldname, fieldtype: tf.fieldtype, options: tf.options, width: 10 }]);
  };
  return (
    <Group title="Table columns">
      <ul className="space-y-1" aria-label="Table columns">
        {cols.map((c, i) => (
          <TableColumnRow
            key={c.fieldname}
            c={c}
            i={i}
            count={cols.length}
            onWidth={(width) => onChange(cols.map((x, j) => (j === i ? { ...x, width } : x)))}
            onMove={(d) => move(i, d)}
            onRemove={() => onChange(cols.filter((_, j) => j !== i))}
          />
        ))}
      </ul>
      <p className={`text-xs ${total > 100 ? "text-amber-600" : "text-zinc-500"}`}>Widths add up to {total}%{total > 100 ? " — columns will squeeze" : ""}.</p>
      {choices.length > 0 && (
        <select aria-label="Add column" className={input} value="" onChange={(e) => addColumn(e.target.value)}>
          <option value="">Add column…</option>
          {choices.map((tf) => <option key={tf.fieldname} value={tf.fieldname}>{tf.label || tf.fieldname}</option>)}
        </select>
      )}
    </Group>
  );
}

/** label, alignment, font size, bold, print when empty: what most fieldtypes share */
function FieldBasics({ f, patch }: { f: PFField; patch: PatchField }) {
  return (
    <Group title={`Field · ${f.fieldtype}`}>
      <Row label="Label" htmlFor="pfb-label"><input id="pfb-label" className={input} value={String(f.label ?? "")} onChange={(e) => patch({ label: e.target.value })} /></Row>
      {!NO_LABEL.has(f.fieldtype) && (
        <Row label="Label shows" htmlFor="pfb-show-label">
          <select id="pfb-show-label" className={input} value={String(f.show_label || "show")} onChange={(e) => patch({ show_label: e.target.value })}>
            <option value="show">Above the value</option>
            <option value="inline">Beside the value</option>
            <option value="hide">Hidden</option>
          </select>
        </Row>
      )}
      {!NO_TEXT_STYLE.has(f.fieldtype) && (
        <>
          <Row label="Align" htmlFor="pfb-align">
            <select id="pfb-align" className={input} value={String(f.align || "")} onChange={(e) => patch({ align: e.target.value || undefined })}>
              <option value="">Default</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
            </select>
          </Row>
          <Row label="Font size" htmlFor="pfb-fs"><input id="pfb-fs" type="number" min={6} max={72} className={input} placeholder="Page default" value={f.font_size == null ? "" : String(f.font_size)} onChange={(e) => patch({ font_size: e.target.value ? Number(e.target.value) : undefined })} /></Row>
          <Row label="Bold" htmlFor="pfb-bold"><input id="pfb-bold" type="checkbox" className={checkbox} checked={!!f.bold} onChange={(e) => patch({ bold: e.target.checked ? 1 : 0 })} /></Row>
        </>
      )}
      {!NO_EMPTY.has(f.fieldtype) && (
        <Row label="Print when empty" htmlFor="pfb-empty"><input id="pfb-empty" type="checkbox" className={checkbox} checked={!!f.show_empty} onChange={(e) => patch({ show_empty: e.target.checked ? 1 : 0 })} /></Row>
      )}
    </Group>
  );
}

function StaticTextSettings({ f, patch }: { f: PFField; patch: PatchField }) {
  return <Group title="Text"><textarea aria-label="Text" rows={4} className={`${input} h-auto py-1.5`} value={String(f.text ?? "")} onChange={(e) => patch({ text: e.target.value })} /></Group>;
}

function HtmlSettings({ f, patch }: { f: PFField; patch: PatchField }) {
  return (
    <Group title="HTML / Jinja">
      <p className="text-xs text-zinc-500">Use <code>{"{{ doc.fieldname }}"}</code> for values.</p>
      <CodeField field={HTML_FIELD} value={String(f.html ?? "")} onChange={(v) => patch({ html: String(v ?? "") })} />
    </Group>
  );
}

function SpacerSettings({ f, patch }: { f: PFField; patch: PatchField }) {
  return <Group title="Spacer"><Row label="Height (px)" htmlFor="pfb-h"><input id="pfb-h" type="number" min={1} className={input} value={String(f.height ?? 10)} onChange={(e) => patch({ height: Number(e.target.value) || 10 })} /></Row></Group>;
}

function ImageSettings({ f, patch }: { f: PFField; patch: PatchField }) {
  return (
    <Group title="Image">
      <Row label="Image URL" htmlFor="pfb-img"><input id="pfb-img" className={input} value={String(f.image_url ?? "")} onChange={(e) => patch({ image_url: e.target.value })} placeholder="/files/logo.png" /></Row>
      <Row label="Width" htmlFor="pfb-w"><input id="pfb-w" className={input} value={String(f.width ?? "")} onChange={(e) => patch({ width: e.target.value })} placeholder="e.g. 120px" /></Row>
    </Group>
  );
}

function BarcodeSettings({ f, patch, meta }: { f: PFField; patch: PatchField; meta: DocTypeMeta | null }) {
  const sources = (meta?.fields ?? []).filter((df) => BARCODE_SOURCES.has(df.fieldtype));
  return (
    <Group title="Barcode">
      <Row label="Kind" htmlFor="pfb-bf">
        <select id="pfb-bf" className={input} value={String(f.barcode_format ?? "CODE128")} onChange={(e) => patch({ barcode_format: e.target.value })}>
          <option value="CODE128">Barcode (Code 128)</option><option value="QR">QR code</option>
        </select>
      </Row>
      <Row label="From field" htmlFor="pfb-bfield">
        <select id="pfb-bfield" className={input} value={String(f.barcode_field ?? "")} onChange={(e) => patch({ barcode_field: e.target.value })}>
          <option value="">— fixed value —</option>
          <option value="name">ID (name)</option>
          {sources.map((df) => <option key={df.fieldname} value={df.fieldname}>{df.label || df.fieldname}</option>)}
        </select>
      </Row>
      {!f.barcode_field && <Row label="Value" htmlFor="pfb-bv"><input id="pfb-bv" className={input} value={String(f.barcode_value ?? "")} onChange={(e) => patch({ barcode_value: e.target.value })} /></Row>}
      <Row label="Show text" htmlFor="pfb-bt"><input id="pfb-bt" type="checkbox" className={checkbox} checked={!!f.show_text} onChange={(e) => patch({ show_text: e.target.checked })} /></Row>
    </Group>
  );
}

function TableSettings({ f, patch }: { f: PFField; patch: PatchField }) {
  return <TableColumns field={f} onChange={(cols) => patch({ table_columns: cols })} />;
}

/** settings only one fieldtype has */
const TYPE_SETTINGS: Record<string, (p: { f: PFField; patch: PatchField; meta: DocTypeMeta | null }) => ReactNode> = {
  "Static Text": StaticTextSettings,
  HTML: HtmlSettings,
  Spacer: SpacerSettings,
  Image: ImageSettings,
  Barcode: BarcodeSettings,
  Table: TableSettings,
  "Table MultiSelect": TableSettings,
};

function FieldInspector({ f, patch, meta, readOnly, onDuplicate, onRemove }: { f: PFField; patch: PatchField; meta: DocTypeMeta | null; readOnly: boolean; onDuplicate: () => void; onRemove: () => void }) {
  const Extra = TYPE_SETTINGS[f.fieldtype];
  return (
    <>
      <FieldBasics f={f} patch={patch} />
      {Extra && <Extra f={f} patch={patch} meta={meta} />}
      <div className="flex items-center gap-4 px-4 py-3">
        <button type="button" onClick={onDuplicate} disabled={readOnly} title="Duplicate (⌘D)" className="inline-flex items-center gap-1.5 text-sm text-zinc-700 hover:underline disabled:opacity-50 dark:text-zinc-200"><Copy className="h-3.5 w-3.5" /> Duplicate</button>
        <button type="button" onClick={onRemove} disabled={readOnly} className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Remove field</button>
      </div>
    </>
  );
}

function SectionInspector({ s, sec, setLayout, readOnly, onRemove }: { s: SectionKey; sec: PFSection; setLayout: (fn: (l: PFLayout) => PFLayout) => void; readOnly: boolean; onRemove: () => void }) {
  const body = typeof s === "number";
  const patch = (p: Partial<PFSection>) => setLayout((l) => updateSection(l, s, (x) => ({ ...x, ...p })));
  return (
    <>
      <Group title={body ? "Section" : `${s === "header" ? "Header" : "Footer"} zone`}>
        {!body && <p className="text-xs text-zinc-500">Fields here repeat on every page.</p>}
        <Row label="Title" htmlFor="pfb-stitle"><input id="pfb-stitle" className={input} value={String(sec.label ?? "")} onChange={(e) => patch({ label: e.target.value })} placeholder="No title" /></Row>
        {!!sec.label && (
          <Row label="Show title" htmlFor="pfb-sshow"><input id="pfb-sshow" type="checkbox" className={checkbox} checked={sec.show_label !== "hide"} onChange={(e) => patch({ show_label: e.target.checked ? "show" : "hide" })} /></Row>
        )}
        <Row label="Columns" htmlFor="pfb-cols">
          <select id="pfb-cols" className={input} value={sec.columns.length} onChange={(e) => setLayout((l) => updateSection(l, s, (x) => setColumnCount(x, Number(e.target.value))))}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Row>
        {body && (
          <Row label="New page before" htmlFor="pfb-pb"><input id="pfb-pb" type="checkbox" className={checkbox} checked={!!sec.page_break} onChange={(e) => patch({ page_break: e.target.checked })} /></Row>
        )}
      </Group>
      {body && (
        <div className="px-4 py-3">
          <button type="button" onClick={onRemove} disabled={readOnly} className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Remove section</button>
        </div>
      )}
    </>
  );
}

function PageInspector({ settings, setSetting }: { settings: Record<string, unknown>; setSetting: (k: string, v: unknown) => void }) {
  return (
    <>
      <Group title="Page">
        <Row label="Font size" htmlFor="pfb-pfs"><input id="pfb-pfs" type="number" min={6} max={32} className={input} value={String(settings.font_size ?? 14)} onChange={(e) => setSetting("font_size", Number(e.target.value) || 14)} /></Row>
        <div className="space-y-1">
          <span className="text-xs text-zinc-500">Margins (mm)</span>
          <div className="grid grid-cols-4 gap-1.5">
            {MARGINS.map((k) => (
              <label key={k} className="text-center text-[10px] capitalize text-zinc-400">
                <input type="number" min={0} max={50} aria-label={k.replace("margin_", "Margin ")} className={`${input} mb-0.5 px-1 text-center`} value={String(settings[k] ?? 15)} onChange={(e) => setSetting(k, Number(e.target.value) || 0)} />
                {k.replace("margin_", "")}
              </label>
            ))}
          </div>
        </div>
        <Row label="Colon after labels" htmlFor="pfb-colon"><input id="pfb-colon" type="checkbox" className={checkbox} checked={!!Number(settings.show_label_colon)} onChange={(e) => setSetting("show_label_colon", e.target.checked ? 1 : 0)} /></Row>
        <Row label="Page numbers" htmlFor="pfb-pn">
          <select id="pfb-pn" className={input} value={String(settings.page_number || "Hide")} onChange={(e) => setSetting("page_number", e.target.value)}>
            {PAGE_NUMBERS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Row>
        <Row label="PDF renderer" htmlFor="pfb-pdf">
          <select id="pfb-pdf" className={input} value={String(settings.pdf_generator || "chrome")} onChange={(e) => setSetting("pdf_generator", e.target.value)}>
            {RENDERERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Row>
      </Group>
      <Group title="Colours">
        <Row label="Labels" htmlFor="pfb-lc"><input id="pfb-lc" type="color" className="h-8 w-16 rounded border border-zinc-200 dark:border-zinc-700" value={String(settings.label_color || "#6b7280")} onChange={(e) => setSetting("label_color", e.target.value)} /></Row>
        <Row label="Values" htmlFor="pfb-vc"><input id="pfb-vc" type="color" className="h-8 w-16 rounded border border-zinc-200 dark:border-zinc-700" value={String(settings.value_color || "#111827")} onChange={(e) => setSetting("value_color", e.target.value)} /></Row>
      </Group>
      <Group title="Custom CSS">
        <CodeField field={CSS_FIELD} value={String(settings.css ?? "")} onChange={(v) => setSetting("css", String(v ?? ""))} />
      </Group>
      <p className="px-4 py-3 text-xs text-zinc-500">Click a section or field on the page to change it. Delete removes the selection, ⌘D duplicates a field, ⌘Z undoes.</p>
    </>
  );
}

export { FieldInspector, PageInspector, SectionInspector };
