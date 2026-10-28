"use client";

/**
 * Crema's Print Format Builder (docs/GAPS.md § 2.19 B), on Desk v16's layout JSON and server draft.
 * Left: the DocType's fields and blocks (click adds after the selection). Centre: the sheet (edit) or the
 * server's own rendering of the unsaved draft (preview, `render_builder_preview`). Right: settings for the page,
 * the selected section or the selected field. Delete removes the selection (a body section goes with its last
 * field, with Undo in the toast), ⌘Z / ⇧⌘Z undo and redo, edits autosave to the draft, Save & Apply makes it print.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Download, Eye, ExternalLink, Loader2, PencilRuler, Redo2, Search, Trash2, Undo2, X } from "lucide-react";
import Canvas from "@/components/print-builder/Canvas";
import CodeField from "@/lib/crema-form/controls/CodeField";
import { fetchDoctypeMetaClient } from "@/lib/frappe/doctype";
import { deskCall, getDoc } from "@/lib/frappe/form";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import { useBuilder } from "@/lib/print-builder/useBuilder";
import {
  BLOCKS,
  PAPERS,
  addField,
  duplicateField,
  fieldFromDocField,
  getSection,
  insertSection,
  isPrintable,
  moveField,
  moveSection,
  newSection,
  removeField,
  removeSection,
  setColumnCount,
  tableColumnChoices,
  updateField,
  updateSection,
  type PFField,
  type PFSection,
  type Selection,
  type TableColumn,
} from "@/lib/print-builder/layout";

const PAGE_NUMBERS = ["Hide", "Top Left", "Top Center", "Top Right", "Bottom Left", "Bottom Center", "Bottom Right"];
const RENDERERS: Array<[string, string]> = [["chrome", "Chromium"], ["wkhtmltopdf", "wkhtmltopdf"], ["WeasyPrint", "WeasyPrint"], ["Typst", "Typst"]];
const STATUS_TEXT = { saved: "Saved", draft: "Draft saved — not printing yet", unsaved: "Unsaved changes", saving: "Saving…", failed: "Not saved" } as const;

const input = "h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const btn = "inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

function Row({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2">
      <label htmlFor={htmlFor} className="text-xs text-zinc-500">{label}</label>
      {children}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </section>
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
  const choices = child ? tableColumnChoices(child).filter((tf) => !cols.some((c) => c.fieldname === tf.fieldname)) : [];
  const total = cols.reduce((n, c) => n + (Number(c.width) || 0), 0);
  const move = (i: number, d: number) => {
    const next = [...cols];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <Group title="Table columns">
      <ul className="space-y-1" aria-label="Table columns">
        {cols.map((c, i) => (
          <li key={c.fieldname} className="flex items-center gap-1">
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200" title={c.fieldname}>{c.label || c.fieldname}</span>
            <input type="number" min={1} max={100} aria-label={`Width of ${c.label || c.fieldname}`} title="Width (% of the table)" className={`${input} w-12 px-1 text-center`} value={String(c.width ?? "")} onChange={(e) => onChange(cols.map((x, j) => (j === i ? { ...x, width: Number(e.target.value) || undefined } : x)))} />
            <button type="button" aria-label={`Move ${c.label || c.fieldname} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-0.5 text-zinc-400 hover:text-zinc-800 disabled:opacity-30 dark:hover:text-zinc-100"><ArrowUp className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label={`Move ${c.label || c.fieldname} down`} disabled={i === cols.length - 1} onClick={() => move(i, 1)} className="rounded p-0.5 text-zinc-400 hover:text-zinc-800 disabled:opacity-30 dark:hover:text-zinc-100"><ArrowDown className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label={`Remove column ${c.label || c.fieldname}`} onClick={() => onChange(cols.filter((_, j) => j !== i))} className="rounded p-0.5 text-zinc-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
      <p className={`text-xs ${total > 100 ? "text-amber-600" : "text-zinc-500"}`}>Widths add up to {total}%{total > 100 ? " — columns will squeeze" : ""}.</p>
      {choices.length > 0 && (
        <select aria-label="Add column" className={input} value="" onChange={(e) => {
          const tf = choices.find((x) => x.fieldname === e.target.value);
          if (tf) onChange([...cols, { label: tf.label, fieldname: tf.fieldname, fieldtype: tf.fieldtype, options: tf.options, width: 10 }]);
        }}>
          <option value="">Add column…</option>
          {choices.map((tf) => <option key={tf.fieldname} value={tf.fieldname}>{tf.label || tf.fieldname}</option>)}
        </select>
      )}
    </Group>
  );
}

type Prefs = { record?: string; letterhead?: string; paper?: string };

export default function PrintBuilder({ name, deskHref }: { name: string; deskHref: string }) {
  const b = useBuilder(name);
  const { edit, undo, redo, previewDoc } = b;
  const [selection, setSelection] = useState<Selection>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [tab, setTab] = useState<"fields" | "blocks">("fields");
  const [q, setQ] = useState("");
  const [meta, setMeta] = useState<DocTypeMeta | null>(null);
  const [sample, setSample] = useState<Record<string, unknown> | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [records, setRecords] = useState<string[]>([]);
  const [letterHeads, setLetterHeads] = useState<Array<{ name: string; is_default?: number }>>([]);
  // preview record, letter head and paper aren't part of a Print Format; remembered per format in this browser
  const prefsKey = `crema.pfb.${name}`;
  const [prefs, setPrefs] = useState<Prefs>({});
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot restore from localStorage after hydration
      setPrefs(JSON.parse(localStorage.getItem(prefsKey) ?? "{}") as Prefs);
    } catch {
      /* private window: defaults */
    }
  }, [prefsKey]);
  const setPref = (patch: Prefs) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(prefsKey, JSON.stringify(next));
      } catch {
        /* not persisted */
      }
      return next;
    });
  const paper = PAPERS.find((x) => x.key === prefs.paper) ?? PAPERS[0];
  const doctype = b.doc ? String(b.doc.doc_type ?? "") : "";
  const readOnly = b.doc?.standard === "Yes";

  // the DocType's meta, recent printable records to sample from (Desk printable_sample) and the letter heads
  useEffect(() => {
    if (!doctype) return;
    let alive = true;
    void (async () => {
      const m = await fetchDoctypeMetaClient(doctype).catch(() => null);
      if (!alive) return;
      setMeta(m);
      try {
        const { env } = await deskCall("frappe.client.get_list", { doctype, filters: m?.is_submittable ? { docstatus: 1 } : {}, fields: ["name"], order_by: "modified desc", limit_page_length: 20 });
        if (alive) setRecords(((env.message as Array<{ name: string }> | undefined) ?? []).map((r) => r.name));
      } catch {
        /* no records: cards show labels only */
      }
      try {
        const { env } = await deskCall("frappe.client.get_list", { doctype: "Letter Head", filters: { disabled: 0 }, fields: ["name", "is_default"], order_by: "is_default desc, name asc", limit_page_length: 50 });
        if (alive) setLetterHeads((env.message as Array<{ name: string; is_default?: number }>) ?? []);
      } catch {
        /* no access to Letter Head: only the default */
      }
    })();
    return () => {
      alive = false;
    };
  }, [doctype]);

  const sampleName = prefs.record && records.includes(prefs.record) ? prefs.record : records[0];
  useEffect(() => {
    if (!doctype || !sampleName) return;
    let alive = true;
    getDoc(doctype, sampleName)
      .then(({ doc }) => alive && setSample(doc))
      .catch(() => alive && setSample(null));
    return () => {
      alive = false;
    };
  }, [doctype, sampleName]);
  /** render_builder_preview / download_builder_preview_pdf arguments for the current draft */
  const previewArgs = useCallback(() => {
    const pf = previewDoc();
    if (!pf || !sample) return null;
    return { print_format: JSON.stringify(pf), doctype, name: sample.name, letterhead: prefs.letterhead || undefined, settings: JSON.stringify(paper.settings) };
  }, [previewDoc, sample, doctype, prefs.letterhead, paper]);

  const layout = b.layout;
  const settings = b.settings;
  const setLayout = useCallback((fn: (l: NonNullable<typeof layout>) => NonNullable<typeof layout>) => edit((s) => ({ ...s, layout: fn(s.layout) })), [edit]);
  const setSetting = (k: string, v: unknown) => edit((s) => ({ ...s, settings: { ...s.settings, [k]: v } }));

  const removeSelected = useCallback(() => {
    if (!layout || !selection) return;
    if (selection.kind === "field") {
      const { sectionRemoved } = removeField(layout, selection.s, selection.c, selection.f);
      setLayout((l) => removeField(l, selection.s, selection.c, selection.f).layout);
      setSelection(null);
      toast(sectionRemoved ? "Field and its empty section removed" : "Field removed", { action: { label: "Undo", onClick: () => undo() } });
    } else if (typeof selection.s === "number") {
      const at = selection.s;
      setLayout((l) => removeSection(l, at));
      setSelection(null);
      toast("Section removed", { action: { label: "Undo", onClick: () => undo() } });
    }
  }, [layout, selection, setLayout, undo]);

  const duplicateSelected = useCallback(() => {
    if (!layout || selection?.kind !== "field") return;
    const { layout: next, selection: sel } = duplicateField(layout, selection.s, selection.c, selection.f);
    setLayout(() => next);
    setSelection(sel);
  }, [layout, selection, setLayout]);

  // keyboard: Delete / Backspace, ⌘D, ⌘Z, ⇧⌘Z / ⌘Y, Escape — not while typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true], .cm-editor")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key === "d" && selection?.kind === "field" && mode === "edit" && !readOnly) {
        e.preventDefault();
        duplicateSelected();
      } else if (mod && e.key === "y") {
        e.preventDefault();
        redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selection && mode === "edit" && !readOnly) {
        e.preventDefault();
        removeSelected();
      } else if (e.key === "Escape") setSelection(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [undo, redo, selection, removeSelected, duplicateSelected, mode, readOnly]);

  // warn before leaving with an edit that hasn't reached the draft yet
  useEffect(() => {
    if (b.status !== "unsaved" && b.status !== "saving") return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [b.status]);

  const renderPreview = useCallback(async () => {
    const args = previewArgs();
    if (!args) {
      setPreviewHtml(null);
      return;
    }
    setPreviewBusy(true);
    try {
      const { env } = await deskCall("frappe.utils.print_format_generator.render_builder_preview", args);
      setPreviewHtml(typeof env.message === "string" ? env.message : "");
    } catch (e) {
      setPreviewHtml(null);
      toast.error(e instanceof Error ? e.message : "Could not render the preview");
    } finally {
      setPreviewBusy(false);
    }
  }, [previewArgs]);

  /** the draft as a PDF, through the format's own PDF renderer (Desk's builder "Download PDF") */
  const downloadPdf = async () => {
    const args = previewArgs();
    if (!args) return;
    setPdfBusy(true);
    try {
      const res = await fetch("/api/frappe/api/method/frappe.utils.print_format_generator.download_builder_preview_pdf", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("pdf")) {
        const env = (await res.json().catch(() => ({}))) as { exception?: string; exc_type?: string };
        const msg = env.exception?.split("\n")[0] || `PDF failed (${res.status})`;
        // builder formats print through the server's Chromium (also when "wkhtmltopdf" is picked, print_format_generator
        // render_pdf); in containers it often can't start for missing system libraries such as libnss3
        throw new Error(/Chromium/i.test(msg) ? `${msg} The server's PDF renderer (Chromium) isn't working — ask your administrator.` : msg);
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name} - ${String(args.name)}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not make the PDF");
    } finally {
      setPdfBusy(false);
    }
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async render; the HTML is set after the await
    if (mode === "preview") void renderPreview();
  }, [mode, renderPreview]);

  const used = useMemo(() => {
    const set = new Set<string>();
    if (layout) for (const sec of [layout.header, ...layout.sections, layout.footer]) for (const c of sec?.columns ?? []) for (const f of c.fields) set.add(f.fieldname);
    return set;
  }, [layout]);
  const fields = useMemo(() => (meta?.fields ?? []).filter(isPrintable).filter((f) => !q || `${f.label} ${f.fieldname}`.toLowerCase().includes(q.toLowerCase())), [meta, q]);

  const add = async (field: PFField | DocField) => {
    if (!layout || readOnly) return;
    let f: PFField;
    if ("parent" in field || !("custom" in field)) {
      const df = field as DocField;
      const child = df.fieldtype === "Table" || df.fieldtype === "Table MultiSelect" ? await fetchDoctypeMetaClient(String(df.options)).catch(() => undefined) : undefined;
      f = fieldFromDocField(df, child);
    } else f = field as PFField;
    const { layout: next, selection: sel } = addField(layout, f, selection);
    setLayout(() => next);
    setSelection(sel);
    setMode("edit");
  };

  if (b.error) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center" role="alert">
        <p className="text-sm text-red-600">{b.error}</p>
        <Link href="/desk/doctype/Print%20Format" className="mt-3 inline-block text-sm underline">Back to Print Formats</Link>
      </div>
    );
  }
  if (!b.doc || !layout) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-label="Loading" /></div>;
  if (b.classic) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">This format uses the classic layout. Open it once in Desk&apos;s builder to convert it, then edit it here.</p>
        <a href={deskHref} className="mt-3 inline-block text-sm font-medium underline">Open in Desk&apos;s builder</a>
      </div>
    );
  }

  const selSection: PFSection | undefined = selection ? getSection(layout, selection.s) : undefined;
  const selField: PFField | undefined = selection?.kind === "field" ? selSection?.columns[selection.c]?.fields[selection.f] : undefined;
  const patchField = (patch: Partial<PFField>) => selection?.kind === "field" && setLayout((l) => updateField(l, selection.s, selection.c, selection.f, patch));
  const patchSection = (patch: Partial<PFSection>) => selection && setLayout((l) => updateSection(l, selection.s, (sec) => ({ ...sec, ...patch })));
  const formHref = `/desk/doctype/Print%20Format/${encodeURIComponent(name)}`;

  return (
    <div className="-mx-gutter -my-stack flex h-[calc(100vh-3rem)] flex-col">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-gutter py-2 dark:border-zinc-800">
        <Link href={formHref} aria-label={`Back to ${name}`} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"><ArrowLeft className="h-4 w-4" /></Link>
        <h1 className="min-w-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <span className="font-normal text-zinc-500">Print Format Builder ·</span> {name} <span className="font-normal text-zinc-400">({doctype})</span>
        </h1>
        <span role="status" className={`text-xs ${b.status === "failed" ? "text-red-600" : b.status === "unsaved" ? "text-amber-600" : "text-zinc-500"}`}>{readOnly ? "Standard format — read only" : STATUS_TEXT[b.status]}</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={b.undo} disabled={!b.canUndo} aria-label="Undo" title="Undo (⌘Z)" className={btn}><Undo2 className="h-4 w-4" /></button>
          <button type="button" onClick={b.redo} disabled={!b.canRedo} aria-label="Redo" title="Redo (⇧⌘Z)" className={btn}><Redo2 className="h-4 w-4" /></button>
          <div role="tablist" aria-label="View" className="inline-flex rounded-md border border-zinc-200 p-0.5 dark:border-zinc-700">
            {(["edit", "preview"] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={mode === v} onClick={() => setMode(v)} className={`inline-flex h-7 items-center gap-1 rounded px-2 text-sm ${mode === v ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}>
                {v === "edit" ? <PencilRuler className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {v === "edit" ? "Edit" : "Preview"}
              </button>
            ))}
          </div>
          {(b.status === "draft" || b.status === "unsaved") && !readOnly && (
            <button type="button" onClick={() => void b.discard()} className={btn}>Discard draft</button>
          )}
          <a href={deskHref} className={btn} title="Open this format in Desk's builder">Desk builder <ExternalLink className="h-3 w-3" /></a>
          {!readOnly && (
            <button type="button" onClick={() => void b.apply()} disabled={b.status === "saving"} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
              {b.status === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save &amp; Apply
            </button>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[15rem_minmax(0,1fr)_17rem]">
        {/* left: fields and blocks */}
        <aside aria-label="Fields and blocks" className="hidden min-h-0 flex-col border-r border-zinc-200 md:flex dark:border-zinc-800">
          <div role="tablist" className="flex gap-1 border-b border-zinc-200 px-3 pt-2 dark:border-zinc-800">
            {(["fields", "blocks"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-2 pb-1.5 text-sm capitalize ${tab === t ? "border-zinc-900 font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-100" : "border-transparent text-zinc-500"}`}>{t}</button>
            ))}
          </div>
          {tab === "fields" ? (
            <>
              <div className="relative px-3 py-2">
                <Search className="pointer-events-none absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search fields" aria-label="Search fields" className={`${input} pl-7`} />
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3" aria-busy={!meta}>
                {!meta && <li className="px-2 py-1.5 text-xs text-zinc-400">Loading fields…</li>}
                <li>
                  <button type="button" onClick={() => void add({ fieldname: "name", label: "ID", fieldtype: "Data" } as DocField)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <span className="truncate text-zinc-800 dark:text-zinc-200">ID (name)</span><span className="text-[11px] text-zinc-400">Data</span>
                  </button>
                </li>
                {fields.map((f) => (
                  <li key={f.fieldname}>
                    <button type="button" disabled={readOnly} onClick={() => void add(f)} title={used.has(f.fieldname) ? "Already in the layout — adds another copy" : "Add after the selection"} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800">
                      <span className={`truncate ${used.has(f.fieldname) ? "text-zinc-400" : "text-zinc-800 dark:text-zinc-200"}`}>{f.label || f.fieldname}</span>
                      <span className="shrink-0 text-[11px] text-zinc-400">{f.fieldtype}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {[{ key: "section", label: "Section", desc: "A new area for fields" }, { key: "page_break", label: "Page break", desc: "Start a new page" }].map((blk) => (
                <li key={blk.key}>
                  <button type="button" disabled={readOnly} onClick={() => { const at = selection ? (typeof selection.s === "number" ? selection.s + 1 : layout.sections.length) : layout.sections.length; setLayout((l) => insertSection(l, at, newSection(blk.key === "page_break"))); setSelection({ kind: "section", s: at }); setMode("edit"); }} className="w-full rounded-md border border-zinc-200 px-2.5 py-2 text-left hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                    <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">{blk.label}</span>
                    <span className="block text-xs text-zinc-500">{blk.desc}</span>
                  </button>
                </li>
              ))}
              {BLOCKS.map((blk) => (
                <li key={blk.key}>
                  <button type="button" disabled={readOnly} onClick={() => void add(blk.make())} className="w-full rounded-md border border-zinc-200 px-2.5 py-2 text-left hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                    <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">{blk.label}</span>
                    <span className="block text-xs text-zinc-500">{blk.desc}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* centre */}
        <main aria-label="Canvas" className="min-h-0 overflow-auto bg-zinc-100 p-4 sm:p-6 dark:bg-zinc-950">
          <div role="toolbar" aria-label="Preview options" className="mx-auto mb-3 flex w-full flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400" style={{ maxWidth: `max(${paper.width}mm, 36rem)` }}>
            <label className="flex items-center gap-1">
              Sample
              <select aria-label="Sample record" className={`${input} h-7 w-auto max-w-[13rem] text-xs`} value={sampleName ?? ""} onChange={(e) => setPref({ record: e.target.value })} disabled={!records.length}>
                {!records.length && <option value="">No {doctype} yet</option>}
                {records.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1">
              Letter head
              <select aria-label="Letter head" className={`${input} h-7 w-auto max-w-[11rem] text-xs`} value={prefs.letterhead ?? ""} onChange={(e) => setPref({ letterhead: e.target.value })}>
                <option value="">Default</option>
                <option value="No Letterhead">None</option>
                {letterHeads.map((l) => <option key={l.name} value={l.name}>{l.name}{l.is_default ? " (default)" : ""}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1">
              Paper
              <select aria-label="Paper" className={`${input} h-7 w-auto text-xs`} value={paper.key} onChange={(e) => setPref({ paper: e.target.value })}>
                {PAPERS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void downloadPdf()} disabled={!sample || pdfBusy} className={`${btn} ml-auto h-7 text-xs`}>
              {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
            </button>
          </div>
          {mode === "edit" ? (
            <Canvas
              layout={layout}
              settings={settings}
              meta={meta}
              sample={sample}
              paper={paper}
              selection={selection}
              onSelect={setSelection}
              onRemoveField={(s, c, f) => { const { sectionRemoved } = removeField(layout, s, c, f); setLayout((l) => removeField(l, s, c, f).layout); setSelection(null); toast(sectionRemoved ? "Field and its empty section removed" : "Field removed", { action: { label: "Undo", onClick: () => undo() } }); }}
              onRemoveSection={(s) => { setLayout((l) => removeSection(l, s)); setSelection(null); toast("Section removed", { action: { label: "Undo", onClick: () => undo() } }); }}
              onColumns={(s, n) => setLayout((l) => updateSection(l, s, (sec) => setColumnCount(sec, n)))}
              onInsertSection={(at) => { setLayout((l) => insertSection(l, at)); setSelection({ kind: "section", s: at }); }}
              onMoveSection={(from, to) => { setLayout((l) => moveSection(l, from, to)); setSelection(null); }}
              onMoveField={(from, to) => { setLayout((l) => moveField(l, from, to)); setSelection(null); }}
            />
          ) : (
            <div className="mx-auto w-full" style={{ maxWidth: `calc(${paper.width}mm + 4rem)` }}>
              {!sample ? (
                <p className="rounded-lg bg-white p-6 text-sm text-zinc-500 shadow">No {doctype} to preview with yet{meta?.is_submittable ? " (only submitted documents print)" : ""}.</p>
              ) : previewBusy && !previewHtml ? (
                <div className="flex h-64 items-center justify-center rounded-lg bg-white shadow"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-label="Rendering preview" /></div>
              ) : (
                <>
                  <p className="mb-2 text-xs text-zinc-500">Rendered by the server with this draft, using {doctype} {String(sample.name)}.{previewBusy ? " Updating…" : ""}</p>
                  <iframe title="Print preview" srcDoc={previewHtml ?? ""} sandbox="allow-scripts" className="w-full rounded-sm" style={{ height: `calc(${paper.height}mm + 4rem)` }} />
                </>
              )}
            </div>
          )}
        </main>

        {/* right: inspector */}
        <aside aria-label="Settings" className="hidden min-h-0 overflow-y-auto border-l border-zinc-200 md:block dark:border-zinc-800">
          {selField && selection?.kind === "field" ? (
            <>
              <Group title={`Field · ${selField.fieldtype}`}>
                <Row label="Label" htmlFor="pfb-label"><input id="pfb-label" className={input} value={String(selField.label ?? "")} onChange={(e) => patchField({ label: e.target.value })} /></Row>
                {!["Spacer", "Divider", "HTML", "Static Text", "Image"].includes(selField.fieldtype) && (
                  <Row label="Label shows" htmlFor="pfb-show-label">
                    <select id="pfb-show-label" className={input} value={String(selField.show_label || "show")} onChange={(e) => patchField({ show_label: e.target.value })}>
                      <option value="show">Above the value</option>
                      <option value="inline">Beside the value</option>
                      <option value="hide">Hidden</option>
                    </select>
                  </Row>
                )}
                {!["Spacer", "Divider", "HTML", "Table", "Table MultiSelect"].includes(selField.fieldtype) && (
                  <>
                    <Row label="Align" htmlFor="pfb-align">
                      <select id="pfb-align" className={input} value={String(selField.align || "")} onChange={(e) => patchField({ align: e.target.value || undefined })}>
                        <option value="">Default</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                      </select>
                    </Row>
                    <Row label="Font size" htmlFor="pfb-fs"><input id="pfb-fs" type="number" min={6} max={72} className={input} placeholder="Page default" value={selField.font_size == null ? "" : String(selField.font_size)} onChange={(e) => patchField({ font_size: e.target.value ? Number(e.target.value) : undefined })} /></Row>
                    <Row label="Bold" htmlFor="pfb-bold"><input id="pfb-bold" type="checkbox" className="h-4 w-4 justify-self-start" checked={!!selField.bold} onChange={(e) => patchField({ bold: e.target.checked ? 1 : 0 })} /></Row>
                  </>
                )}
                {!["Spacer", "Divider", "HTML", "Static Text", "Image", "Barcode"].includes(selField.fieldtype) && (
                  <Row label="Print when empty" htmlFor="pfb-empty"><input id="pfb-empty" type="checkbox" className="h-4 w-4 justify-self-start" checked={!!selField.show_empty} onChange={(e) => patchField({ show_empty: e.target.checked ? 1 : 0 })} /></Row>
                )}
              </Group>
              {selField.fieldtype === "Static Text" && (
                <Group title="Text"><textarea aria-label="Text" rows={4} className={`${input} h-auto py-1.5`} value={String(selField.text ?? "")} onChange={(e) => patchField({ text: e.target.value })} /></Group>
              )}
              {selField.fieldtype === "HTML" && (
                <Group title="HTML / Jinja">
                  <p className="text-xs text-zinc-500">Use <code>{"{{ doc.fieldname }}"}</code> for values.</p>
                  <CodeField field={{ fieldname: "html", label: "HTML", fieldtype: "Code", options: "HTML" } as DocField} value={String(selField.html ?? "")} onChange={(v) => patchField({ html: String(v ?? "") })} />
                </Group>
              )}
              {selField.fieldtype === "Spacer" && (
                <Group title="Spacer"><Row label="Height (px)" htmlFor="pfb-h"><input id="pfb-h" type="number" min={1} className={input} value={String(selField.height ?? 10)} onChange={(e) => patchField({ height: Number(e.target.value) || 10 })} /></Row></Group>
              )}
              {selField.fieldtype === "Image" && (
                <Group title="Image">
                  <Row label="Image URL" htmlFor="pfb-img"><input id="pfb-img" className={input} value={String(selField.image_url ?? "")} onChange={(e) => patchField({ image_url: e.target.value })} placeholder="/files/logo.png" /></Row>
                  <Row label="Width" htmlFor="pfb-w"><input id="pfb-w" className={input} value={String(selField.width ?? "")} onChange={(e) => patchField({ width: e.target.value })} placeholder="e.g. 120px" /></Row>
                </Group>
              )}
              {selField.fieldtype === "Barcode" && (
                <Group title="Barcode">
                  <Row label="Kind" htmlFor="pfb-bf">
                    <select id="pfb-bf" className={input} value={String(selField.barcode_format ?? "CODE128")} onChange={(e) => patchField({ barcode_format: e.target.value })}>
                      <option value="CODE128">Barcode (Code 128)</option><option value="QR">QR code</option>
                    </select>
                  </Row>
                  <Row label="From field" htmlFor="pfb-bfield">
                    <select id="pfb-bfield" className={input} value={String(selField.barcode_field ?? "")} onChange={(e) => patchField({ barcode_field: e.target.value })}>
                      <option value="">— fixed value —</option>
                      <option value="name">ID (name)</option>
                      {(meta?.fields ?? []).filter((f) => ["Data", "Link", "Barcode", "Small Text"].includes(f.fieldtype)).map((f) => <option key={f.fieldname} value={f.fieldname}>{f.label || f.fieldname}</option>)}
                    </select>
                  </Row>
                  {!selField.barcode_field && <Row label="Value" htmlFor="pfb-bv"><input id="pfb-bv" className={input} value={String(selField.barcode_value ?? "")} onChange={(e) => patchField({ barcode_value: e.target.value })} /></Row>}
                  <Row label="Show text" htmlFor="pfb-bt"><input id="pfb-bt" type="checkbox" className="h-4 w-4 justify-self-start" checked={!!selField.show_text} onChange={(e) => patchField({ show_text: e.target.checked })} /></Row>
                </Group>
              )}
              {(selField.fieldtype === "Table" || selField.fieldtype === "Table MultiSelect") && (
                <TableColumns field={selField} onChange={(cols) => patchField({ table_columns: cols })} />
              )}
              <div className="flex items-center gap-4 px-4 py-3">
                <button type="button" onClick={duplicateSelected} disabled={readOnly} title="Duplicate (⌘D)" className="inline-flex items-center gap-1.5 text-sm text-zinc-700 hover:underline disabled:opacity-50 dark:text-zinc-200"><Copy className="h-3.5 w-3.5" /> Duplicate</button>
                <button type="button" onClick={removeSelected} disabled={readOnly} className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Remove field</button>
              </div>
            </>
          ) : selSection && selection?.kind === "section" ? (
            <>
              <Group title={typeof selection.s === "number" ? "Section" : `${selection.s === "header" ? "Header" : "Footer"} zone`}>
                {typeof selection.s !== "number" && <p className="text-xs text-zinc-500">Fields here repeat on every page.</p>}
                <Row label="Title" htmlFor="pfb-stitle"><input id="pfb-stitle" className={input} value={String(selSection.label ?? "")} onChange={(e) => patchSection({ label: e.target.value })} placeholder="No title" /></Row>
                {!!selSection.label && (
                  <Row label="Show title" htmlFor="pfb-sshow"><input id="pfb-sshow" type="checkbox" className="h-4 w-4 justify-self-start" checked={selSection.show_label !== "hide"} onChange={(e) => patchSection({ show_label: e.target.checked ? "show" : "hide" })} /></Row>
                )}
                <Row label="Columns" htmlFor="pfb-cols">
                  <select id="pfb-cols" className={input} value={selSection.columns.length} onChange={(e) => setLayout((l) => updateSection(l, selection.s, (sec) => setColumnCount(sec, Number(e.target.value))))}>
                    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Row>
                {typeof selection.s === "number" && (
                  <Row label="New page before" htmlFor="pfb-pb"><input id="pfb-pb" type="checkbox" className="h-4 w-4 justify-self-start" checked={!!selSection.page_break} onChange={(e) => patchSection({ page_break: e.target.checked })} /></Row>
                )}
              </Group>
              {typeof selection.s === "number" && (
                <div className="px-4 py-3">
                  <button type="button" onClick={removeSelected} disabled={readOnly} className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Remove section</button>
                </div>
              )}
            </>
          ) : (
            <>
              <Group title="Page">
                <Row label="Font size" htmlFor="pfb-pfs"><input id="pfb-pfs" type="number" min={6} max={32} className={input} value={String(settings.font_size ?? 14)} onChange={(e) => setSetting("font_size", Number(e.target.value) || 14)} /></Row>
                <div className="space-y-1">
                  <span className="text-xs text-zinc-500">Margins (mm)</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["margin_top", "margin_right", "margin_bottom", "margin_left"] as const).map((k) => (
                      <label key={k} className="text-center text-[10px] capitalize text-zinc-400">
                        <input type="number" min={0} max={50} aria-label={k.replace("margin_", "Margin ")} className={`${input} mb-0.5 px-1 text-center`} value={String(settings[k] ?? 15)} onChange={(e) => setSetting(k, Number(e.target.value) || 0)} />
                        {k.replace("margin_", "")}
                      </label>
                    ))}
                  </div>
                </div>
                <Row label="Colon after labels" htmlFor="pfb-colon"><input id="pfb-colon" type="checkbox" className="h-4 w-4 justify-self-start" checked={!!Number(settings.show_label_colon)} onChange={(e) => setSetting("show_label_colon", e.target.checked ? 1 : 0)} /></Row>
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
                <CodeField field={{ fieldname: "css", label: "CSS", fieldtype: "Code", options: "CSS" } as DocField} value={String(settings.css ?? "")} onChange={(v) => setSetting("css", String(v ?? ""))} />
              </Group>
              <p className="px-4 py-3 text-xs text-zinc-500">Click a section or field on the page to change it. Delete removes the selection, ⌘D duplicates a field, ⌘Z undoes.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
