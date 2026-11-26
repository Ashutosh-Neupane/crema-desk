"use client";

/**
 * Print Format Builder left panel (docs/GAPS.md § 2.19 B): the DocType's printable fields and the blocks
 * (sections, page breaks, text, HTML …). A click adds after the selection.
 */
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { input } from "@/components/print-builder/styles";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import { BLOCKS, isPrintable, type PFField } from "@/lib/print-builder/layout";

const ID_FIELD = { fieldname: "name", label: "ID", fieldtype: "Data" } as DocField;
const SECTION_BLOCKS = [
  { key: "section", label: "Section", desc: "A new area for fields", pageBreak: false },
  { key: "page_break", label: "Page break", desc: "Start a new page", pageBreak: true },
];
const blockClass = "w-full rounded-md border border-zinc-200 px-2.5 py-2 text-left hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

interface Props {
  meta: DocTypeMeta | null;
  used: Set<string>;
  readOnly: boolean;
  onAdd: (f: PFField | DocField) => void;
  onAddSection: (pageBreak: boolean) => void;
}

function BlockButton({ label, desc, disabled, onClick }: { label: string; desc: string; disabled: boolean; onClick: () => void }) {
  return (
    <li>
      <button type="button" disabled={disabled} onClick={onClick} className={blockClass}>
        <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
        <span className="block text-xs text-zinc-500">{desc}</span>
      </button>
    </li>
  );
}

function FieldList({ meta, used, readOnly, onAdd }: Omit<Props, "onAddSection">) {
  const [q, setQ] = useState("");
  const fields = useMemo(() => (meta?.fields ?? []).filter(isPrintable).filter((f) => !q || `${f.label} ${f.fieldname}`.toLowerCase().includes(q.toLowerCase())), [meta, q]);
  return (
    <>
      <div className="relative px-3 py-2">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search fields" aria-label="Search fields" className={`${input} pl-7`} />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3" aria-busy={!meta}>
        {!meta && <li className="px-2 py-1.5 text-xs text-zinc-400">Loading fields…</li>}
        <li>
          <button type="button" onClick={() => onAdd(ID_FIELD)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <span className="truncate text-zinc-800 dark:text-zinc-200">ID (name)</span><span className="text-[11px] text-zinc-400">Data</span>
          </button>
        </li>
        {fields.map((f) => {
          const inLayout = used.has(f.fieldname);
          return (
            <li key={f.fieldname}>
              <button type="button" disabled={readOnly} onClick={() => onAdd(f)} title={inLayout ? "Already in the layout — adds another copy" : "Add after the selection"} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800">
                <span className={`truncate ${inLayout ? "text-zinc-400" : "text-zinc-800 dark:text-zinc-200"}`}>{f.label || f.fieldname}</span>
                <span className="shrink-0 text-[11px] text-zinc-400">{f.fieldtype}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function FieldsPanel(props: Props) {
  const [tab, setTab] = useState<"fields" | "blocks">("fields");
  const { readOnly, onAdd, onAddSection } = props;
  return (
    <aside aria-label="Fields and blocks" className="hidden min-h-0 flex-col border-r border-zinc-200 md:flex dark:border-zinc-800">
      <div role="tablist" className="flex gap-1 border-b border-zinc-200 px-3 pt-2 dark:border-zinc-800">
        {(["fields", "blocks"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-2 pb-1.5 text-sm capitalize ${tab === t ? "border-zinc-900 font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-100" : "border-transparent text-zinc-500"}`}>{t}</button>
        ))}
      </div>
      {tab === "fields" ? (
        <FieldList meta={props.meta} used={props.used} readOnly={readOnly} onAdd={onAdd} />
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {SECTION_BLOCKS.map((blk) => <BlockButton key={blk.key} label={blk.label} desc={blk.desc} disabled={readOnly} onClick={() => onAddSection(blk.pageBreak)} />)}
          {BLOCKS.map((blk) => <BlockButton key={blk.key} label={blk.label} desc={blk.desc} disabled={readOnly} onClick={() => onAdd(blk.make())} />)}
        </ul>
      )}
    </aside>
  );
}
