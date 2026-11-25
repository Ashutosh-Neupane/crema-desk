"use client";

/** Query report page header: breadcrumb, title, report JS inner buttons and the Desk menu actions (query_report.js). */
import Link from "next/link";
import { BarChart3, Download, FileText, RefreshCw, Save } from "lucide-react";
import { enc, type InnerButton, type PreparedState } from "./queryReportTypes";

const outline = "inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-50 h-8 gap-1.5 border border-zinc-200 bg-white px-3 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";
const solid = "inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-50 h-8 gap-1.5 bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";

function Breadcrumb({ name, refDoctype }: { name: string; refDoctype?: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-xs text-zinc-500">
        <Link href="/desk/reports" className="hover:underline">
          Reports
        </Link>
        {refDoctype && (
          <>
            {" / "}
            <Link href={`/desk/doctype/${enc(refDoctype)}`} className="hover:underline">
              {refDoctype}
            </Link>
          </>
        )}
      </div>
      <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">{name}</h1>
    </div>
  );
}

function RunButton({ prepared, running, onGenerate, onRefresh }: { prepared: PreparedState | null; running: boolean; onGenerate: () => void; onRefresh: () => void }) {
  if (prepared) {
    return (
      <button type="button" onClick={onGenerate} className={solid}>
        {prepared.name ? "Rebuild" : "Generate New Report"}
      </button>
    );
  }
  return (
    <button type="button" onClick={onRefresh} className={solid} disabled={running}>
      <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} aria-hidden /> Refresh
    </button>
  );
}

export interface QueryReportHeaderProps {
  name: string;
  refDoctype?: string;
  innerButtons: InnerButton[];
  hasChart: boolean;
  showChart: boolean;
  onToggleChart: () => void;
  hasRows: boolean;
  canSave: boolean;
  showSave: boolean;
  onExport: () => void;
  onPdf: () => void;
  onSave: () => void;
  prepared: PreparedState | null;
  running: boolean;
  onGenerate: () => void;
  onRefresh: () => void;
}

export default function QueryReportHeader(p: QueryReportHeaderProps) {
  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <Breadcrumb name={p.name} refDoctype={p.refDoctype} />
      {p.innerButtons.map((b) => (
        <button key={b.label} type="button" onClick={() => b.action()} className={outline}>
          {b.label}
        </button>
      ))}
      {p.hasChart && (
        <button type="button" onClick={p.onToggleChart} aria-pressed={p.showChart} className={outline}>
          <BarChart3 className="h-4 w-4" aria-hidden /> {p.showChart ? "Hide chart" : "Show chart"}
        </button>
      )}
      <button type="button" onClick={p.onExport} disabled={!p.hasRows} className={outline}>
        <Download className="h-4 w-4" aria-hidden /> Export
      </button>
      <button type="button" onClick={p.onPdf} disabled={!p.hasRows} className={outline}>
        <FileText className="h-4 w-4" aria-hidden /> PDF
      </button>
      {p.showSave && (
        <button type="button" onClick={p.onSave} disabled={!p.canSave} className={outline}>
          <Save className="h-4 w-4" aria-hidden /> Save As
        </button>
      )}
      <RunButton prepared={p.prepared} running={p.running} onGenerate={p.onGenerate} onRefresh={p.onRefresh} />
    </div>
  );
}
