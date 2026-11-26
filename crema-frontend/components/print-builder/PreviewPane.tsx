"use client";

/**
 * Print Format Builder preview bits (docs/GAPS.md § 2.19 B): the sample record / letter head / paper picker above
 * the sheet, and the server's own rendering of the unsaved draft (`render_builder_preview`).
 */
import { Download, Loader2 } from "lucide-react";
import { btn, input } from "@/components/print-builder/styles";
import { PAPERS } from "@/lib/print-builder/layout";
import type { LetterHead, Prefs } from "@/lib/print-builder/useSampleData";

type Paper = (typeof PAPERS)[number];

interface OptionsProps {
  doctype: string;
  records: string[];
  sampleName: string | undefined;
  letterHeads: LetterHead[];
  prefs: Prefs;
  setPref: (p: Prefs) => void;
  paper: Paper;
  canPdf: boolean;
  pdfBusy: boolean;
  onPdf: () => void;
}

export function PreviewOptions({ doctype, records, sampleName, letterHeads, prefs, setPref, paper, canPdf, pdfBusy, onPdf }: OptionsProps) {
  return (
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
      <button type="button" onClick={onPdf} disabled={!canPdf || pdfBusy} className={`${btn} ml-auto h-7 text-xs`}>
        {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
      </button>
    </div>
  );
}

interface ViewProps {
  doctype: string;
  submittable: boolean;
  sample: Record<string, unknown> | null;
  paper: Paper;
  html: string | null;
  busy: boolean;
}

function PreviewBody({ doctype, submittable, sample, paper, html, busy }: ViewProps) {
  if (!sample) return <p className="rounded-lg bg-white p-6 text-sm text-zinc-500 shadow">No {doctype} to preview with yet{submittable ? " (only submitted documents print)" : ""}.</p>;
  if (busy && !html) return <div className="flex h-64 items-center justify-center rounded-lg bg-white shadow"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" aria-label="Rendering preview" /></div>;
  return (
    <>
      <p className="mb-2 text-xs text-zinc-500">Rendered by the server with this draft, using {doctype} {String(sample.name)}.{busy ? " Updating…" : ""}</p>
      <iframe title="Print preview" srcDoc={html ?? ""} sandbox="allow-scripts" className="w-full rounded-sm" style={{ height: `calc(${paper.height}mm + 4rem)` }} />
    </>
  );
}

export function PreviewView(props: ViewProps) {
  return (
    <div className="mx-auto w-full" style={{ maxWidth: `calc(${props.paper.width}mm + 4rem)` }}>
      <PreviewBody {...props} />
    </div>
  );
}
