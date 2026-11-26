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
import { Loader2 } from "lucide-react";
import Canvas from "@/components/print-builder/Canvas";
import FieldsPanel from "@/components/print-builder/FieldsPanel";
import { FieldInspector, PageInspector, SectionInspector } from "@/components/print-builder/Inspector";
import { PreviewOptions, PreviewView } from "@/components/print-builder/PreviewPane";
import TopBar, { type Mode } from "@/components/print-builder/TopBar";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { getSection, updateField, type PFLayout, type Selection } from "@/lib/print-builder/layout";
import { useBuilder, type SaveStatus } from "@/lib/print-builder/useBuilder";
import { useBuilderKeys, useLayoutActions } from "@/lib/print-builder/useLayoutActions";
import { usePreview } from "@/lib/print-builder/usePreview";
import { usePrefs, useSampleData } from "@/lib/print-builder/useSampleData";

type Builder = ReturnType<typeof useBuilder>;
type Actions = ReturnType<typeof useLayoutActions>;

/** warn before leaving with an edit that hasn't reached the draft yet */
function useUnsavedWarning(status: SaveStatus) {
  useEffect(() => {
    if (status !== "unsaved" && status !== "saving") return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [status]);
}

/** fieldnames already on the sheet (greyed in the field list) */
function usedFieldnames(layout: PFLayout) {
  const set = new Set<string>();
  for (const sec of [layout.header, ...layout.sections, layout.footer]) for (const c of sec?.columns ?? []) for (const f of c.fields) set.add(f.fieldname);
  return set;
}

/** right panel: the selected field's, the selected section's, or the page's settings */
function InspectorPanel({ layout, selection, settings, meta, readOnly, actions }: { layout: PFLayout; selection: Selection; settings: Record<string, unknown>; meta: DocTypeMeta | null; readOnly: boolean; actions: Actions }) {
  const sec = selection ? getSection(layout, selection.s) : undefined;
  const field = selection?.kind === "field" ? sec?.columns[selection.c]?.fields[selection.f] : undefined;
  let body;
  if (field && selection?.kind === "field") {
    const patch = (p: Parameters<typeof updateField>[4]) => actions.setLayout((l) => updateField(l, selection.s, selection.c, selection.f, p));
    body = <FieldInspector f={field} patch={patch} meta={meta} readOnly={readOnly} onDuplicate={actions.duplicateSelected} onRemove={actions.removeSelected} />;
  } else if (sec && selection?.kind === "section") {
    body = <SectionInspector s={selection.s} sec={sec} setLayout={actions.setLayout} readOnly={readOnly} onRemove={actions.removeSelected} />;
  } else body = <PageInspector settings={settings} setSetting={actions.setSetting} />;
  return (
    <aside aria-label="Settings" className="hidden min-h-0 overflow-y-auto border-l border-zinc-200 md:block dark:border-zinc-800">
      {body}
    </aside>
  );
}

function Workspace({ b, layout, name, deskHref }: { b: Builder; layout: PFLayout; name: string; deskHref: string }) {
  const { undo, redo, previewDoc } = b;
  const [selection, setSelection] = useState<Selection>(null);
  const [mode, setMode] = useState<Mode>("edit");
  const { prefs, setPref, paper } = usePrefs(name);
  const doctype = String(b.doc?.doc_type ?? "");
  const readOnly = b.doc?.standard === "Yes";
  const { meta, records, letterHeads, sample, sampleName } = useSampleData(doctype, prefs.record);

  /** render_builder_preview / download_builder_preview_pdf arguments for the current draft */
  const previewArgs = useCallback(() => {
    const pf = previewDoc();
    if (!pf || !sample) return null;
    return { print_format: JSON.stringify(pf), doctype, name: sample.name, letterhead: prefs.letterhead || undefined, settings: JSON.stringify(paper.settings) };
  }, [previewDoc, sample, doctype, prefs.letterhead, paper]);
  const preview = usePreview({ name, active: mode === "preview", previewArgs });

  const actions = useLayoutActions({ layout, edit: b.edit, undo, readOnly, selection, setSelection, onAdded: () => setMode("edit") });
  const editable = mode === "edit" && !readOnly;
  useBuilderKeys({
    undo,
    redo,
    canDelete: editable && !!selection,
    canDuplicate: editable && selection?.kind === "field",
    onDelete: actions.removeSelected,
    onDuplicate: actions.duplicateSelected,
    onEscape: () => setSelection(null),
  });
  useUnsavedWarning(b.status);
  const used = useMemo(() => usedFieldnames(layout), [layout]);

  return (
    <div className="-mx-gutter -my-stack flex h-[calc(100vh-3rem)] flex-col">
      <TopBar
        name={name}
        doctype={doctype}
        deskHref={deskHref}
        readOnly={readOnly}
        status={b.status}
        canUndo={b.canUndo}
        canRedo={b.canRedo}
        onUndo={b.undo}
        onRedo={b.redo}
        onDiscard={() => void b.discard()}
        onApply={() => void b.apply()}
        mode={mode}
        setMode={setMode}
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[15rem_minmax(0,1fr)_17rem]">
        <FieldsPanel meta={meta} used={used} readOnly={readOnly} onAdd={(f) => void actions.add(f)} onAddSection={actions.addSection} />
        <main aria-label="Canvas" className="min-h-0 overflow-auto bg-zinc-100 p-4 sm:p-6 dark:bg-zinc-950">
          <PreviewOptions doctype={doctype} records={records} sampleName={sampleName} letterHeads={letterHeads} prefs={prefs} setPref={setPref} paper={paper} canPdf={!!sample} pdfBusy={preview.pdfBusy} onPdf={() => void preview.downloadPdf()} />
          {mode === "edit" ? (
            <Canvas layout={layout} settings={b.settings} meta={meta} sample={sample} paper={paper} selection={selection} onSelect={setSelection} {...actions.canvas} />
          ) : (
            <PreviewView doctype={doctype} submittable={!!meta?.is_submittable} sample={sample} paper={paper} html={preview.previewHtml} busy={preview.previewBusy} />
          )}
        </main>
        <InspectorPanel layout={layout} selection={selection} settings={b.settings} meta={meta} readOnly={readOnly} actions={actions} />
      </div>
    </div>
  );
}

export default function PrintBuilder({ name, deskHref }: { name: string; deskHref: string }) {
  const b = useBuilder(name);
  if (b.error) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center" role="alert">
        <p className="text-sm text-red-600">{b.error}</p>
        <Link href="/desk/print-format" className="mt-3 inline-block text-sm underline">Back to Print Formats</Link>
      </div>
    );
  }
  if (!b.doc || !b.layout) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-label="Loading" /></div>;
  if (b.classic) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">This format uses the classic layout. Open it once in Desk&apos;s builder to convert it, then edit it here.</p>
        <a href={deskHref} className="mt-3 inline-block text-sm font-medium underline">Open in Desk&apos;s builder</a>
      </div>
    );
  }
  return <Workspace b={b} layout={b.layout} name={name} deskHref={deskHref} />;
}
