"use client";

/** The form builder's right panel: essentials, move buttons, looks and common flags, then Advanced. */
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  ChevronDown,
  Columns3,
  Copy,
  Trash2,
  X,
} from "lucide-react";
import LinkInput from "@/components/list/LinkInput";
import { COMMON_TYPES, LAYOUT, scrub, type F } from "./builderTree";

function Check({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label
      className="flex cursor-pointer items-start gap-2 py-1 text-sm text-zinc-700 dark:text-zinc-200"
      title={hint}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
      />
      <span>{label}</span>
    </label>
  );
}

const inputCls =
  "h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const OPTIONS_HELP: Record<string, string> = {
  Select: "One option per line",
  Link: "DocType to link to",
  "Dynamic Link": "Field that holds the DocType",
  Table: "Child DocType",
  "Table MultiSelect": "Child DocType",
  Currency: "Currency field (e.g. currency)",
  Code: "Language: Javascript, Python, HTML, CSS, JSON, SQL",
  Data: "Email, Name, Phone, URL, Barcode, IBAN (optional)",
};
const textareaCls =
  "w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
export type SetProp = (k: string, v: unknown) => void;
const flag = (set: SetProp, k: string) => (v: boolean) => set(k, v ? 1 : 0);

export interface MoveActions {
  left?: () => void;
  right?: () => void;
  newColumn?: () => void;
}

function MoveButtons({ move }: { move: MoveActions }) {
  const btn =
    "inline-flex min-h-8 items-center gap-1 rounded-md border border-zinc-200 px-2 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Move field">
      <button type="button" className={btn} disabled={!move.left} onClick={move.left}>
        <ArrowLeftToLine className="h-3.5 w-3.5" /> Column to the left
      </button>
      <button type="button" className={btn} disabled={!move.right} onClick={move.right}>
        Column to the right <ArrowRightToLine className="h-3.5 w-3.5" />
      </button>
      <button type="button" className={btn} disabled={!move.newColumn} onClick={move.newColumn}>
        <Columns3 className="h-3.5 w-3.5" /> New column beside
      </button>
    </div>
  );
}

export function Properties({
  f,
  types,
  set,
  onDelete,
  onDuplicate,
  onClose,
  move,
}: {
  f: F;
  types: string[];
  set: SetProp;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
  move?: MoveActions;
}) {
  const [advanced, setAdvanced] = useState(false);
  const isNewField = String(f.name).startsWith("new-") || !!f.__islocal;
  const layout = LAYOUT.has(f.fieldtype);
  const onLabel = (v: string) => {
    set("label", v);
    // Desk derives the fieldname from the label until the field is saved
    if (isNewField) set("fieldname", scrub(v));
  };
  return (
    <div className="space-y-4">
      <PanelHeader
        title={layout ? f.fieldtype : "Field"}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onClose={onClose}
      />
      <LabelInput value={String(f.label ?? "")} onChange={onLabel} />
      {layout ? (
        <LayoutLooks f={f} set={set} />
      ) : (
        <FieldEssentials f={f} types={types} isNewField={isNewField} set={set} move={move} />
      )}
      <button
        type="button"
        onClick={() => setAdvanced((a) => !a)}
        className="flex w-full items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${advanced ? "" : "-rotate-90"}`}
        />{" "}
        Advanced
      </button>
      {advanced && <AdvancedProps f={f} layout={layout} set={set} />}
    </div>
  );
}

function PanelHeader({
  title,
  onDuplicate,
  onDelete,
  onClose,
}: {
  title: string;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <button
        type="button"
        onClick={onDuplicate}
        aria-label="Duplicate field"
        className="ml-auto rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
      >
        <Copy className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete field"
        className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close properties"
        className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** a section's looks (DocField collapsible / hide_border) */
function LayoutLooks({ f, set }: { f: F; set: SetProp }) {
  if (f.fieldtype !== "Section Break") return null;
  return (
    <div className="grid grid-cols-2 gap-x-2 rounded-lg border border-zinc-100 p-2 dark:border-zinc-800">
      <Check label="Collapsible" checked={!!f.collapsible} onChange={flag(set, "collapsible")} />
      <Check label="Hide border" checked={!!f.hide_border} onChange={flag(set, "hide_border")} />
    </div>
  );
}

function FieldEssentials({
  f,
  types,
  isNewField,
  set,
  move,
}: {
  f: F;
  types: string[];
  isNewField: boolean;
  set: SetProp;
  move?: MoveActions;
}) {
  return (
    <>
      <TypeAndName f={f} types={types} isNewField={isNewField} set={set} />
      {(!!OPTIONS_HELP[f.fieldtype] || !!f.options) && <OptionsInput f={f} set={set} />}
      {move && <MoveButtons move={move} />}
      <CommonFlags f={f} set={set} />
      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-500">Description</span>
        <textarea
          value={String(f.description ?? "")}
          onChange={(e) => set("description", e.target.value || null)}
          rows={2}
          className={textareaCls}
        />
      </label>
    </>
  );
}

/** the label input takes focus when the properties panel opens for a field */
function LabelInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-zinc-500">Label</span>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </label>
  );
}

function TypeAndName({
  f,
  types,
  isNewField,
  set,
}: {
  f: F;
  types: string[];
  isNewField: boolean;
  set: SetProp;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-500">Type</span>
        <select
          value={f.fieldtype}
          onChange={(e) => set("fieldtype", e.target.value)}
          className={inputCls}
        >
          <optgroup label="Common">
            {COMMON_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </optgroup>
          <optgroup label="All">
            {types
              .filter((t) => !COMMON_TYPES.includes(t) && !LAYOUT.has(t))
              .map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
          </optgroup>
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-500">Field name</span>
        <input
          value={String(f.fieldname ?? "")}
          onChange={(e) => set("fieldname", scrub(e.target.value))}
          readOnly={!isNewField}
          className={`${inputCls} font-mono text-xs ${isNewField ? "" : "bg-zinc-50 text-zinc-500 dark:bg-zinc-800"}`}
        />
      </label>
    </div>
  );
}

// plain words for what Options means per type (Desk shows "Options" for all)
const OPTIONS_LABEL: Record<string, string> = {
  Link: "Links to",
  Table: "Rows from",
  "Table MultiSelect": "Rows from",
  Select: "Choices",
  "Dynamic Link": "DocType field",
};

function OptionsInput({ f, set }: { f: F; set: SetProp }) {
  const value = String(f.options ?? "");
  const isLink = ["Link", "Table", "Table MultiSelect"].includes(f.fieldtype);
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-zinc-500">
        {OPTIONS_LABEL[f.fieldtype] ?? "Options"}{" "}
        <span className="font-normal text-zinc-400">· {OPTIONS_HELP[f.fieldtype] ?? ""}</span>
      </span>
      {isLink ? (
        <LinkInput
          doctype="DocType"
          value={value}
          onChange={(v) => set("options", v || null)}
          placeholder="DocType"
          getQuery={() => (f.fieldtype === "Link" ? undefined : { filters: { istable: 1 } })}
        />
      ) : f.fieldtype === "Select" ? (
        <textarea
          value={value}
          onChange={(e) => set("options", e.target.value)}
          rows={4}
          className={textareaCls}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => set("options", e.target.value || null)}
          className={inputCls}
        />
      )}
    </label>
  );
}

const COMMON_FLAGS: Array<[string, string]> = [
  ["reqd", "Mandatory"],
  ["in_list_view", "In List View"],
  ["read_only", "Read Only"],
  ["in_standard_filter", "Standard Filter"],
  ["hidden", "Hidden"],
  ["unique", "Unique"],
  ["bold", "Bold"],
  ["allow_in_quick_entry", "Quick Entry"],
];
const ADVANCED_FLAGS: Array<[string, string]> = [
  ["allow_on_submit", "Allow on Submit"],
  ["no_copy", "No Copy"],
  ["set_only_once", "Set Only Once"],
  ["in_global_search", "Global Search"],
  ["fetch_if_empty", "Fetch if Empty"],
  ["print_hide", "Print Hide"],
];

function CommonFlags({ f, set }: { f: F; set: SetProp }) {
  return (
    <div className="grid grid-cols-2 gap-x-2 rounded-lg border border-zinc-100 p-2 dark:border-zinc-800">
      {COMMON_FLAGS.map(([k, label]) => (
        <Check key={k} label={label} checked={!!f[k]} onChange={flag(set, k)} />
      ))}
    </div>
  );
}

function AdvancedProps({ f, layout, set }: { f: F; layout: boolean; set: SetProp }) {
  const texts = [
    ["default", "Default"],
    ["depends_on", "Display depends on (JS)"],
    ["mandatory_depends_on", "Mandatory depends on (JS)"],
    ["read_only_depends_on", "Read only depends on (JS)"],
    ...(layout
      ? []
      : [
          ["fetch_from", "Fetch from (link_field.source_field)"],
          ["placeholder", "Placeholder"],
        ]),
  ];
  return (
    <div className="space-y-3">
      {texts.map(([k, label]) => (
        <label key={k} className="block space-y-1">
          <span className="text-xs font-medium text-zinc-500">{label}</span>
          <input
            value={String(f[k] ?? "")}
            onChange={(e) => set(k, e.target.value || null)}
            className={`${inputCls} ${k.includes("depends") ? "font-mono text-xs" : ""}`}
            placeholder={k.includes("depends") ? "eval:doc.status == 'Open'" : ""}
          />
        </label>
      ))}
      {!layout && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-500">Length</span>
            <input
              type="number"
              value={String(f.length ?? "")}
              onChange={(e) => set("length", e.target.value ? Number(e.target.value) : 0)}
              className={inputCls}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-500">Grid columns (1–10)</span>
            <input
              type="number"
              min={0}
              max={10}
              value={String(f.columns ?? "")}
              onChange={(e) => set("columns", e.target.value ? Number(e.target.value) : 0)}
              className={inputCls}
            />
          </label>
        </div>
      )}
      {!layout && (
        <div className="grid grid-cols-2 gap-x-2">
          {ADVANCED_FLAGS.map(([k, label]) => (
            <Check key={k} label={label} checked={!!f[k]} onChange={flag(set, k)} />
          ))}
        </div>
      )}
    </div>
  );
}
