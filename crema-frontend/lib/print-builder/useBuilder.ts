"use client";

/**
 * Print Format Builder state (docs/GAPS.md § 2.19 B), on the same server draft as Desk's builder
 * (printing/doctype/print_format/print_format.py): edits autosave to `draft_data` with `save_draft`, nothing prints
 * until `apply_draft` (Save & Apply), `discard_draft` drops the draft. Every write carries the format's `modified`
 * and the server refuses a stale one, so Crema and an open Desk builder can't overwrite each other silently.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { deskCall, getDoc, DeskError, type Doc } from "@/lib/frappe/form";
import { DRAFT_FIELDS, parseLayout, serializeLayout, type PFLayout } from "@/lib/print-builder/layout";

const PF_METHOD = "frappe.printing.doctype.print_format.print_format.";
const AUTOSAVE_MS = 1200;

/** page-level settings the builder edits (everything in DRAFT_FIELDS except format_data) */
export type PFSettings = Record<string, unknown>;
type Snapshot = { layout: PFLayout; settings: PFSettings };
export type SaveStatus = "saved" | "draft" | "unsaved" | "saving" | "failed";

export function useBuilder(name: string) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** format_data is a classic (array) layout: only Desk can convert it */
  const [classic, setClassic] = useState(false);
  const [state, setState] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  /** mirrors past / future lengths so the Undo / Redo buttons re-render */
  const [hist, setHist] = useState({ undo: 0, redo: 0 });
  const syncHist = () => setHist({ undo: past.current.length, redo: future.current.length });
  const modified = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Snapshot | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const load = useCallback(async () => {
    try {
      const { doc: d } = await getDoc("Print Format", name);
      let draft: Record<string, unknown> | null = null;
      try {
        draft = d.draft_data ? (JSON.parse(String(d.draft_data)) as Record<string, unknown>) : null;
      } catch {
        draft = null;
      }
      const merged: Record<string, unknown> = { ...d, ...(draft ?? {}) };
      const layout = parseLayout(merged.format_data);
      modified.current = String(d.modified ?? "");
      setDoc(d);
      setClassic(!layout);
      const settings = Object.fromEntries(DRAFT_FIELDS.filter((k) => k !== "format_data").map((k) => [k, merged[k]]));
      const snap = { layout: layout ?? { sections: [] }, settings };
      latest.current = snap;
      past.current = [];
      future.current = [];
      syncHist();
      setState(snap);
      setStatus(draft ? "draft" : "saved");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the print format");
    }
  }, [name]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state is set after the await
    void load();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  const payload = (snap: Snapshot) => ({ ...snap.settings, print_format_builder_beta: 1, format_data: serializeLayout(snap.layout) });

  const onWriteError = useCallback((e: unknown) => {
    setStatus("failed");
    if (e instanceof DeskError && /TimestampMismatch/.test(e.excType ?? "")) {
      toast.error("This print format was changed somewhere else (another tab or Desk). Reload to get the latest.", {
        duration: 15000,
        action: { label: "Reload", onClick: () => void load() },
      });
    } else toast.error(e instanceof Error ? e.message : "Could not save the draft");
  }, [load]);

  const saveDraft = useCallback(async () => {
    timer.current = null;
    const snap = latest.current;
    if (!snap) return;
    // one write at a time: the next would carry the `modified` this one is about to move
    if (inflight.current) await inflight.current;
    setStatus("saving");
    const run = (async () => {
      try {
        const { env } = await deskCall(`${PF_METHOD}save_draft`, { name, data: JSON.stringify(payload(snap)), modified: modified.current });
        if (typeof env.message === "string") modified.current = env.message;
        // a newer edit may have arrived while this one was in flight
        setStatus(latest.current === snap ? "draft" : "unsaved");
      } catch (e) {
        onWriteError(e);
      }
    })();
    inflight.current = run;
    await run;
    inflight.current = null;
  }, [name, onWriteError]);

  const scheduleSave = useCallback(() => {
    setStatus("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveDraft(), AUTOSAVE_MS);
  }, [saveDraft]);

  /** apply an edit: history entry, then autosave after a pause (history lives in refs, outside state updaters,
   *  which React may run twice) */
  const edit = useCallback(
    (fn: (s: Snapshot) => Snapshot) => {
      const cur = latest.current;
      if (!cur) return;
      const next = fn(cur);
      if (next === cur) return;
      past.current = [...past.current.slice(-99), cur];
      future.current = [];
      syncHist();
      latest.current = next;
      setState(next);
      scheduleSave();
    },
    [scheduleSave],
  );

  const travel = useCallback(
    (dir: "undo" | "redo") => {
      const cur = latest.current;
      const from = dir === "undo" ? past : future;
      const to = dir === "undo" ? future : past;
      const target = from.current[from.current.length - 1];
      if (!cur || !target) return;
      from.current = from.current.slice(0, -1);
      to.current = [...to.current, cur];
      latest.current = target;
      setState(target);
      syncHist();
      scheduleSave();
    },
    [scheduleSave],
  );

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      await saveDraft();
    } else if (inflight.current) await inflight.current;
  }, [saveDraft]);

  /** Save & Apply: what prints becomes the draft */
  const apply = useCallback(async () => {
    const snap = latest.current;
    if (!snap) return false;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inflight.current) await inflight.current;
    setStatus("saving");
    try {
      const { env } = await deskCall(`${PF_METHOD}apply_draft`, { name, modified: modified.current, data: JSON.stringify(payload(snap)) });
      const saved = env.message as Doc | undefined;
      if (saved?.modified) modified.current = String(saved.modified);
      if (saved) setDoc(saved);
      setStatus("saved");
      toast.success("Applied: prints use this layout now");
      return true;
    } catch (e) {
      onWriteError(e);
      return false;
    }
  }, [name, onWriteError]);

  /** Discard draft: back to what prints */
  const discard = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inflight.current) await inflight.current;
    try {
      await deskCall(`${PF_METHOD}discard_draft`, { name, modified: modified.current });
      await load();
      toast.success("Draft discarded");
    } catch (e) {
      onWriteError(e);
    }
  }, [name, load, onWriteError]);

  const undo = useCallback(() => travel("undo"), [travel]);
  const redo = useCallback(() => travel("redo"), [travel]);
  const previewDoc = useCallback(() => (state && doc ? { ...doc, ...payload(state) } : null), [state, doc]);

  return {
    doc,
    error,
    classic,
    layout: state?.layout ?? null,
    settings: state?.settings ?? {},
    status,
    canUndo: hist.undo > 0,
    canRedo: hist.redo > 0,
    edit,
    undo,
    redo,
    flush,
    apply,
    discard,
    reload: load,
    /** the in-memory format for render_builder_preview */
    previewDoc,
  };
}
