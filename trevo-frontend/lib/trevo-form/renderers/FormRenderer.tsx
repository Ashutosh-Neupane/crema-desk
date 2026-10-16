"use client";

import { useMemo, useState, useCallback, useEffect, useRef, useImperativeHandle, type Ref } from "react";
import type { DocTypeMeta, DocField, FrappeDocument } from "@/lib/frappe/types";
import type { TrevoDocument } from "../types";
import { parseDoctypeMeta } from "../meta/parseDoctypeMeta";
import FormControl from "../controls/FormControl";
import TableField from "../controls/TableField";
import { useTrevoFormStore } from "../FormStore";
import { validateFields } from "../validation";
import { useFormScripts } from "../scriptBridge/useFormScripts";
import { FormTour } from "../FormTour";
import { evalDependsOn } from "../dependsOn";

/** Imperative API the page header uses (Desk's frm.save / frm.savesubmit). */
export interface FormHandle {
  /** Runs client validate hooks + mandatory check, then onSave. Resolves false if blocked. */
  save: () => Promise<boolean>;
  submit: () => Promise<boolean>;
  getValues: () => Record<string, unknown>;
  isDirty: () => boolean;
}

interface FormRendererProps {
  /** Exposes save/submit/getValues to the parent (page-level action buttons) */
  formRef?: Ref<FormHandle>;
  /** Hide the built-in Save/Submit bar when the page header owns the actions */
  hideActions?: boolean;
  meta: DocTypeMeta | null | undefined;
  doc?: TrevoDocument | FrappeDocument | null;
  editable?: boolean;
  readOnly?: boolean;
  onChange?: (values: Record<string, unknown>) => void;
  onSave?: (values: Record<string, unknown>) => Promise<void>;
  onSubmit?: (values: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
  onDiscard?: () => void;
  className?: string;
}

export default function FormRenderer({
  formRef,
  hideActions = false,
  meta,
  doc,
  editable = true,
  readOnly = false,
  onChange,
  onSave,
  onSubmit,
  onCancel,
  onDiscard,
  className = "",
}: FormRendererProps) {
  const store = useTrevoFormStore();
  const { fields, sections, tabs } = useMemo(() => {
    if (!meta) return { fields: [], sections: [], tabs: [] };
    return parseDoctypeMeta(meta);
  }, [meta]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const isReadOnly = Boolean(readOnly || (doc && typeof doc === "object" && "docstatus" in doc && doc.docstatus !== 0 && doc.docstatus !== undefined));

  const formValues = useMemo(() => {
    if (!doc) {
      return fields.reduce<Record<string, unknown>>((acc, f) => ({ ...acc, [f.fieldname]: f.default ?? "" }), {});
    }
    if ("values" in doc && doc.values) {
      return doc.values as Record<string, unknown>;
    }
    const raw = doc as FrappeDocument;
    const vals: Record<string, unknown> = {};
    for (const key of Object.keys(raw)) {
      if (!["name", "doctype", "owner", "creation", "modified", "modified_by", "parent", "parenttype", "parentfield", "idx", "docstatus", "__islocal", "__unsaved"].includes(key)) {
        vals[key] = raw[key];
      }
    }
    return vals;
  }, [doc, fields]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastSavedValues, setLastSavedValues] = useState<string>("");
  const [localValues, setLocalValues] = useState<Record<string, unknown>>(formValues);
  const historyRef = useRef<Array<Record<string, unknown>>>([]);

  // Stable ref for handleFieldChange (used by script bridge before handleFieldChange is defined)
  const fieldChangeRef = useRef<(fieldname: string, value: unknown) => void>(() => {});
  const saveRef = useRef<(() => Promise<void>) | undefined>(undefined);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setLocalValues(formValues);
    setLastSavedValues(JSON.stringify(formValues));
    historyRef.current = [];
  }, [doc, formValues]);

  const isDirty = useMemo(() => {
    const current = JSON.stringify(localValues);
    return current !== lastSavedValues;
  }, [localValues, lastSavedValues]);

  const handleFieldChange = useCallback((fieldname: string, value: unknown) => {
    historyRef.current = [...historyRef.current, localValues];
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
    }
    const next = { ...localValues, [fieldname]: value };
    setLocalValues(next);
    onChange?.(next);
    store.setField(fieldname, value);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fieldname];
      return next;
    });
  }, [localValues, onChange, store]);

  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const previous = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setLocalValues(previous);
    onChange?.(previous);
  }, [onChange]);

  const runValidation = useCallback(() => {
    const validationErrors = validateFields(fields, localValues);
    const mapped = Object.fromEntries(validationErrors.map((e) => [e.fieldname, e.message])) as Record<string, string>;
    setErrors(mapped);
    return validationErrors.length === 0;
  }, [fields, localValues]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!runValidation()) return false;
    const next = { ...localValues };
    await onSave?.(next);
    setLastSavedValues(JSON.stringify(next));
    return true;
  }, [runValidation, onSave, localValues]);

  const handleSubmit = useCallback(async (): Promise<boolean> => {
    if (!runValidation()) return false;
    const next = { ...localValues };
    await onSubmit?.(next);
    setLastSavedValues(JSON.stringify(next));
    return true;
  }, [runValidation, onSubmit, localValues]);

  // ── Frappe Script Bridge ───────────────────────────────────────────────────
  const docname = String((doc as FrappeDocument)?.name ?? "");

  // Keep refs in sync with latest callbacks (avoids stale closure in script bridge)
  useEffect(() => {
    fieldChangeRef.current = handleFieldChange;
  }, [handleFieldChange]);
  useEffect(() => {
    saveRef.current = onSave ? async () => { await handleSave(); } : undefined;
  }, [onSave, handleSave]);

  // Stable wrapper so the script bridge always invokes the latest save via ref
  const saveViaRef = useCallback(async () => {
    await saveRef.current?.();
  }, []);

  const { dfOverrides, fireEvent } = useFormScripts(
    meta?.name ?? "",
    docname,
    localValues,
    (fieldname, value) => fieldChangeRef.current(fieldname, value),
    onSave ? saveViaRef : undefined,
  );

  // Wire fireEvent into save/submit: run "validate" hook before saving
  const handleSaveWithHooks = useCallback(async (): Promise<boolean> => {
    if (fireEvent("validate") === false) return false;
    if (fireEvent("before_save") === false) return false;
    const ok = await handleSave();
    if (ok) fireEvent("after_save");
    return ok;
  }, [fireEvent, handleSave]);

  const handleSubmitWithHooks = useCallback(async (): Promise<boolean> => {
    if (fireEvent("validate") === false) return false;
    if (fireEvent("before_submit") === false) return false;
    const ok = await handleSubmit();
    if (ok) fireEvent("on_submit");
    return ok;
  }, [fireEvent, handleSubmit]);

  useImperativeHandle(formRef, () => ({
    save: handleSaveWithHooks,
    submit: handleSubmitWithHooks,
    getValues: () => ({ ...localValues }),
    isDirty: () => isDirty,
  }), [handleSaveWithHooks, handleSubmitWithHooks, localValues, isDirty]);

  useEffect(() => {
    if (!editable || isReadOnly) return;

    const handler = (e: KeyboardEvent) => {
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes((window.document.activeElement as HTMLElement | null)?.tagName ?? "");

      // Ctrl/Cmd+S saves from anywhere on the form, like Desk
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && onSave) {
        e.preventDefault();
        void handleSaveWithHooks();
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !isInput) {
        e.preventDefault();
        handleUndo();
      }
    };

    window.document.addEventListener("keydown", handler);
    return () => window.document.removeEventListener("keydown", handler);
  }, [editable, isReadOnly, onSave, runValidation, handleSaveWithHooks, handleUndo]);

  /** depends_on context: Desk evaluates against the full doc incl. name/docstatus/__islocal */
  const evalDoc = useMemo(() => {
    const raw = (doc ?? {}) as Record<string, unknown>;
    return {
      ...localValues,
      name: raw.name,
      doctype: raw.doctype ?? meta?.name,
      docstatus: raw.docstatus ?? 0,
      __islocal: raw.__islocal ?? (!raw.name || String(raw.name).startsWith("new-") ? 1 : 0),
    };
  }, [localValues, doc, meta?.name]);

  const isFieldVisible = (f: (typeof fields)[number]) => {
    const override = dfOverrides[f.fieldname];
    if (override?.hidden !== undefined) return !override.hidden;
    if (f.hidden) return false;
    if (typeof f.depends_on === "string" && f.depends_on) return evalDependsOn(f.depends_on, evalDoc);
    return true;
  };

  const renderField = (field: (typeof fields)[number]) => {
    if (field.fieldtype === "Table") {
      return (
        <div key={field.fieldname} className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {field.label || field.fieldname}
            {!!field.reqd && <span className="ml-1 text-red-500">*</span>}
          </label>
          <TableField
            field={field as DocField}
            value={localValues[field.fieldname]}
            onChange={(val) => handleFieldChange(field.fieldname, val)}
            disabled={!editable || isReadOnly}
            doc={localValues}
          />
          {errors[field.fieldname] && <span className="text-xs text-red-600">{errors[field.fieldname]}</span>}
        </div>
      );
    }
    // Merge script-level overrides and *_depends_on into field meta before rendering
    const override = dfOverrides[field.fieldname];
    const mandatoryByDepends =
      typeof field.mandatory_depends_on === "string" && field.mandatory_depends_on
        ? evalDependsOn(field.mandatory_depends_on, evalDoc)
        : false;
    const readOnlyByDepends =
      typeof field.read_only_depends_on === "string" && field.read_only_depends_on
        ? evalDependsOn(field.read_only_depends_on, evalDoc)
        : false;
    const mergedField = {
      ...field,
      reqd: override?.reqd !== undefined ? (override.reqd ? 1 : 0) : (field.reqd || mandatoryByDepends ? 1 : 0),
      read_only: override?.read_only !== undefined ? (override.read_only ? 1 : 0) : (field.read_only || readOnlyByDepends ? 1 : 0),
    };
    return (
      <FormControl
        key={field.fieldname}
        field={mergedField as DocField}
        value={localValues[field.fieldname]}
        onChange={(val) => handleFieldChange(field.fieldname, val)}
        disabled={!editable || isReadOnly || !!mergedField.read_only}
        error={errors[field.fieldname]}
        doc={localValues}
      />
    );
  };

  const renderSection = (section: typeof sections[0]) => {
    if (section.depends_on && !evalDependsOn(section.depends_on, evalDoc)) return null;
    const columns = (section.columnFields ?? [section.fields]).map((col) => col.filter(isFieldVisible));
    if (!columns.some((c) => c.length)) return null;

    // collapsedSections tracks user toggles; collapsible_depends_on forces it open
    const toggled = store.collapsedSections.has(section.fieldname);
    const forcedOpen = !!section.collapsible_depends_on && evalDependsOn(section.collapsible_depends_on, evalDoc);
    const startsCollapsed = !!section.collapsible && (section.collapsed || !!section.collapsible_depends_on) && !forcedOpen;
    const isCollapsed = section.collapsible ? (startsCollapsed ? !toggled : toggled) : false;
    const gridCols =
      columns.length >= 4 ? "md:grid-cols-4" : columns.length === 3 ? "md:grid-cols-3" : columns.length === 2 ? "md:grid-cols-2" : "";

    return (
      <section key={section.fieldname} className="border-b border-zinc-200 px-5 py-5 last:border-b-0 dark:border-zinc-800">
        {section.showLabel !== false && section.label && (
          section.collapsible ? (
            <button
              type="button"
              onClick={() => store.toggleSection(section.fieldname)}
              className="mb-4 flex w-full items-center gap-2 text-left"
            >
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{section.label}</h3>
              <svg
                className={`h-4 w-4 text-zinc-400 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{section.label}</h3>
          )
        )}
        {!isCollapsed && (
          <div className={`grid grid-cols-1 gap-x-8 gap-y-4 ${gridCols}`}>
            {columns.map((col, i) => (
              <div key={i} className="flex min-w-0 flex-col gap-4">
                {col.map(renderField)}
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  const visibleTabs = tabs.filter((t) => !t.depends_on || evalDependsOn(t.depends_on, evalDoc));
  const currentTab = visibleTabs.find((t) => t.fieldname === activeTab)?.fieldname ?? visibleTabs[0]?.fieldname;
  const sectionsInView = visibleTabs.length ? sections.filter((s) => s.tab === currentTab) : sections;
  // A tab shows an error dot when one of its fields failed validation
  const tabHasError = (tab: string) =>
    sections.some((s) => s.tab === tab && [...s.fields, ...s.childTables].some((f) => errors[f.fieldname]));

  if (!meta) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-zinc-500">Loading form...</div>
      </div>
    );
  }

  return (
    <div className={["space-y-4", className].join(" ")}>
      {/* Form Tour — shows step-by-step highlights when a Form Tour doc exists for this doctype */}
      {meta.name && editable && !isReadOnly && (
        <FormTour doctype={meta.name} enabled={!!docname} />
      )}
      {!hideActions && (onSave || onSubmit || onCancel || onDiscard) && editable && !isReadOnly && (
        <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isDirty ? "bg-orange-500" : "bg-green-500"}`} />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">{isDirty ? "Not Saved" : "Saved"}</span>
          </div>
          <div className="flex gap-2">
              {onSave && (
                <button
                  type="button"
                  onClick={handleSaveWithHooks}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
                >
                  Save
                </button>
              )}
              {onSubmit && (
                <button
                  type="button"
                  onClick={handleSubmitWithHooks}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  Submit
                </button>
              )}
            {onDiscard && (
              <button
                type="button"
                onClick={onDiscard}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
              >
                Discard
              </button>
            )}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-zinc-600 dark:text-red-400 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {visibleTabs.length > 1 && (
          <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 px-3 dark:border-zinc-800" role="tablist">
            {visibleTabs.map((t) => (
              <button
                key={t.fieldname}
                type="button"
                role="tab"
                aria-selected={t.fieldname === currentTab}
                onClick={() => setActiveTab(t.fieldname)}
                className={[
                  "relative whitespace-nowrap px-3 py-3 text-sm transition-colors",
                  t.fieldname === currentTab
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
        {sectionsInView.map((section) => renderSection(section))}
      </div>
    </div>
  );
}
