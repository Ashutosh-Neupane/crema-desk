"use client";

/**
 * DocForm's document state: loads the doc + docinfo, creates one FormController per form instance once meta, context
 * and the doc are known, follows realtime updates (Desk form.js doc_update / form_viewers.js) and warns before
 * leaving with unsaved changes.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { FormController, newFormDoc } from "@/lib/form/FormController";
import { attachDoctypeAdapters } from "@/lib/form/adapters";
import { DeskError, getDoc, type Doc, type DocInfo } from "@/lib/frappe/form";
import { takePrefill } from "@/lib/form/prefill";
import { defaultState, getWorkflow } from "@/lib/form/workflow";
import { addRecentDoc } from "@/lib/utils/recentDocs";
import { useDocRealtime } from "@/lib/services/realtime";
import type { DocTypeMeta } from "@/lib/frappe/types";
import type { DeskContext } from "@/app/api/desk/context/route";

export type Loaded = { doc: Doc; docinfo: DocInfo };
type Metas = { meta: DocTypeMeta; children: DocTypeMeta[] };

function makeController(metas: Metas, ctx: DeskContext, base: Doc, isNew: boolean, docinfo: DocInfo | undefined, navigate: (href: string) => void) {
  // Desk set_default_state: a new doc starts in the workflow state for docstatus 0
  const wfNew = isNew ? getWorkflow(metas.meta) : null;
  const doc = wfNew && !base[wfNew.workflow_state_field] ? { ...base, [wfNew.workflow_state_field]: defaultState(wfNew, 0) ?? undefined } : base;
  const c = new FormController(metas.meta, metas.children, doc, {
    user: ctx.user,
    full_name: ctx.full_name,
    roles: ctx.roles,
    defaults: ctx.defaults,
    sysdefaults: ctx.sysdefaults,
    perms: ctx.perms,
    developer_mode: ctx.developer_mode,
    boot: ctx.boot,
    navigate,
  });
  c.setDocinfo(docinfo);
  attachDoctypeAdapters(c);
  c.loadScripts();
  return c;
}

/** Desk route_options: ?field=value on the URL is applied after load (fires field events, e.g. Customize Form ?doc_type=X) */
const routeOptionsOf = (meta: DocTypeMeta) => [...new URLSearchParams(window.location.search).entries()].filter(([k]) => meta.fields?.some((f) => f.fieldname === k));
async function applyRouteOptions(c: FormController, routeOptions: Array<[string, string]>) {
  for (const [k, v] of routeOptions) {
    // one at a time, in URL order: each set_value runs that field's events like Desk
    // react-doctor-disable-next-line async-await-in-loop
    await c.set_value(k, v);
  }
}

const noopSubscribe = () => () => {};

export function useDocForm(doctype: string, name: string | undefined, metas: Metas | undefined, ctx: DeskContext | undefined) {
  const router = useRouter();
  const isNew = !name;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<{ message: string; status?: number } | null>(null);
  const [prefill] = useState<Record<string, unknown>>(() => (name ? {} : takePrefill(doctype)));

  const load = useCallback(async () => {
    if (!name) return;
    try {
      const r = await getDoc(doctype, name);
      addRecentDoc({ doctype, name: r.doc.name, title: typeof r.doc.title === "string" ? r.doc.title : undefined });
      setLoaded(r);
      setLoadError(null);
    } catch (e) {
      setLoadError({ message: e instanceof Error ? e.message : "Failed to load document", status: e instanceof DeskError ? e.status : undefined });
    }
  }, [doctype, name]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state is set after the await
    void load();
  }, [load]);

  // One controller per form instance, created once meta, context and the doc are known
  const ctlRef = useRef<FormController | null>(null);
  const [ctl, setCtl] = useState<FormController | null>(null);
  useEffect(() => {
    if (!metas || !ctx || ctlRef.current) return;
    if (!isNew && !loaded) return;
    const base = isNew ? newFormDoc(metas.meta, ctx, prefill) : loaded!.doc;
    const c = makeController(metas, ctx, base, isNew, loaded?.docinfo, (href) => router.push(href));
    ctlRef.current = c;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time controller creation once inputs are ready
    setCtl(c);
    const routeOptions = routeOptionsOf(metas.meta);
    void c.runLoadEvents(true).then(() => applyRouteOptions(c, routeOptions));
  }, [metas, ctx, loaded, isNew, prefill, router]);

  // Later reloads (Reload / after cancel) feed the same controller
  useEffect(() => {
    const c = ctlRef.current;
    if (loaded && c && c.docname === loaded.doc.name && c.getDoc().modified !== loaded.doc.modified) {
      c.load(loaded.doc);
      void c.runLoadEvents(false);
    }
  }, [loaded]);

  // the server's per-document permissions/shares feed frm.perm
  useEffect(() => {
    ctlRef.current?.setDocinfo(loaded?.docinfo);
  }, [loaded, ctl]);

  const snap = useSyncExternalStore(ctl?.subscribe ?? noopSubscribe, () => ctl?.snapshot() ?? null, () => null);

  // Realtime: reload a clean form when someone else saves, warn on a dirty one; show who else has it open
  const [conflict, setConflict] = useState<string | null>(null);
  const [viewers, setViewers] = useState<string[]>([]);
  useDocRealtime(isNew ? undefined : doctype, isNew ? undefined : name, {
    onUpdate: (e) => {
      const c = ctlRef.current;
      if (!c || !e.modified || e.modified === c.getDoc().modified) return;
      if (c.isDirty()) setConflict(String(e.modified));
      else void load();
    },
    onViewers: (users) => setViewers(users.filter((u) => u !== ctx?.user)),
  });
  const [prevLoaded, setPrevLoaded] = useState(loaded);
  if (prevLoaded !== loaded) {
    setPrevLoaded(loaded);
    setConflict(null);
  }

  // Warn before leaving with unsaved changes (Desk does the same)
  const dirty = !!snap?.dirty;
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  return { ctlRef, ctl, snap, loaded, setLoaded, load, loadError, conflict, viewers };
}
