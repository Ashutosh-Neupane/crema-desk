"use client";

/**
 * useFormScripts — React hook that:
 *   1. Loads client scripts for the doctype on mount
 *   2. Fires "refresh" hook on load
 *   3. Fires "change:<fieldname>" hook when field values change
 *   4. Exposes fireHook() so the form can call validate/before_submit/after_submit
 *   5. Applies df_property overrides from scripts (hidden, reqd, read_only)
 *   6. Exposes setQuery results so LinkField can apply them
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { loadAndExecuteScripts } from "./ScriptLoader";
import { fireHook, createFrmAPI, type ScriptHooks, type FormContext, type FrmAPI } from "./ScriptSandbox";
import { frappeMethod } from "@/lib/frappe/client";
import { toast } from "sonner";

export interface DfOverride {
  hidden?: boolean;
  reqd?: boolean;
  read_only?: boolean;
  options?: string;
  [prop: string]: unknown;
}

export interface UseFormScriptsResult {
  /** Per-field overrides from scripts (hidden, reqd, etc.) */
  dfOverrides: Record<string, DfOverride>;
  /** Per-field query filters from set_query() calls */
  fieldQueries: Record<string, (doc: Record<string, unknown>) => Record<string, unknown>>;
  /** Fire a named hook event. Returns false if the event was blocked (e.g. validate) */
  fireEvent: (event: string) => boolean;
  /** True while scripts are loading */
  scriptsLoading: boolean;
}

export function useFormScripts(
  doctype: string,
  docname: string,
  values: Record<string, unknown>,
  onFieldChange: (fieldname: string, value: unknown) => void,
  onSave?: () => Promise<void>,
): UseFormScriptsResult {
  const hooksRef = useRef<ScriptHooks>(new Map());
  const frmRef = useRef<FrmAPI | null>(null);
  const prevValuesRef = useRef<Record<string, unknown>>({});
  const [dfOverrides, setDfOverrides] = useState<Record<string, DfOverride>>({});
  const [fieldQueries, setFieldQueries] = useState<Record<string, (doc: Record<string, unknown>) => Record<string, unknown>>>({});
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const loadedRef = useRef(false);

  // Build FormContext — recreated on every render with current values/callbacks
  const getCtx = useCallback((): FormContext => ({
    doc: values,
    doctype,
    docname,

    getValue: (fieldname) => values[fieldname],

    setValue: (fieldname, value) => {
      onFieldChange(fieldname, value);
    },

    setDfProperty: (fieldname, prop, value) => {
      setDfOverrides((prev) => ({
        ...prev,
        [fieldname]: { ...(prev[fieldname] ?? {}), [prop]: value },
      }));
    },

    setQuery: (fieldname, fn) => {
      setFieldQueries((prev) => ({ ...prev, [fieldname]: fn }));
    },

    save: async () => {
      await onSave?.();
    },

    msgprint: (msg) => {
      toast.info(msg);
    },

    throw: (msg) => {
      toast.error(msg);
      throw new Error(msg);
    },

    callMethod: async (method, args) => {
      try {
        return await frappeMethod(method, args);
      } catch {
        return null;
      }
    },
  }), [doctype, docname, values, onFieldChange, onSave]);

  // Load scripts on mount (once per doctype)
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setScriptsLoading(true);

    const ctx = getCtx();
    loadAndExecuteScripts(doctype, ctx)
      .then((hooks) => {
        hooksRef.current = hooks;
        // Build frm with current ctx
        frmRef.current = createFrmAPI(ctx);
        // Fire "refresh" hook after scripts are loaded
        fireHook(hooks, doctype, "refresh", frmRef.current);
      })
      .catch((err) => {
        console.error("[useFormScripts] load error:", err);
      })
      .finally(() => {
        setScriptsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctype]); // Only re-run if doctype changes

  // Keep frmRef in sync with latest values
  useEffect(() => {
    const ctx = getCtx();
    frmRef.current = createFrmAPI(ctx);
  }, [getCtx]);

  // Fire change hooks when field values change
  useEffect(() => {
    const prev = prevValuesRef.current;
    const frm = frmRef.current;
    if (!frm || hooksRef.current.size === 0) return;

    for (const [fieldname, newValue] of Object.entries(values)) {
      if (prev[fieldname] !== newValue) {
        // Fire "fieldname" change hook
        fireHook(hooksRef.current, doctype, fieldname, frm);
        // Fire "change:fieldname" hook
        fireHook(hooksRef.current, doctype, `change:${fieldname}`, frm);
        // Fire generic "onchange" hook
        fireHook(hooksRef.current, doctype, "onchange", frm);
      }
    }

    prevValuesRef.current = { ...values };
  }, [doctype, values]);

  const fireEvent = useCallback((event: string): boolean => {
    const frm = frmRef.current;
    if (!frm) return true;
    return fireHook(hooksRef.current, doctype, event, frm);
  }, [doctype]);

  return { dfOverrides, fieldQueries, fireEvent, scriptsLoading };
}
