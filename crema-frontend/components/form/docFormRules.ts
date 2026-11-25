/**
 * Plain rules behind DocForm (Desk: frappe/public/js/frappe/form/form.js, toolbar.js, model/copy_doc):
 * the indicator, the primary button, copies for Duplicate / Amend, which tabs host extra content.
 */
import { isNewDoc, type Doc } from "@/lib/frappe/form";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { isWorkflowReadOnly, stateColour, type WorkflowDoc } from "@/lib/form/workflow";

/** Saving these changes other DocTypes' meta — drop cached metas so forms/lists pick it up */
export const META_EDITORS = new Set(["DocType", "Customize Form", "Custom Field", "Property Setter", "Client Script", "DocType Layout"]);

/** Fields Desk never copies on Duplicate/Amend (frappe.model.copy_doc) */
const NO_COPY_ALWAYS = new Set([
  "name", "owner", "creation", "modified", "modified_by", "docstatus", "idx", "amended_from",
  "amendment_date", "__islocal", "__unsaved", "_user_tags", "_comments", "_assign", "_liked_by", "_seen",
]);
const ROW_SERVER_KEYS = ["name", "parent", "creation", "modified", "owner", "modified_by", "docstatus"];

export function copyForNew(meta: DocTypeMeta, doc: Doc): Record<string, unknown> {
  const noCopy = new Set((meta.fields ?? []).filter((f) => f.no_copy).map((f) => f.fieldname));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (NO_COPY_ALWAYS.has(k) || noCopy.has(k)) continue;
    out[k] = Array.isArray(v)
      ? v.map((row) => {
          const r = { ...(row as Record<string, unknown>) };
          for (const key of ROW_SERVER_KEYS) delete r[key];
          return r;
        })
      : v;
  }
  return out;
}

/** Desk's form indicator: unsaved → cancelled → workflow → draft → status → submitted */
export function getIndicator(meta: DocTypeMeta, doc: Doc, dirty: boolean): [string, string] | null {
  if (isNewDoc(doc) || dirty) return ["Not Saved", "orange"];
  if (doc.docstatus === 2) return ["Cancelled", "red"];
  if (typeof doc.workflow_state === "string" && doc.workflow_state) return [doc.workflow_state, "blue"];
  if (meta.is_submittable && doc.docstatus === 0) return ["Draft", "red"];
  if (typeof doc.status === "string" && doc.status) {
    const s = doc.status.toLowerCase();
    return [doc.status, /to |pending|open|overdue|draft|hold/.test(s) ? "orange" : /complete|closed|paid|active|enabled|delivered/.test(s) ? "green" : /cancel|disabled|expired|lost/.test(s) ? "red" : "blue"];
  }
  if (meta.is_submittable && doc.docstatus === 1) return ["Submitted", "blue"];
  return null;
}

export type PrimaryAction = { label: string; kind: "save" | "submit" | "cancel" };

/** Desk toolbar.js set_primary_action: Save a draft / dirty doc, Submit a clean submittable draft, Cancel a submitted one */
export function primaryAction(opts: {
  meta: DocTypeMeta;
  doc: Doc;
  dirty: boolean;
  isNew: boolean;
  disableSave: boolean;
  can: (perm: string) => boolean;
}): PrimaryAction | null {
  const { meta, doc, dirty, isNew, disableSave, can } = opts;
  const docstatus = Number(doc.docstatus ?? 0);
  if (docstatus === 1) return can("cancel") ? { label: "Cancel", kind: "cancel" } : null;
  if (docstatus !== 0 || disableSave) return null;
  if (isNewDoc(doc) || dirty || !meta.is_submittable) return isNew || can("write") ? { label: "Save", kind: "save" } : null;
  return can("submit") ? { label: "Submit", kind: "submit" } : null;
}

/** the Connections tab (Desk's dashboard links) */
export const connectionsTabOf = (meta: DocTypeMeta) => (meta.fields ?? []).find((f) => f.fieldtype === "Tab Break" && /connection/i.test(f.fieldname))?.fieldname;

/** DocType / Customize Form: the tab holding the `form_builder` HTML field hosts the visual builder */
export function builderTabOf(meta: DocTypeMeta): string | undefined {
  let tab: string | undefined;
  let builderTab: string | undefined;
  for (const f of meta.fields ?? []) {
    if (f.fieldtype === "Tab Break") tab = f.fieldname;
    if (f.fieldname === "form_builder" && f.fieldtype === "HTML") builderTab = tab ?? "__details";
  }
  return builderTab;
}

/** Desk pageview.js show_not_permitted / show_not_found */
export function pageErrorText(err: { message: string; status?: number }, doctype: string, name?: string): { heading: string; detail: string } {
  if (err.status === 403) return { heading: "Not permitted", detail: `Sorry! You are not permitted to view ${doctype}${name ? ` ${name}` : ""}. Ask your System Manager for access.` };
  if (err.status === 404) return { heading: "Not found", detail: `${doctype} ${name ?? ""} does not exist, or was deleted or renamed.` };
  return { heading: "Could not open this document", detail: err.message };
}

/** Fields offered by Ctrl+J (Jump to field) */
const NOT_JUMPABLE = new Set(["Section Break", "Column Break", "Tab Break", "Fold", "HTML", "Heading"]);
export const jumpableFields = (meta: DocTypeMeta) => (meta.fields ?? []).filter((f) => !NOT_JUMPABLE.has(f.fieldtype) && !f.hidden && f.label);

/** Everything the form page derives from the meta, the live doc and the user's rights */
export function formView(opts: {
  doctype: string;
  meta: DocTypeMeta;
  doc: Doc;
  dirty: boolean;
  overrides: Record<string, Record<string, unknown>>;
  isNew: boolean;
  perms: Record<string, unknown>;
  roles: string[];
  workflow: WorkflowDoc | null;
  styles?: Record<string, string>;
  hasTransitions: boolean;
}) {
  const { doctype, meta, doc, dirty, overrides, isNew, perms, roles, workflow, styles } = opts;
  const saved = !isNewDoc(doc);
  const docstatus = Number(doc.docstatus ?? 0);
  const can = (p: string) => isNew || perms[p] === undefined || !!perms[p];
  const wfReadOnly = !!workflow && isWorkflowReadOnly(workflow, doc, roles);
  const readOnly = docstatus !== 0 || !can("write") || !!overrides.__form?.read_only || wfReadOnly;
  const wfState = workflow ? (doc[workflow.workflow_state_field] as string | undefined) : undefined;
  const indicator: [string, string] | null = workflow && wfState && saved && !dirty ? [wfState, stateColour(workflow, wfState, styles)] : getIndicator(meta, doc, dirty);
  const titleField = typeof meta.title_field === "string" ? meta.title_field : "";
  // Desk: the title is clickable to rename when the DocType allows renaming or has an editable title field
  const titleDf = titleField ? meta.fields?.find((f) => f.fieldname === titleField) : undefined;
  const titleEditable = !!titleDf && !titleDf.read_only && docstatus === 0;
  const titleValue = titleField ? doc[titleField] : "";
  // Desk workflow setup_btn: transitions replace the primary/secondary buttons
  const showTransitions = opts.hasTransitions && !dirty && saved;
  const primary = showTransitions ? null : primaryAction({ meta, doc, dirty, isNew, disableSave: !!overrides.__form?.disable_save, can });
  const canAmend = docstatus === 2 && can("amend");
  return {
    saved,
    docstatus,
    can,
    readOnly,
    indicator,
    titleField,
    titleEditable,
    canRename: saved && can("write") && (!!meta.allow_rename || titleEditable),
    title: !saved ? `New ${doctype}` : typeof titleValue === "string" && titleValue ? titleValue : doc.name,
    showTransitions,
    primary,
    canAmend,
    /** Amend, workflow Actions or the primary button (phones put them in a bottom bar) */
    hasMainActions: !!primary || showTransitions || canAmend,
    // Desk show_submit_message: a saved, clean draft of a submittable doctype without a workflow
    submitHint: !!meta.is_submittable && can("submit") && !dirty && !isNew && !workflow && docstatus === 0,
  };
}
export type FormView = ReturnType<typeof formView>;
