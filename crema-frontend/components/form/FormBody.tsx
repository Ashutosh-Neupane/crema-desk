"use client";

/**
 * Controlled form layout (Desk: frappe/public/js/frappe/form/layout.js):
 * tabs → sections → columns from the meta, rendering `values` and reporting
 * changes via onChange. Desk display rules:
 *  - read-only fields with no value are hidden
 *  - collapsible sections start collapsed (open when collapsible_depends_on
 *    is true or they hold an error); sections/tabs with nothing visible vanish
 *  - depends_on / mandatory_depends_on / read_only_depends_on see `doc` (and
 *    `parent` for child rows); script overrides (set_df_property) win
 */
import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import FormControl from "@/lib/crema-form/controls/FormControl";
import { parseDoctypeMeta } from "@/lib/crema-form/meta/parseDoctypeMeta";
import { evalDependsOn } from "@/lib/crema-form/dependsOn";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import { sysEnabled } from "@/lib/frappe/format";

/** Desk keeps these when read-only and empty (plus Table / Check / Heading, which Crema renders on their own) */
const KEEP_WHEN_EMPTY = new Set(["Table", "Check", "Heading", "HTML", "Button", "Image", "Geolocation", "Attachment Gallery"]);

type Values = Record<string, unknown>;

interface Props {
  meta: DocTypeMeta;
  values: Values;
  /** parent doc (child row forms) — available as `parent` in depends_on */
  parent?: Values;
  readOnly?: boolean;
  /** frappe.perm field display status for a field's permlevel (frm.perm); omitted = "Write" */
  fieldPerm?: (df: DocField) => "Write" | "Read" | "None";
  overrides?: Record<string, Record<string, unknown>>;
  /** key prefix for overrides (e.g. "items." for a child row form) */
  overridePrefix?: string;
  errors?: Record<string, string>;
  onChange: (fieldname: string, value: unknown) => void;
  getQuery?: (fieldname: string) => () => { filters?: unknown; query?: string } | undefined;
  /** renders Table fields (Grid) — omitted in child row forms */
  renderTable?: (df: DocField) => React.ReactNode;
  /** HTML fields Desk fills with a widget or script DOM (undefined → static `options` HTML) */
  renderHtml?: (df: DocField) => React.ReactNode | undefined;
  /** Button field clicked */
  onButton?: (fieldname: string) => void;
  /** tighter spacing (row editor, quick entry) */
  compact?: boolean;
  /** extra content appended to a tab (e.g. Connections) */
  tabExtras?: Record<string, React.ReactNode>;
  /** Ctrl+J "jump to field": switch to its tab, open its section, focus it */
  focusRequest?: { fieldname: string; n: number } | null;
}

const isEmpty = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

function dependsCtx(values: Values, parent?: Values) {
  return parent ? { ...values, parent } : values;
}

/** depends_on runs with `doc` (and `parent` for child rows), as in Desk */
const evalWith = (expr: string, values: Values, parent?: Values) => evalDependsOn(expr, values, parent);

export default function FormBody({
  meta,
  values,
  parent,
  readOnly = false,
  fieldPerm,
  overrides = {},
  overridePrefix = "",
  errors = {},
  onChange,
  getQuery,
  renderTable,
  renderHtml,
  onButton,
  compact = false,
  tabExtras,
  focusRequest,
}: Props) {
  const layout = useMemo(() => parseDoctypeMeta(meta), [meta]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const ctx = dependsCtx(values, parent);

  const [handled, setHandled] = useState(0);
  if (focusRequest && focusRequest.n !== handled) {
    // adjust state during render (no effect cascade): reveal the field's tab + section
    setHandled(focusRequest.n);
    const sec = layout.sections.find((s) => [...s.fields, ...s.childTables].some((f) => f.fieldname === focusRequest.fieldname));
    if (sec?.tab) setActiveTab(sec.tab);
    if (sec?.collapsible) setToggled((t) => new Set([...t, sec.fieldname]));
  }
  useEffect(() => {
    if (!focusRequest) return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[id$="-${CSS.escape(focusRequest.fieldname)}"]`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(t);
  }, [focusRequest]);

  const effective = (df: DocField): DocField & { _hidden: boolean } => {
    const o = (overrides[`${overridePrefix}${df.fieldname}`] ?? {}) as Partial<DocField>;
    const merged = { ...df, ...o } as DocField;
    // frappe.perm.get_field_display_status: a permlevel the user cannot read is hidden, one they cannot write is read-only
    const permStatus = fieldPerm ? fieldPerm(merged) : "Write";
    const ro = permStatus !== "Write" || !!merged.read_only || (!!merged.read_only_depends_on && evalWith(String(merged.read_only_depends_on), ctx, parent));
    const reqd = !!merged.reqd || (!!merged.mandatory_depends_on && evalWith(String(merged.mandatory_depends_on), ctx, parent));
    let hidden = permStatus === "None" || !!merged.hidden || (!!merged.depends_on && !evalWith(String(merged.depends_on), ctx, parent));
    // Desk base_control.js get_status: read-only fields with no value are hidden when System Settings
    // "Hide Empty Read-Only Fields" is on (the default); fields that show something without a value stay
    if (!hidden && (ro || readOnly) && !KEEP_WHEN_EMPTY.has(merged.fieldtype) && isEmpty(values[df.fieldname]) && sysEnabled("hide_empty_read_only_fields", true)) {
      hidden = true;
    }
    if (merged.fieldtype === "Button" && readOnly) hidden = true;
    // read-only / submitted tables with no rows have nothing to show either
    if (!hidden && (merged.fieldtype === "Table" || merged.fieldtype === "Table MultiSelect") && (ro || (readOnly && !merged.allow_on_submit)) && isEmpty(values[df.fieldname])) hidden = true;
    return { ...merged, read_only: ro ? 1 : 0, reqd: reqd ? 1 : 0, _hidden: hidden };
  };

  const renderField = (raw: DocField) => {
    const df = effective(raw);
    if (df._hidden) return null;
    if ((df.fieldtype === "Table" || df.fieldtype === "Table MultiSelect") && renderTable) {
      return (
        <div key={df.fieldname} className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {df.label}
            {!!df.reqd && <span aria-hidden="true" className="ml-0.5 text-red-500">*</span>}
          </label>
          {renderTable(df)}
          {errors[df.fieldname] && <span className="text-xs text-red-600">{errors[df.fieldname]}</span>}
        </div>
      );
    }
    if (df.fieldtype === "Table" || df.fieldtype === "Table MultiSelect") return null;
    if (df.fieldtype === "HTML" && renderHtml) {
      const node = renderHtml(df);
      if (node !== undefined) return <div key={df.fieldname}>{node}</div>;
    }
    return (
      <FormControl
        key={df.fieldname}
        field={df as DocField}
        value={values[df.fieldname]}
        onChange={(v) => onChange(df.fieldname, v)}
        disabled={readOnly || !!df.read_only}
        error={errors[df.fieldname]}
        doc={parent ? { ...parent, ...values } : values}
        getQuery={getQuery?.(df.fieldname)}
        onClick={df.fieldtype === "Button" && onButton ? () => onButton(df.fieldname) : undefined}
      />
    );
  };

  const sectionHasError = (fields: DocField[]) => fields.some((f) => errors[f.fieldname] || Object.keys(errors).some((k) => k.startsWith(`${f.fieldname}.`)));

  const renderSection = (section: (typeof layout.sections)[number]) => {
    if (section.depends_on && !evalWith(String(section.depends_on), ctx, parent)) return null;
    const cols = (section.columnFields ?? [section.fields]).map((col) => col.filter((f) => !effective(f as DocField)._hidden));
    if (!cols.some((c) => c.length)) return null;
    const all = cols.flat() as DocField[];
    const forced = !!section.collapsible_depends_on && evalWith(String(section.collapsible_depends_on), ctx, parent);
    const collapsedByDefault = !!section.collapsible && !forced && !sectionHasError(all);
    const isCollapsed = section.collapsible ? (toggled.has(section.fieldname) ? !collapsedByDefault : collapsedByDefault) : false;
    const nonEmptyCols = cols.filter((c) => c.length);
    // columns follow the form's own width (container queries), so an open sidebar or a dialog doesn't squeeze them
    const grid = nonEmptyCols.length >= 3 ? "@xl:grid-cols-2 @4xl:grid-cols-3" : nonEmptyCols.length === 2 ? "@xl:grid-cols-2" : "";
    const toggle = () => {
      const next = new Set(toggled);
      if (next.has(section.fieldname)) next.delete(section.fieldname);
      else next.add(section.fieldname);
      setToggled(next);
    };

    return (
      <section key={section.fieldname} className={`${compact ? "py-field" : "p-section"} border-b border-zinc-200 last:border-b-0 dark:border-zinc-800`}>
        {section.showLabel !== false && section.label && (
          section.collapsible ? (
            <button type="button" onClick={toggle} aria-expanded={!isCollapsed} className={`flex w-full items-center gap-2 text-left ${isCollapsed ? "" : "mb-field"}`}>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{section.label}</h3>
              <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
            </button>
          ) : (
            <h3 className="mb-field text-sm font-semibold text-zinc-900 dark:text-zinc-100">{section.label}</h3>
          )
        )}
        {!isCollapsed && (
          <div className={`grid grid-cols-1 gap-x-column gap-y-field ${grid}`}>
            {nonEmptyCols.map((col, i) => (
              <div key={i} className="flex min-w-0 flex-col gap-field">
                {col.map((f) => renderField(f as DocField))}
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  // tabs: visible when they have something to render
  const tabs = layout.tabs.filter((t) => (!t.depends_on || evalWith(String(t.depends_on), ctx, parent)) && (layout.sections.some((s) => s.tab === t.fieldname && [...s.fields, ...s.childTables].some((f) => !effective(f as DocField)._hidden)) || !!tabExtras?.[t.fieldname]));
  const current = tabs.find((t) => t.fieldname === activeTab)?.fieldname ?? tabs[0]?.fieldname;
  const shown = tabs.length ? layout.sections.filter((s) => s.tab === current) : layout.sections;
  const tabHasError = (tab: string) => layout.sections.some((s) => s.tab === tab && sectionHasError([...s.fields, ...s.childTables] as DocField[]));

  return (
    <div className={compact ? "@container" : "@container overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"}>
      {tabs.length > 1 && (
        <div className={`flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 ${compact ? "" : "px-3"}`} role="tablist">
          {tabs.map((t) => (
            <button
              key={t.fieldname}
              type="button"
              role="tab"
              aria-selected={t.fieldname === current}
              onClick={() => setActiveTab(t.fieldname)}
              className={[
                "relative whitespace-nowrap px-3 py-3 text-sm transition-colors",
                t.fieldname === current
                  ? "font-medium text-zinc-900 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-zinc-900 dark:text-zinc-100 dark:after:bg-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200",
              ].join(" ")}
            >
              {t.label}
              {tabHasError(t.fieldname) && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />}
            </button>
          ))}
        </div>
      )}
      {shown.map((s) => (
        <Fragment key={s.fieldname}>{renderSection(s)}</Fragment>
      ))}
      {current && tabExtras?.[current]}
    </div>
  );
}
