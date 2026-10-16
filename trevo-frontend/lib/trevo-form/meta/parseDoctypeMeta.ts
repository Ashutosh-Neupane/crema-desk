/**
 * Parse Frappe DocType meta into Trevo's enhanced format.
 * Handles sections, tabs, columns, and all field types.
 */

import type { DocTypeMeta, DocField } from "@/lib/frappe/types";
import type { TrevoField, FormSection, FormLayout, FormTab } from "../types";


const STRUCTURAL_TYPES = new Set([
  "Section Break", "Column Break", "Tab Break", "Fold",
]);

interface ParsedMeta {
  fields: TrevoField[];
  sections: FormSection[];
  /** Tab Breaks in order; empty when the DocType has no tabs */
  tabs: FormTab[];
  layout: FormLayout;
}

/**
 * Parse Frappe metadata into Trevo's internal format.
 * Handles sections, tabs, and column breaks automatically.
 */
export function parseDoctypeMeta(meta: DocTypeMeta): ParsedMeta {
  const rawFields = meta.fields ?? [];

  // Separate structural fields from data fields
  const structuralFields = rawFields.filter((f) => STRUCTURAL_TYPES.has(f.fieldtype));
  const dataFields = rawFields.filter((f) => !STRUCTURAL_TYPES.has(f.fieldtype));

  // Enhance data fields with Trevo-specific properties
  const enhancedFields: TrevoField[] = dataFields.map((f) => enhanceField(f));

  // Build Desk layout: tabs → sections → columns
  const { sections, tabs } = buildLayout(rawFields, enhancedFields);

  // Determine layout based on column breaks
  const layout = determineLayout(structuralFields);

  return {
    fields: enhancedFields,
    sections,
    tabs,
    layout,
  };
}

function enhanceField(f: DocField): TrevoField {
  return {
    fieldname: f.fieldname,
    label: f.label ?? f.fieldname,
    fieldtype: f.fieldtype,
    reqd: !!f.reqd,
    required: !!f.reqd,
    read_only: !!f.read_only,
    readOnly: !!f.read_only,
    hidden: !!f.hidden,
    collapsed: !!f.collapsed,
    description: f.description ?? undefined,
    placeholder: (typeof f.placeholder === "string" ? f.placeholder : undefined),

    options: f.options ?? null,
    depends_on: typeof f.depends_on === "string" ? f.depends_on : null,
    mandatory_depends_on: typeof f.mandatory_depends_on === "string" ? f.mandatory_depends_on : null,
    read_only_depends_on: typeof f.read_only_depends_on === "string" ? f.read_only_depends_on : null,
    default: f.default ?? null,
    length: typeof f.length === "number" ? f.length : undefined,
    precision: typeof f.precision === "number" ? f.precision : undefined,

    inListView: !!f.in_list_view,
    allowInQuickEntry: !!f.allow_in_quick_entry,
    columns: (typeof f.columns === "number" ? f.columns : 1) as 1 | 2 | 3,
    searchIndex: typeof f.search_index === "number" ? f.search_index : 0,
    regex: typeof f.regex === "string" ? f.regex : undefined,
    validation: typeof f.custom_regex === "string" ? f.custom_regex : undefined,
    cssClass: typeof f.css_class === "string" ? f.css_class : undefined,
    compact: f.compact ? true : undefined,
    fullWidth: f.full_width ? true : undefined,
    sortOrder: typeof f.idx === "number" ? f.idx : 0,
    


  };
}

/**
 * Desk's form layout (frappe/public/js/frappe/form/layout.js):
 *  - Tab Break starts a tab (fields before the first one go in a "Details" tab)
 *  - Section Break starts a section inside the current tab; an unlabeled one
 *    has no header, only `collapsible` ones toggle
 *  - Column Break starts a new column inside the current section; fields flow
 *    top→bottom within their column
 *  - Tables stay in their column position, Fold collapses everything after it
 */
function buildLayout(allFields: DocField[], dataFields: TrevoField[]): { sections: FormSection[]; tabs: FormTab[] } {
  const byName = new Map(dataFields.map((f) => [f.fieldname, f]));
  const sections: FormSection[] = [];
  const tabs: FormTab[] = [];
  let currentTab: string | undefined;
  let section: FormSection | null = null;
  let folded = false;

  const openSection = (f: Partial<DocField> & { fieldname: string }, opts: { collapsed?: boolean } = {}) => {
    section = {
      label: (f.label as string) ?? "",
      fieldname: f.fieldname,
      collapsed: opts.collapsed ?? (!!f.collapsible && !!(f as { collapsed?: unknown }).collapsed),
      columns: 1,
      fields: [],
      childTables: [],
      columnFields: [[]],
      tab: currentTab,
      showLabel: !!f.label,
      collapsible: !!f.collapsible || !!opts.collapsed,
      collapsible_depends_on: typeof f.collapsible_depends_on === "string" ? f.collapsible_depends_on : null,
      depends_on: typeof f.depends_on === "string" ? f.depends_on : null,
    };
    sections.push(section);
    return section;
  };
  const ensureSection = (): FormSection => section ?? openSection({ fieldname: `_section_${sections.length}` });

  for (const f of allFields) {
    switch (f.fieldtype) {
      case "Tab Break":
        if (!tabs.length && (sections.length || section)) {
          // fields before the first Tab Break form an implicit first tab
          tabs.push({ fieldname: "__details", label: "Details" });
          for (const s of sections) s.tab = "__details";
        }
        currentTab = f.fieldname;
        tabs.push({ fieldname: f.fieldname, label: f.label ?? f.fieldname, depends_on: typeof f.depends_on === "string" ? f.depends_on : null });
        section = null;
        break;
      case "Section Break":
        openSection(f);
        break;
      case "Fold":
        folded = true;
        openSection({ ...f, label: f.label || "More" }, { collapsed: true });
        break;
      case "Column Break": {
        const s = ensureSection();
        s.columnFields!.push([]);
        s.columns = s.columnFields!.length;
        break;
      }
      default: {
        const field = byName.get(f.fieldname);
        if (!field) break;
        const s = ensureSection();
        s.columnFields![s.columnFields!.length - 1].push(field);
        if (f.fieldtype === "Table") s.childTables.push(field);
        else s.fields.push(field);
      }
    }
  }
  void folded;

  // Drop columns left empty by trailing breaks; keep sections that render something
  for (const s of sections) {
    s.columnFields = s.columnFields!.filter((c) => c.length > 0);
    if (!s.columnFields.length) s.columnFields = [[]];
    s.columns = s.columnFields.length;
  }
  return { sections: sections.filter((s) => s.fields.length || s.childTables.length), tabs };
}

function determineLayout(structuralFields: DocField[]): FormLayout {
  const columnBreaks = structuralFields.filter((f) => f.fieldtype === "Column Break");
  const hasTabs = structuralFields.some((f) => f.fieldtype === "Tab Break");

  return {
    mode: "standard",
    columns: (columnBreaks.length > 0
    ? Math.min(columnBreaks.length + 1, 3)
    : 1) as 1 | 2 | 3,
    sections: [],
    showDescriptions: true,
    showLabels: true,
    labelPosition: hasTabs ? "top" : "left",
  };
}

/**
 * Get options for a Select/Autocomplete field
 */
export function getFieldOptions(field: TrevoField): string[] {
  if (!field.options) return [];
  return String(field.options)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Check if a field type is a numeric field
 */
export function isNumericField(fieldtype: string): boolean {
  return ["Int", "Float", "Currency", "Percent"].includes(fieldtype);
}

/**
 * Check if a field type is a date/time field
 */
export function isDateTimeField(fieldtype: string): boolean {
  return ["Date", "Datetime", "Time"].includes(fieldtype);
}

/**
 * Check if a field type is a link field
 */
export function isLinkField(fieldtype: string): boolean {
  return ["Link", "Dynamic Link", "Autocomplete"].includes(fieldtype);
}

/**
 * Check if a field type is an attachment field
 */
export function isAttachmentField(fieldtype: string): boolean {
  return ["Attach", "Attach Image", "Signature"].includes(fieldtype);
}

/**
 * Get the display value for a field value
 */
export function formatFieldValue(value: unknown, fieldtype: string): string {
  if (value === null || value === undefined || value === "") return "-";

  switch (fieldtype) {
    case "Check":
      return value ? "Yes" : "No";
    case "Date":
    case "Datetime":
    case "Time":
      return typeof value === "string" ? value : String(value);
    case "Int":
    case "Float": {
      const num = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(num)) return String(value);
      return new Intl.NumberFormat("en-US").format(num);
    }
    case "Percent": {
      const num = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(num)) return String(value);
      return `${new Intl.NumberFormat("en-US").format(num)}%`;
    }
    case "Currency": {
      const num = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(num)) return String(value);
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(num);
    }
    default:
      return String(value);
  }
}
