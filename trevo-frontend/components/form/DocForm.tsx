"use client";

/**
 * Desk-style document form — one page for viewing and editing, like
 * /desk/<doctype>/<name>. Built on FormController (the live doc, scripts,
 * fetch_from, child events) and FormBody/Grid (layout).
 *
 * Save pipeline = Desk's frappe.ui.form.save:
 *   validate → before_save → mandatory check → savedocs → reload → after_save → refresh
 * Submit adds before_submit / on_submit; Cancel before_cancel / after_cancel.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Copy, CopyPlus, Loader2, MoreHorizontal, Paperclip, Plus, RefreshCw, Send, Tag, Trash2, UserPlus } from "lucide-react";
import FormBody from "@/components/form/FormBody";
import Grid from "@/components/form/Grid";
import FormBuilder from "@/components/form/FormBuilder";
import { useFormMetas } from "@/lib/hooks/useFormMetas";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { FormController, newFormDoc } from "@/lib/form/FormController";
import { attachDoctypeAdapters } from "@/lib/form/adapters";
import { cancelDoc, deleteDoc, deskCall, getDoc, isNewDoc, saveDoc, type Doc, type DocInfo, type SaveAction } from "@/lib/frappe/form";
import { PREFILL_KEY } from "@/lib/form/prefill";
import { applyWorkflow, defaultState, getWorkflow, isWorkflowReadOnly, stateColour, useTransitions, type Transition } from "@/lib/form/workflow";
import { confirm as deskConfirm } from "@/lib/desk-runtime/dialogs";
import { addRecentDoc } from "@/lib/utils/recentDocs";
import { clearDoctypeMetaCache } from "@/lib/frappe/doctype";
import { useShortcuts } from "@/lib/shortcuts";
import { Command } from "cmdk";

/** Saving these changes other DocTypes' meta — drop cached metas so forms/lists pick it up */
const META_EDITORS = new Set(["DocType", "Customize Form", "Custom Field", "Property Setter", "Client Script", "DocType Layout"]);
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { FormSkeleton } from "@/components/Skeleton";
import { INDICATOR_PILL } from "@/lib/list/indicator";
import type { DocTypeMeta } from "@/lib/frappe/types";

const enc = encodeURIComponent;

/** Fields Desk never copies on Duplicate/Amend (frappe.model.copy_doc) */
const NO_COPY_ALWAYS = new Set([
  "name", "owner", "creation", "modified", "modified_by", "docstatus", "idx", "amended_from",
  "amendment_date", "__islocal", "__unsaved", "_user_tags", "_comments", "_assign", "_liked_by", "_seen",
]);

function copyForNew(meta: DocTypeMeta, doc: Doc): Record<string, unknown> {
  const noCopy = new Set((meta.fields ?? []).filter((f) => f.no_copy).map((f) => f.fieldname));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (NO_COPY_ALWAYS.has(k) || noCopy.has(k)) continue;
    out[k] = Array.isArray(v)
      ? v.map((row) => {
          const r = { ...(row as Record<string, unknown>) };
          for (const key of ["name", "parent", "creation", "modified", "owner", "modified_by", "docstatus"]) delete r[key];
          return r;
        })
      : v;
  }
  return out;
}

/** Desk's form indicator: unsaved → cancelled → workflow → draft → status → submitted */
function getIndicator(meta: DocTypeMeta, doc: Doc, dirty: boolean): [string, string] | null {
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

function timeAgo(iso?: unknown): string {
  if (typeof iso !== "string") return "";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso.replace(" ", "T")).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/** __dashboard → Connections: related doctypes with counts (frappe.desk.notifications.get_open_count) */
function Connections({ meta, doc }: { meta: DocTypeMeta; doc: Doc }) {
  const dash = (meta as { __dashboard?: { fieldname?: string; non_standard_fieldnames?: Record<string, string>; transactions?: Array<{ label?: string; items: string[] }> } }).__dashboard;
  const items = useMemo(() => (dash?.transactions ?? []).flatMap((t) => t.items), [dash]);
  const { data: counts } = useQuery({
    queryKey: ["open-count", meta.name, doc.name],
    enabled: !!items.length && !isNewDoc(doc),
    queryFn: async () => {
      const { env } = await deskCall("frappe.desk.notifications.get_open_count", { doctype: meta.name, name: doc.name, items: JSON.stringify(items) });
      const count = (env.message as { count?: Array<{ name: string; count: number }> } | undefined)?.count ?? [];
      return Object.fromEntries(count.map((c) => [c.name, c.count]));
    },
  });
  if (!dash?.transactions?.length || isNewDoc(doc)) return null;
  const fieldFor = (dt: string) => dash.non_standard_fieldnames?.[dt] ?? dash.fieldname ?? "";
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
      {dash.transactions.map((t) => (
        <div key={t.label ?? t.items.join(",")}>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">{t.label}</h4>
          <ul className="space-y-1">
            {t.items.map((dt) => (
              <li key={dt} className="flex items-center gap-2">
                <Link href={`/desk/doctype/${enc(dt)}?${new URLSearchParams({ [fieldFor(dt)]: doc.name })}`} className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                  <span className="flex-1 truncate">{dt}</span>
                  {!!counts?.[dt] && <span className="rounded-full bg-zinc-100 px-1.5 text-xs tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{counts[dt]}</span>}
                </Link>
                <Link href={`/desk/doctype/${enc(dt)}/new`} aria-label={`New ${dt}`} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800">
                  <Plus className="h-3.5 w-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

interface Props {
  doctype: string;
  /** Omit for a new document */
  name?: string;
}

export default function DocForm({ doctype, name }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: metas, error: metaError } = useFormMetas(doctype);
  const { data: ctx } = useDeskContext();
  const isNew = !name;

  const [loaded, setLoaded] = useState<{ doc: Doc; docinfo: DocInfo } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "save" | "submit" | "cancel" | "delete">(null);
  const [confirm, setConfirm] = useState<null | "submit" | "cancel" | "delete">(null);
  const [missing, setMissing] = useState<string[] | null>(null);
  const [comment, setComment] = useState("");
  const [prefill] = useState<Record<string, unknown>>(() => {
    if (typeof window === "undefined" || name) return {};
    try {
      const raw = sessionStorage.getItem(PREFILL_KEY(doctype));
      if (raw) sessionStorage.removeItem(PREFILL_KEY(doctype));
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  });

  const load = useCallback(async () => {
    if (!name) return;
    try {
      const r = await getDoc(doctype, name);
      addRecentDoc({ doctype, name: r.doc.name, title: typeof r.doc.title === "string" ? r.doc.title : undefined });
      setLoaded(r);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load document");
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
      navigate: (href) => router.push(href),
    });
    attachDoctypeAdapters(c);
    c.loadScripts();
    ctlRef.current = c;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time controller creation once inputs are ready
    setCtl(c);
    void c.runLoadEvents(true);
  }, [metas, ctx, loaded, isNew, prefill, router]);

  // Later reloads (Reload / after cancel) feed the same controller
  useEffect(() => {
    const c = ctlRef.current;
    if (loaded && c && c.docname === loaded.doc.name && c.getDoc().modified !== loaded.doc.modified) {
      c.load(loaded.doc);
      void c.runLoadEvents(false);
    }
  }, [loaded]);

  const noopSubscribe = useCallback(() => () => {}, []);
  const snap = useSyncExternalStore(ctl?.subscribe ?? noopSubscribe, () => ctl?.snapshot() ?? null, () => null);

  // workflow: active Workflow from the meta, transitions for the saved + clean doc
  const workflow = useMemo(() => getWorkflow(metas?.meta), [metas]);
  const { data: transitions = [] } = useTransitions(workflow, snap?.doc ?? null, !!snap?.dirty, ctx?.user, ctx?.roles ?? []);
  const { data: stateStyles } = useQuery({
    queryKey: ["workflow-state-styles"],
    enabled: !!workflow,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { env } = await deskCall("frappe.client.get_list", { doctype: "Workflow State", fields: ["name", "style"], limit_page_length: 0 });
      return Object.fromEntries(((env.message as Array<{ name: string; style?: string }>) ?? []).map((w) => [w.name, w.style ?? ""]));
    },
  });
  const [wfBusy, setWfBusy] = useState(false);
  const runTransition = useCallback(
    async (t: Transition) => {
      const c = ctlRef.current;
      if (!c) return;
      const go = async () => {
        setWfBusy(true);
        try {
          c.frm.selected_workflow_action = t.action;
          if (!(await c.trigger("before_workflow_action"))) return;
          const doc = await applyWorkflow(c.getDoc(), t.action);
          c.load(doc);
          setLoaded((l) => (l ? { ...l, doc } : l));
          c.frm.selected_workflow_action = null;
          await c.trigger("after_workflow_action");
          await c.runLoadEvents(false);
          qc.invalidateQueries({ queryKey: ["list", doctype] });
          toast.success(`${t.action}: ${t.next_state}`);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Workflow action failed", { duration: 10000 });
        } finally {
          setWfBusy(false);
        }
      };
      if (workflow?.enable_action_confirmation) deskConfirm(`Are you sure you want to ${t.action}?`, () => void go());
      else await go();
    },
    [workflow, qc, doctype],
  );

  // Warn before leaving with unsaved changes (Desk does the same)
  useEffect(() => {
    if (!snap?.dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [snap?.dirty]);

  // ── actions ─────────────────────────────────────────────────────────────
  const persist = useCallback(
    async (action: SaveAction) => {
      const c = ctlRef.current;
      if (!c) return;
      if (!(await c.trigger("validate"))) return;
      if (action !== "Submit" && !(await c.trigger("before_save"))) return;
      if (action === "Submit" && !(await c.trigger("before_submit"))) return;
      const miss = c.validateMandatory();
      if (miss.length) {
        setMissing(miss);
        return;
      }
      const wasNew = isNewDoc(c.getDoc());
      const { doc: saved, messages } = await saveDoc(c.getDoc(), action);
      messages.forEach((m) => toast.info(m));
      c.load(saved);
      await c.trigger(action === "Submit" ? "on_submit" : "after_save");
      qc.invalidateQueries({ queryKey: ["list", doctype] });
      if (META_EDITORS.has(doctype)) {
        clearDoctypeMetaCache();
        qc.invalidateQueries({ queryKey: ["form-metas"] });
        qc.invalidateQueries({ queryKey: ["doctype"] });
      }
      toast.success(action === "Submit" ? "Submitted" : action === "Update" ? "Updated" : "Saved");
      if (wasNew) router.replace(`/desk/doctype/${enc(doctype)}/${enc(saved.name)}`);
      else {
        setLoaded((l) => (l ? { ...l, doc: saved } : l));
        await c.runLoadEvents(false);
      }
    },
    [doctype, qc, router],
  );

  const run = useCallback(
    async (kind: "save" | "submit", action: SaveAction) => {
      setBusy(kind);
      try {
        await persist(action);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed", { duration: 10000 });
      } finally {
        setBusy(null);
      }
    },
    [persist],
  );

  useEffect(() => {
    const c = ctlRef.current;
    if (!c) return;
    // scripts' frm.save() / frm.reload_doc() route through the page's pipeline
    c.onSave = (a) => run(a === "Submit" ? "submit" : "save", (a as SaveAction) || "Save");
    c.onReload = load;
  }, [ctl, run, load]);

  const [jumpOpen, setJumpOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ fieldname: string; n: number } | null>(null);
  const docstatusNow = () => Number(ctlRef.current?.getDoc().docstatus ?? 0);
  // Desk form shortcuts (frappe/public/js/frappe/form/toolbar.js, form.js)
  useShortcuts(
    [
      { keys: "mod+s", description: "Save", group: "Form", allowInInput: true, action: () => docstatusNow() === 0 && void run("save", "Save") },
      { keys: "mod+j", description: "Jump to field", group: "Form", allowInInput: true, action: () => setJumpOpen(true) },
      { keys: "mod+b", description: `New ${doctype}`, group: "Form", allowInInput: true, action: () => router.push(`/desk/doctype/${enc(doctype)}/new`) },
      { keys: "shift+mod+d", description: "Delete", group: "Form", action: () => ctlRef.current && !isNewDoc(ctlRef.current.getDoc()) && docstatusNow() !== 1 && setConfirm("delete") },
      { keys: "shift+r", description: "Reload", group: "Form", action: () => void load() },
      {
        keys: "mod+p",
        description: "Print",
        group: "Form",
        action: () => {
          const c = ctlRef.current;
          if (!c || isNewDoc(c.getDoc())) return;
          const base = process.env.NEXT_PUBLIC_FRAPPE_BASE_URL ?? "";
          window.open(`${base}/printview?doctype=${enc(doctype)}&name=${enc(c.docname)}&trigger_print=1`, "_blank", "noopener,noreferrer");
        },
      },
    ],
    [run, load, doctype, router],
  );

  const onCancelConfirmed = async () => {
    const c = ctlRef.current;
    setConfirm(null);
    if (!c) return;
    setBusy("cancel");
    try {
      if (!(await c.trigger("before_cancel"))) return;
      await cancelDoc(doctype, c.docname);
      toast.success("Cancelled");
      await load();
      await c.trigger("after_cancel");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed", { duration: 10000 });
    } finally {
      setBusy(null);
    }
  };

  const onDeleteConfirmed = async () => {
    const c = ctlRef.current;
    setConfirm(null);
    if (!c) return;
    setBusy("delete");
    try {
      await deleteDoc(doctype, c.docname);
      toast.success(`${doctype} ${c.docname} deleted`);
      qc.invalidateQueries({ queryKey: ["list", doctype] });
      router.push(`/desk/doctype/${enc(doctype)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed", { duration: 10000 });
      setBusy(null);
    }
  };

  const openCopy = (amend: boolean) => {
    const c = ctlRef.current;
    if (!c || !metas) return;
    const copy = copyForNew(metas.meta, c.getDoc());
    if (amend) copy.amended_from = c.docname;
    sessionStorage.setItem(PREFILL_KEY(doctype), JSON.stringify(copy));
    router.push(`/desk/doctype/${enc(doctype)}/new`);
  };

  const addComment = async () => {
    if (!snap || !comment.trim()) return;
    try {
      await deskCall("frappe.desk.form.utils.add_comment", {
        reference_doctype: doctype,
        reference_name: snap.doc.name,
        content: comment.trim(),
        comment_email: ctx?.user,
        comment_by: ctx?.full_name,
      });
      setComment("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add comment");
    }
  };

  // ── render ──────────────────────────────────────────────────────────────
  if (metaError) return <div className="p-6 text-sm text-red-600" role="alert">{(metaError as Error).message}</div>;
  if (loadError) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <p className="text-sm text-red-600" role="alert">{loadError}</p>
        <Link href={`/desk/doctype/${enc(doctype)}`} className="mt-4 inline-block text-sm text-zinc-600 underline">Back to {doctype} list</Link>
      </div>
    );
  }
  if (!metas || !ctl || !snap) return <FormSkeleton />;

  const { meta } = metas;
  const doc = snap.doc;
  const docstatus = Number(doc.docstatus ?? 0);
  const perms = loaded?.docinfo.permissions ?? {};
  const can = (p: string) => isNew || perms[p] === undefined || !!perms[p];
  const submittable = !!meta.is_submittable;
  const wfReadOnly = !!workflow && isWorkflowReadOnly(workflow, doc, ctx?.roles ?? []);
  const readOnly = docstatus !== 0 || !can("write") || !!snap.overrides.__form?.read_only || wfReadOnly;
  const wfState = workflow ? (doc[workflow.workflow_state_field] as string | undefined) : undefined;
  const indicator: [string, string] | null =
    workflow && wfState && !isNewDoc(doc) && !snap.dirty ? [wfState, stateColour(workflow, wfState, stateStyles)] : getIndicator(meta, doc, snap.dirty);
  const titleField = typeof meta.title_field === "string" ? meta.title_field : "";
  const titleValue = titleField ? doc[titleField] : "";
  const title = isNewDoc(doc) ? `New ${doctype}` : typeof titleValue === "string" && titleValue ? titleValue : doc.name;

  let primary: null | { label: string; kind: "save" | "submit" | "cancel" } = null;
  if (docstatus === 0 && !snap.overrides.__form?.disable_save) {
    if (isNewDoc(doc) || snap.dirty || !submittable) primary = isNew || can("write") ? { label: "Save", kind: "save" } : null;
    else primary = can("submit") ? { label: "Submit", kind: "submit" } : null;
  } else if (docstatus === 1 && can("cancel")) primary = { label: "Cancel", kind: "cancel" };
  // Desk workflow setup_btn: transitions replace the primary/secondary buttons
  const showActions = transitions.length > 0 && !snap.dirty && !isNewDoc(doc);
  if (showActions) primary = null;

  // custom buttons: ungrouped as buttons, grouped as dropdowns (Desk "Create ▾")
  const groups = new Map<string, typeof snap.buttons>();
  for (const b of snap.buttons) {
    const g = b.group ?? "";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(b);
  }

  const docinfo = loaded?.docinfo ?? {};
  const timeline = [
    ...(docinfo.comments ?? []).map((c) => ({ kind: "comment" as const, at: String(c.creation ?? ""), by: String(c.owner ?? ""), text: String(c.content ?? "") })),
    ...(docinfo.versions ?? []).map((v) => ({ kind: "version" as const, at: String(v.creation ?? ""), by: String(v.owner ?? ""), text: "changed values" })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const connectionsTab = (meta.fields ?? []).find((f) => f.fieldtype === "Tab Break" && /connection/i.test(f.fieldname))?.fieldname;
  // DocType / Customize Form: the tab holding the `form_builder` HTML field hosts the visual builder
  let builderTab: string | undefined;
  {
    let tab: string | undefined;
    for (const f of meta.fields ?? []) {
      if (f.fieldtype === "Tab Break") tab = f.fieldname;
      if (f.fieldname === "form_builder" && f.fieldtype === "HTML") builderTab = tab ?? "__details";
    }
  }
  const tabExtras: Record<string, React.ReactNode> = {};
  if (connectionsTab) tabExtras[connectionsTab] = <Connections meta={meta} doc={doc} />;
  if (builderTab && ctl.field("fields")) {
    tabExtras[builderTab] = (
      <FormBuilder ctl={ctl} childMeta={metas.children.find((m) => m.name === ctl.field("fields")?.options)} readOnly={readOnly} />
    );
  }
  const btnCls = "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

  return (
    <div className="space-y-4 pb-16">
      {/* Header (sticks under the navbar so actions stay reachable on long forms) */}
      <div className="sticky top-12 z-20 -mx-4 flex flex-wrap items-center gap-3 bg-[var(--bg-color)]/95 px-4 py-2 backdrop-blur">
        <h1 className="min-w-0 truncate text-xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
        {indicator && <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${INDICATOR_PILL[indicator[1]] ?? INDICATOR_PILL.gray}`}>{indicator[0]}</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {[...groups.entries()].map(([g, btns]) =>
            g ? (
              <DropdownMenu key={g}>
                <DropdownMenuTrigger className={`inline-flex items-center gap-1 ${btnCls}`}>
                  {g} <ChevronDown className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {btns.map((b) => (
                    <DropdownMenuItem key={b.label} onClick={() => void b.action()}>{b.label}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              btns.map((b) => (
                <button key={b.label} type="button" onClick={() => void b.action()} className={btnCls}>
                  {b.label}
                </button>
              ))
            ),
          )}
          {!isNewDoc(doc) && (
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="More actions" className="rounded-lg border border-zinc-200 bg-white p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                <MoreHorizontal className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {can("create") && <DropdownMenuItem onClick={() => router.push(`/desk/doctype/${enc(doctype)}/new`)}><Plus className="h-4 w-4" /> New {doctype}</DropdownMenuItem>}
                {can("create") && meta.allow_copy !== 0 && <DropdownMenuItem onClick={() => openCopy(false)}><CopyPlus className="h-4 w-4" /> Duplicate</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Reload</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { void navigator.clipboard.writeText(doc.name); toast.success("Copied"); }}><Copy className="h-4 w-4" /> Copy name</DropdownMenuItem>
                {can("delete") && docstatus !== 1 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setConfirm("delete")} className="text-red-600"><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {docstatus === 2 && can("amend") && (
            <button type="button" onClick={() => openCopy(true)} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">Amend</button>
          )}
          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger disabled={wfBusy} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
                {wfBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                Actions <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {transitions.map((t) => (
                  <DropdownMenuItem key={`${t.action}|${t.next_state}`} onClick={() => void runTransition(t)}>
                    {t.action}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {primary && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => (primary!.kind === "save" ? void run("save", "Save") : setConfirm(primary!.kind))}
              className={[
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60",
                primary.kind === "cancel"
                  ? "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                  : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
              ].join(" ")}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {primary.label}
            </button>
          )}
        </div>
      </div>

      {snap.intro?.message && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200" dangerouslySetInnerHTML={{ __html: snap.intro.message }} />
      )}
      {docstatus === 2 && <p className="text-xs text-zinc-500">Cancelled. Use Amend to create a corrected copy.</p>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-4">
          <FormBody
            meta={meta}
            values={doc}
            readOnly={readOnly}
            overrides={snap.overrides}
            errors={snap.errors}
            onChange={(f, v) => void ctl.set_value(f, v)}
            getQuery={(f) => () => ctl.getQuery(f)?.(ctl.getDoc())}
            renderTable={(df) => (
              <Grid
                ctl={ctl}
                df={df}
                meta={metas.children.find((m) => m.name === df.options) ?? ({ name: String(df.options), fields: [] } as unknown as DocTypeMeta)}
                readOnly={readOnly && !df.allow_on_submit}
                overrides={snap.overrides}
                errors={snap.errors}
              />
            )}
            tabExtras={tabExtras}
            focusRequest={focusRequest}
          />

          {!isNewDoc(doc) && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Comments</h2>
              <div className="flex gap-2">
                <textarea aria-label="Add a comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && void addComment()}
                  rows={2}
                  placeholder="Add a comment (⌘↵ to post)"
                  className="flex-1 resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <button type="button" onClick={() => void addComment()} disabled={!comment.trim()} aria-label="Post comment" className="self-end rounded-lg bg-zinc-900 p-2.5 text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900">
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <h2 className="mb-3 mt-6 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Activity</h2>
              <ol className="relative space-y-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
                {timeline.map((t) => (
                  <li key={`${t.kind}-${t.at}-${t.by}`} className="text-sm">
                    <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-zinc-300 dark:border-zinc-900 dark:bg-zinc-600" />
                    {t.kind === "comment" ? (
                      <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                        <div className="text-xs text-zinc-500">{t.by} · {timeAgo(t.at)}</div>
                        <div className="mt-1 text-zinc-800 dark:text-zinc-200" dangerouslySetInnerHTML={{ __html: t.text }} />
                      </div>
                    ) : (
                      <span className="text-zinc-600 dark:text-zinc-400"><b className="font-medium text-zinc-800 dark:text-zinc-200">{t.by}</b> {t.text} · {timeAgo(t.at)}</span>
                    )}
                  </li>
                ))}
                <li className="text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-zinc-300 dark:border-zinc-900 dark:bg-zinc-600" />
                  <b className="font-medium text-zinc-800 dark:text-zinc-200">{String(doc.owner ?? "")}</b> created this · {timeAgo(doc.creation)}
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Form sidebar (Desk shows assigned / attachments / tags / meta) */}
        {!isNewDoc(doc) && (
          <aside className="space-y-4 text-sm xl:sticky xl:top-28 xl:self-start">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400"><UserPlus className="h-3.5 w-3.5" /> Assigned to</h3>
              {(docinfo.assignments ?? []).length ? (
                <ul className="space-y-1">{(docinfo.assignments ?? []).map((a) => <li key={String(a.name)} className="truncate text-zinc-700 dark:text-zinc-200">{String(a.owner ?? a.allocated_to ?? a.name)}</li>)}</ul>
              ) : (
                <p className="text-zinc-400">Nobody</p>
              )}
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400"><Paperclip className="h-3.5 w-3.5" /> Attachments</h3>
              {(docinfo.attachments ?? []).length ? (
                <ul className="space-y-1">
                  {(docinfo.attachments ?? []).map((a) => (
                    <li key={String(a.name)}><a href={String(a.file_url)} target="_blank" rel="noreferrer" className="block truncate text-zinc-700 hover:underline dark:text-zinc-200">{String(a.file_name ?? a.name)}</a></li>
                  ))}
                </ul>
              ) : (
                <p className="text-zinc-400">None</p>
              )}
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400"><Tag className="h-3.5 w-3.5" /> Tags</h3>
              {docinfo.tags ? (
                <div className="flex flex-wrap gap-1">{String(docinfo.tags).split(",").filter(Boolean).map((t) => <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{t}</span>)}</div>
              ) : (
                <p className="text-zinc-400">No tags</p>
              )}
            </div>
            <div className="space-y-1 px-1 text-xs text-zinc-500">
              <p>Created by <b className="font-medium text-zinc-700 dark:text-zinc-300">{String(doc.owner ?? "")}</b> · {timeAgo(doc.creation)}</p>
              <p>Updated by <b className="font-medium text-zinc-700 dark:text-zinc-300">{String(doc.modified_by ?? "")}</b> · {timeAgo(doc.modified)}</p>
            </div>
          </aside>
        )}
      </div>

      {/* Ctrl+J — Jump to field */}
      {jumpOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && setJumpOpen(false)}>
          <Command loop className="w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900" onKeyDown={(e) => e.key === "Escape" && setJumpOpen(false)}>
            <Command.Input autoFocus placeholder="Jump to field…" className="h-11 w-full border-b border-zinc-200 bg-transparent px-4 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:text-zinc-100" />
            <Command.List className="max-h-80 overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-6 text-center text-sm text-zinc-500">No field found</Command.Empty>
              {(meta.fields ?? [])
                .filter((f) => !["Section Break", "Column Break", "Tab Break", "Fold", "HTML", "Heading"].includes(f.fieldtype) && !f.hidden && f.label)
                .map((f) => (
                  <Command.Item
                    key={f.fieldname}
                    value={`${f.label} ${f.fieldname}`}
                    onSelect={() => {
                      setJumpOpen(false);
                      setFocusRequest((r) => ({ fieldname: f.fieldname, n: (r?.n ?? 0) + 1 }));
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-800 data-[selected=true]:bg-zinc-100 dark:text-zinc-200 dark:data-[selected=true]:bg-zinc-800"
                  >
                    <span className="flex-1 truncate">{f.label}</span>
                    <span className="text-xs text-zinc-400">{f.fieldtype}</span>
                  </Command.Item>
                ))}
            </Command.List>
          </Command>
        </div>
      )}

      {/* Missing mandatory fields (Desk's "Missing Fields" dialog) */}
      <Dialog open={!!missing} onOpenChange={(o) => !o && setMissing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Missing fields</DialogTitle>
            <DialogDescription>Mandatory fields required in {doctype}:</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-200">{(missing ?? []).map((m) => <li key={m}>{m}</li>)}</ul>
          <DialogFooter>
            <button type="button" onClick={() => setMissing(null)} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">OK</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm === "submit" ? `Permanently submit ${doc.name}?` : confirm === "cancel" ? `Permanently cancel ${doc.name}?` : `Delete ${doc.name}?`}</DialogTitle>
            <DialogDescription>{confirm === "delete" ? "This cannot be undone." : confirm === "submit" ? "Submitted documents cannot be edited." : "Cancelled documents cannot be edited; you can amend them."}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" onClick={() => setConfirm(null)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-200">No</button>
            <button
              type="button"
              onClick={() => {
                if (confirm === "submit") {
                  setConfirm(null);
                  void run("submit", "Submit");
                } else if (confirm === "cancel") void onCancelConfirmed();
                else void onDeleteConfirmed();
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${confirm === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"}`}
            >
              Yes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
