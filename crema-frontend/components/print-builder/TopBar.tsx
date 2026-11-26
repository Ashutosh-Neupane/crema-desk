"use client";

/** Print Format Builder top bar (docs/GAPS.md § 2.19 B): back link, title, save status, undo / redo, view, apply */
import Link from "next/link";
import { ArrowLeft, ExternalLink, Eye, Loader2, PencilRuler, Redo2, Undo2 } from "lucide-react";
import { btn } from "@/components/print-builder/styles";
import type { SaveStatus } from "@/lib/print-builder/useBuilder";

const STATUS_TEXT = { saved: "Saved", draft: "Draft saved — not printing yet", unsaved: "Unsaved changes", saving: "Saving…", failed: "Not saved" } as const;
export type Mode = "edit" | "preview";

const statusClass = (s: SaveStatus) => (s === "failed" ? "text-red-600" : s === "unsaved" ? "text-amber-600" : "text-zinc-500");

interface Props {
  name: string;
  doctype: string;
  deskHref: string;
  readOnly: boolean;
  status: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDiscard: () => void;
  onApply: () => void;
  mode: Mode;
  setMode: (m: Mode) => void;
}

function ModeTabs({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div role="tablist" aria-label="View" className="inline-flex rounded-md border border-zinc-200 p-0.5 dark:border-zinc-700">
      {(["edit", "preview"] as const).map((v) => (
        <button key={v} type="button" role="tab" aria-selected={mode === v} onClick={() => setMode(v)} className={`inline-flex h-7 items-center gap-1 rounded px-2 text-sm ${mode === v ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}>
          {v === "edit" ? <PencilRuler className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {v === "edit" ? "Edit" : "Preview"}
        </button>
      ))}
    </div>
  );
}

export default function TopBar({ name, doctype, deskHref, readOnly, status, canUndo, canRedo, onUndo, onRedo, onDiscard, onApply, mode, setMode }: Props) {
  const formHref = `/desk/doctype/Print%20Format/${encodeURIComponent(name)}`;
  const hasDraft = (status === "draft" || status === "unsaved") && !readOnly;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-gutter py-2 dark:border-zinc-800">
      <Link href={formHref} aria-label={`Back to ${name}`} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"><ArrowLeft className="h-4 w-4" /></Link>
      <h1 className="min-w-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <span className="font-normal text-zinc-500">Print Format Builder ·</span> {name} <span className="font-normal text-zinc-400">({doctype})</span>
      </h1>
      <span role="status" className={`text-xs ${statusClass(status)}`}>{readOnly ? "Standard format — read only" : STATUS_TEXT[status]}</span>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo (⌘Z)" className={btn}><Undo2 className="h-4 w-4" /></button>
        <button type="button" onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo (⇧⌘Z)" className={btn}><Redo2 className="h-4 w-4" /></button>
        <ModeTabs mode={mode} setMode={setMode} />
        {hasDraft && <button type="button" onClick={onDiscard} className={btn}>Discard draft</button>}
        <a href={deskHref} className={btn} title="Open this format in Desk's builder">Desk builder <ExternalLink className="h-3 w-3" /></a>
        {!readOnly && (
          <button type="button" onClick={onApply} disabled={status === "saving"} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
            {status === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save &amp; Apply
          </button>
        )}
      </div>
    </div>
  );
}
