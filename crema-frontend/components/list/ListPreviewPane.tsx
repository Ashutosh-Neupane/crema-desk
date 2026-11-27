"use client";

/**
 * Record preview beside a list on wide screens (docs/PHASE2_DESIGN.md § 3.8 / PR 1; Desk ui/side_panel.js): the
 * clicked row's document — status, the fields that have a value (list-view, bold and mandatory ones first), its
 * tables as row counts — with previous / next and "Open" to the full page. ↑ / ↓ move, Esc closes (useListPreview).
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ExternalLink, Table2, X } from "lucide-react";
import { fetchDocument } from "@/lib/frappe/document";
import { formatValue } from "@/lib/frappe/format";
import { getIndicator } from "@/lib/list/indicator";
import { timeAgo } from "@/lib/list/format";
import { StatusPill } from "@/components/crema-ui";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";

const SKIP = new Set([
  "Section Break",
  "Column Break",
  "Tab Break",
  "HTML",
  "Button",
  "Heading",
  "Fold",
  "Image",
  "Password",
  "Signature",
  "Geolocation",
  "Code",
  "JSON",
  "Text Editor",
  "HTML Editor",
  "Markdown Editor",
]);
const TABLES = new Set(["Table", "Table MultiSelect"]);
const MAX_FIELDS = 16;
// shown elsewhere in the pane (status pill, header) or only bookkeeping
const NOISE = new Set(["status", "naming_series", "amended_from", "workflow_state", "docstatus"]);

type Doc = Record<string, unknown>;

const hasValue = (v: unknown) =>
  v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length);

/** fields worth showing, most telling first: list-view / bold / mandatory, then the rest in form order */
function previewFields(meta: DocTypeMeta, doc: Doc, titleField: string): DocField[] {
  const shown = (meta.fields ?? []).filter(
    (f) =>
      !SKIP.has(f.fieldtype) &&
      !TABLES.has(f.fieldtype) &&
      !f.hidden &&
      !(f.permlevel ?? 0) &&
      f.fieldname !== titleField &&
      !NOISE.has(f.fieldname) &&
      doc[f.fieldname] !== doc[titleField] &&
      hasValue(doc[f.fieldname]) &&
      !(f.fieldtype === "Check" && !doc[f.fieldname])
  );
  const rank = (f: DocField) => (f.in_list_view ? 0 : f.bold ? 1 : f.reqd ? 2 : 3);
  return shown
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
    .slice(0, MAX_FIELDS)
    .map((x) => x.f);
}

function Body({
  meta,
  doc,
  settings,
  titleField,
}: {
  meta: DocTypeMeta;
  doc: Doc;
  settings: Record<string, unknown> | undefined;
  titleField: string;
}) {
  const ind = getIndicator(doc, meta, settings);
  const fields = previewFields(meta, doc, titleField);
  const tables = (meta.fields ?? []).filter(
    (f) =>
      TABLES.has(f.fieldtype) &&
      !f.hidden &&
      Array.isArray(doc[f.fieldname]) &&
      (doc[f.fieldname] as unknown[]).length
  );
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base leading-snug font-semibold text-[var(--ink-default)]">
          {String(doc[titleField] || doc.name)}
        </h2>
        {doc[titleField] && doc[titleField] !== doc.name ? (
          <p className="text-xs text-[var(--ink-muted)]">{String(doc.name)}</p>
        ) : null}
        {ind && (
          <div className="mt-2">
            <StatusPill indicator={ind[1]}>{ind[0]}</StatusPill>
          </div>
        )}
      </div>
      <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        {fields.map((f) => (
          <div key={f.fieldname} className="contents">
            <dt className="truncate text-[var(--ink-muted)]" title={f.label ?? f.fieldname}>
              {f.label ?? f.fieldname}
            </dt>
            <dd
              className={`min-w-0 break-words text-[var(--ink-default)] ${["Currency", "Float", "Int", "Percent"].includes(f.fieldtype) ? "tabular" : ""}`}
            >
              {formatValue(doc[f.fieldname], f, doc) || "—"}
            </dd>
          </div>
        ))}
      </dl>
      {tables.length > 0 && (
        <ul className="space-y-1 border-t border-[var(--outline-default)] pt-3 text-sm">
          {tables.map((t) => (
            <li key={t.fieldname} className="flex items-center gap-2 text-[var(--ink-default)]">
              <Table2 className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden="true" />
              {t.label}
              <span className="tabular ml-auto text-xs text-[var(--ink-muted)]">
                {(doc[t.fieldname] as unknown[]).length === 1
                  ? "1 row"
                  : `${(doc[t.fieldname] as unknown[]).length} rows`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-[var(--outline-default)] pt-3 text-xs text-[var(--ink-muted)]">
        Last changed by {String(doc.modified_by ?? "")} · {timeAgo(doc.modified)}
      </p>
    </div>
  );
}

export function ListPreviewPane({
  meta,
  name,
  href,
  settings,
  titleField,
  onClose,
  onPrev,
  onNext,
}: {
  meta: DocTypeMeta;
  name: string;
  href: string;
  settings: Record<string, unknown> | undefined;
  titleField: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const {
    data: doc,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["list-preview", meta.name, name],
    queryFn: () => fetchDocument(meta.name, name) as Promise<Doc>,
    staleTime: 15_000,
  });
  const iconBtn =
    "rounded p-1 text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] disabled:opacity-35 disabled:hover:bg-transparent";
  return (
    <aside
      data-pane="list-preview"
      aria-label={`Preview of ${name}`}
      className="crema-fade self-start rounded-xl border border-[var(--outline-default)] bg-[var(--surface-raised)] lg:sticky lg:top-16 lg:max-h-[calc(100dvh-5rem)] lg:overflow-y-auto"
    >
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-[var(--outline-default)] bg-[var(--surface-raised)] px-3 py-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!onPrev}
          aria-label="Previous record"
          title="Previous (↑)"
          className={iconBtn}
        >
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!onNext}
          aria-label="Next record"
          title="Next (↓)"
          className={iconBtn}
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
        <Link
          href={href}
          className="ml-auto inline-flex h-7 items-center gap-1 rounded-md border border-[var(--outline-default)] px-2 text-xs font-medium text-[var(--ink-default)] hover:bg-[var(--surface-hover)]"
        >
          Open <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          title="Close (Esc)"
          className={iconBtn}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="p-4">
        {isLoading && (
          <div
            className="h-48 animate-pulse rounded-lg bg-[var(--surface-sunken)]"
            role="status"
            aria-label="Loading preview"
          />
        )}
        {error && (
          <p className="text-sm text-[var(--status-danger-fg)]">Couldn&apos;t load {name}.</p>
        )}
        {doc && <Body meta={meta} doc={doc} settings={settings} titleField={titleField} />}
      </div>
    </aside>
  );
}
