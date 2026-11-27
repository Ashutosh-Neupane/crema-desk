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
import { Fragment, useMemo } from "react";
import { useFormBodyState } from "@/components/form/useFormBodyState";

import FormTabs from "@/components/form/FormTabs";
import FormSection from "@/components/form/FormSection";
import { planSection } from "@/lib/form/sectionPlan";
import FormControl from "@/lib/crema-form/controls/FormControl";
import { parseDoctypeMeta } from "@/lib/crema-form/meta/parseDoctypeMeta";
import { evalDependsOn } from "@/lib/crema-form/dependsOn";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import { sysEnabled } from "@/lib/frappe/format";

/** Desk keeps these when read-only and empty (plus Table / Check / Heading, which Crema renders on their own) */
const KEEP_WHEN_EMPTY = new Set(["Table", "Check", "Heading", "HTML", "Button", "Image", "Geolocation", "Attachment Gallery"]);
/** New layout: tabs past this many go into a "More" menu */
const TABS_SHOWN = 4;

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
  /** New layout: each section is its own card; more than TABS_SHOWN tabs overflow into a menu */
  cards?: boolean;
  /** New layout, saved documents: empty optional sections start folded, and a section's empty optional fields fold
   * into "More fields (n)" past MORE_AFTER (PHASE2_DESIGN § 4.3). A new document shows everything */
  foldEmpty?: boolean;
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
  cards = false,
  foldEmpty = false,
}: Props) {
  const layout = useMemo(() => parseDoctypeMeta(meta), [meta]);
  const { activeTab, setActiveTab, toggled, opened, flipToggled, flipOpened } = useFormBodyState(layout, overrides, overridePrefix, focusRequest);
  const ctx = dependsCtx(values, parent);

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
    // read-only / submitted tables with no rows have nothing to show either
    if (!hidden && (merged.fieldtype === "Table" || merged.fieldtype === "Table MultiSelect") && (ro || (readOnly && !merged.allow_on_submit)) && isEmpty(values[df.fieldname])) hidden = true;
    return { ...merged, read_only: ro ? 1 : 0, reqd: reqd ? 1 : 0, _hidden: hidden };
  };

  const renderField = (raw: DocField) => {
    const df = effective(raw);
    if (df._hidden) return null;
    if ((df.fieldtype === "Table" || df.fieldtype === "Table MultiSelect") && renderTable) {
      return (
        <div key={df.fieldname} data-fieldtype={df.fieldtype} className="flex min-w-0 flex-col gap-1.5">
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
        // button.js can_write(): a Button is always clickable, also on a read-only / submitted document
        disabled={df.fieldtype === "Button" ? false : readOnly || !!df.read_only}
        error={errors[df.fieldname]}
        doc={parent ? { ...parent, ...values } : values}
        getQuery={getQuery?.(df.fieldname)}
        onClick={(df.fieldtype === "Button" || df.fieldtype === "Comment") && onButton ? () => onButton(df.fieldname) : undefined}
      />
    );
  };

  // an empty field the user may fill but doesn't have to: what the New layout folds away on a saved document
  const foldable = (f: DocField) => {
    const df = effective(f);
    return !df.reqd && !df.read_only && !KEEP_WHEN_EMPTY.has(df.fieldtype) && df.fieldtype !== "Table MultiSelect" && isEmpty(values[f.fieldname]) && !errors[f.fieldname];
  };

  const sectionHasError = (fields: DocField[]) => fields.some((f) => errors[f.fieldname] || Object.keys(errors).some((k) => k.startsWith(`${f.fieldname}.`)));

  /** `next`: the section after it in the same tab. An unlabelled one continues this section (Desk draws them as one) */
  const renderSection = (section: (typeof layout.sections)[number], next?: (typeof layout.sections)[number]) => {
    if (section.depends_on && !evalWith(String(section.depends_on), ctx, parent)) return null;
    const cols = (section.columnFields ?? [section.fields]).map((col) => (col as DocField[]).filter((f) => !effective(f)._hidden));
    if (!cols.some((c) => c.length)) return null;
    const plan = planSection({
      fieldname: section.fieldname,
      collapsible: !!section.collapsible,
      forcedOpen: !!section.collapsible_depends_on && evalWith(String(section.collapsible_depends_on), ctx, parent),
      hasError: sectionHasError(cols.flat()),
      cols,
      // an unlabelled next section continues this one (Sales Order's "Items" holds scan / warehouse fields and the
      // grid follows in an unlabelled section), so this heading stays
      continued: !!next && !next.label,
      fold: foldEmpty && !readOnly,
      isFoldable: foldable,
      toggled: toggled.has(section.fieldname),
      isOpened: (key) => opened.has(key),
    });
    const frame = cards
      ? "rounded-xl border border-zinc-200 bg-white p-section dark:border-zinc-800 dark:bg-zinc-900"
      : `${compact ? "py-field" : "p-section"} ${section.hideBorder ? "" : "border-b border-zinc-200 last:border-b-0 dark:border-zinc-800"}`;
    return (
      <FormSection
        key={section.fieldname}
        label={section.showLabel !== false ? (section.label ?? "") : ""}
        plan={plan}
        frame={frame}
        cards={cards}
        onToggle={() => (plan.mode === "fold" ? flipOpened(section.fieldname) : flipToggled(section.fieldname))}
        onMore={() => flipOpened(`${section.fieldname}:more`)}
        renderField={renderField}
      />
    );
  };

  // tabs: visible when not hidden (meta or a script: frm.set_df_property / field.tab.toggle) and with something to render
  const tabHidden = (fieldname: string) => {
    const o = overrides[`${overridePrefix}${fieldname}`] as { hidden?: unknown } | undefined;
    const df = meta.fields?.find((f) => f.fieldname === fieldname);
    return !!(o && "hidden" in o ? o.hidden : df?.hidden);
  };
  const tabs = layout.tabs.filter((t) => !tabHidden(t.fieldname) && (!t.depends_on || evalWith(String(t.depends_on), ctx, parent)) && (layout.sections.some((s) => s.tab === t.fieldname && [...s.fields, ...s.childTables].some((f) => !effective(f as DocField)._hidden)) || !!tabExtras?.[t.fieldname]));
  const current = tabs.find((t) => t.fieldname === activeTab)?.fieldname ?? tabs[0]?.fieldname;
  const shown = tabs.length ? layout.sections.filter((s) => s.tab === current) : layout.sections;
  const tabErrors = (tab: string) => layout.sections.filter((s) => s.tab === tab).flatMap((s) => [...s.fields, ...s.childTables]).filter((f) => sectionHasError([f as DocField])).length;

  return (
    <div className={compact ? "@container" : cards ? "@container space-y-stack" : "@container overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"}>
      {tabs.length > 1 && <FormTabs tabs={tabs} current={current} onSelect={setActiveTab} errors={tabErrors} cards={cards} compact={compact} shown={TABS_SHOWN} />}
      {shown.map((s, i) => (
        <Fragment key={s.fieldname}>{renderSection(s, shown[i + 1])}</Fragment>
      ))}
      {current && tabExtras?.[current]}
    </div>
  );
}
