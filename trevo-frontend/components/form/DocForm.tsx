"use client";

/**
 * Desk-style document form — one page for viewing *and* editing, like
 * /app/<doctype>/<name> in Frappe:
 *  - header: title, status indicator (Not Saved / Draft / Submitted / Cancelled /
 *    status field), primary action following Desk's rules
 *    (Save → Submit → Cancel → Amend), "…" menu (New, Duplicate, Reload, Copy, Delete)
 *  - body: the metadata-driven form (tabs, sections, columns, client scripts)
 *  - footer: comments + activity from docinfo
 * New documents live at /new with a local doc ("new-<doctype>-1"); after the
 * first save the URL is replaced with the real name.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, CopyPlus, Loader2, MoreHorizontal, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import FormRenderer, { type FormHandle } from "@/lib/trevo-form/renderers/FormRenderer";
import { useDoctype } from "@/lib/hooks/useDoctype";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { getNewDoc } from "@/lib/trevo-form/newDoc";
import { cancelDoc, deleteDoc, deskCall, getDoc, isNewDoc, saveDoc, type Doc, type DocInfo, type SaveAction } from "@/lib/frappe/form";
import { PREFILL_KEY } from "@/components/DocumentActions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { FormSkeleton } from "@/components/Skeleton";
import type { DocTypeMeta, FrappeDocument } from "@/lib/frappe/types";

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
    // child rows lose their identity too
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

type Indicator = { label: string; color: "orange" | "red" | "blue" | "green" | "gray" };

const INDICATOR_CLASSES: Record<Indicator["color"], string> = {
  orange: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900",
  red: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900",
  blue: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900",
  green: "bg-green-50 text-green-700 ring-green-200 dark:bg-green-950/40 dark:text-green-300 dark:ring-green-900",
  gray: "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
};

/** Desk's form indicator (frappe.get_indicator): unsaved → docstatus → status field */
function getIndicator(meta: DocTypeMeta, doc: Doc, dirty: boolean): Indicator | null {
  if (isNewDoc(doc) || dirty) return { label: "Not Saved", color: "orange" };
  if (doc.docstatus === 2) return { label: "Cancelled", color: "red" };
  if (typeof doc.workflow_state === "string" && doc.workflow_state) return { label: doc.workflow_state, color: "blue" };
  if (meta.is_submittable) {
    if (doc.docstatus === 1) return { label: typeof doc.status === "string" && doc.status ? doc.status : "Submitted", color: "blue" };
    return { label: "Draft", color: "red" };
  }
  if (typeof doc.status === "string" && doc.status) {
    const s = doc.status.toLowerCase();
    const color: Indicator["color"] = ["open", "pending", "draft"].includes(s) ? "orange" : ["closed", "completed", "active", "enabled"].includes(s) ? "green" : ["cancelled", "disabled", "expired"].includes(s) ? "red" : "gray";
    return { label: doc.status, color };
  }
  return null;
}

function timeAgo(iso?: unknown): string {
  if (typeof iso !== "string") return "";
  const then = new Date(iso.replace(" ", "T")).getTime();
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

interface Props {
  doctype: string;
  /** Omit for a new document */
  name?: string;
}

export default function DocForm({ doctype, name }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: meta, isLoading: metaLoading, error: metaError } = useDoctype(doctype);
  const { data: ctx } = useDeskContext();
  const formRef = useRef<FormHandle>(null);

  const [doc, setDoc] = useState<Doc | null>(null);
  const [docinfo, setDocinfo] = useState<DocInfo>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "submit" | "cancel" | "delete">(null);
  const [confirm, setConfirm] = useState<null | "submit" | "cancel" | "delete">(null);
  const [comment, setComment] = useState("");

  const isNew = !name;
  // Duplicate/Amend hand over a copy via sessionStorage — read once on mount
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

  // ── Load ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!name) return;
    try {
      const { doc: d, docinfo: info } = await getDoc(doctype, name);
      setDoc(d);
      setDocinfo(info);
      setDirty(false);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load document");
    }
  }, [doctype, name]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state is set after the await
    void load();
  }, [load]);

  // New doc: Desk defaults (+ Duplicate/Amend copy); replaced by the saved doc after the first save
  const newDoc = useMemo(
    () => (isNew && meta && ctx ? ({ ...getNewDoc(meta, ctx), ...prefill } as Doc) : null),
    [isNew, meta, ctx, prefill],
  );
  const current = doc ?? newDoc;

  // Warn before leaving with unsaved changes (Desk does the same)
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const persist = useCallback(
    async (values: Record<string, unknown>, action: SaveAction) => {
      if (!current) return;
      try {
        const { doc: saved, messages } = await saveDoc({ ...current, ...values } as Doc, action);
        messages.forEach((m) => toast.info(m));
        setDoc(saved);
        setDirty(false);
        queryClient.invalidateQueries({ queryKey: ["list", doctype] });
        queryClient.invalidateQueries({ queryKey: ["doctype-list", doctype] });
        toast.success(action === "Submit" ? "Submitted" : action === "Update" ? "Updated" : "Saved");
        if (isNew || saved.name !== current.name) {
          router.replace(`/desk/doctype/${enc(doctype)}/${enc(saved.name)}`);
        } else {
          void load();
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed", { duration: 8000 });
        throw e;
      }
    },
    [current, doctype, isNew, load, queryClient, router],
  );

  const run = async (kind: "save" | "submit", fn: () => Promise<boolean>) => {
    setBusy(kind);
    try {
      const ok = await fn();
      if (!ok) toast.error("Please fill all mandatory fields", { description: "Fields marked * are required." });
    } catch {
      /* already toasted */
    } finally {
      setBusy(null);
    }
  };

  const onSave = () => run("save", () => formRef.current?.save() ?? Promise.resolve(false));
  const onSubmitConfirmed = () => {
    setConfirm(null);
    void run("submit", () => formRef.current?.submit() ?? Promise.resolve(false));
  };

  const onCancelConfirmed = async () => {
    if (!doc) return;
    setConfirm(null);
    setBusy("cancel");
    try {
      await cancelDoc(doctype, doc.name);
      toast.success("Cancelled");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed", { duration: 8000 });
    } finally {
      setBusy(null);
    }
  };

  const onDeleteConfirmed = async () => {
    if (!doc) return;
    setConfirm(null);
    setBusy("delete");
    try {
      await deleteDoc(doctype, doc.name);
      toast.success(`${doctype} ${doc.name} deleted`);
      queryClient.invalidateQueries({ queryKey: ["list", doctype] });
      router.push(`/desk/doctype/${enc(doctype)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed", { duration: 8000 });
      setBusy(null);
    }
  };

  const openCopy = (amend: boolean) => {
    if (!meta || !doc) return;
    const copy = copyForNew(meta, doc);
    if (amend) copy.amended_from = doc.name;
    sessionStorage.setItem(PREFILL_KEY(doctype), JSON.stringify(copy));
    router.push(`/desk/doctype/${enc(doctype)}/new`);
  };

  const addComment = async () => {
    if (!doc || !comment.trim()) return;
    try {
      await deskCall("frappe.desk.form.utils.add_comment", {
        reference_doctype: doctype,
        reference_name: doc.name,
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

  // ── Derived ─────────────────────────────────────────────────────────────
  const perms = docinfo.permissions ?? {};
  const can = (p: string) => isNew || perms[p] === undefined || !!perms[p];
  const submittable = !!meta?.is_submittable;
  const docstatus = Number(current?.docstatus ?? 0);

  // Desk's primary action: Save while new/dirty (or not submittable) → Submit → Cancel
  let primary: null | { label: string; kind: "save" | "submit" | "cancel" } = null;
  if (current && docstatus === 0) {
    if (isNew || dirty || !submittable) primary = isNew || can("write") ? { label: "Save", kind: "save" } : null;
    else primary = can("submit") ? { label: "Submit", kind: "submit" } : null;
  } else if (current && docstatus === 1 && can("cancel")) {
    primary = { label: "Cancel", kind: "cancel" };
  }
  const onPrimary = (kind: "save" | "submit" | "cancel") => {
    if (kind === "save") void onSave();
    else setConfirm(kind);
  };

  const titleField = typeof meta?.title_field === "string" ? meta.title_field : "";
  const titleValue = titleField && current ? current[titleField] : "";
  const title = !current ? "" : isNew ? `New ${doctype}` : typeof titleValue === "string" && titleValue ? titleValue : current.name;

  if (metaError) return <div className="p-6 text-sm text-red-600" role="alert">{(metaError as Error).message}</div>;
  if (loadError) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <p className="text-sm text-red-600" role="alert">{loadError}</p>
        <Link href={`/desk/doctype/${enc(doctype)}`} className="mt-4 inline-block text-sm text-zinc-600 underline">Back to {doctype} list</Link>
      </div>
    );
  }
  if (metaLoading || !meta || !current) return <FormSkeleton />;
  const doc_ = current;

  const indicator = getIndicator(meta, doc_, dirty);
  const timeline = [
    ...(docinfo.comments ?? []).map((c) => ({ kind: "comment" as const, at: String(c.creation ?? ""), by: String(c.owner ?? c.comment_email ?? ""), text: String(c.content ?? "") })),
    ...(docinfo.versions ?? []).map((v) => ({ kind: "version" as const, at: String(v.creation ?? ""), by: String(v.owner ?? ""), text: "changed values" })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 truncate text-xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
        {indicator && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${INDICATOR_CLASSES[indicator.color]}`}>
            {indicator.label}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {!isNew && (
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="More actions" className="rounded-lg border border-zinc-200 p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                <MoreHorizontal className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {can("create") && (
                  <DropdownMenuItem onClick={() => router.push(`/desk/doctype/${enc(doctype)}/new`)}>
                    <Plus className="h-4 w-4" /> New {doctype}
                  </DropdownMenuItem>
                )}
                {can("create") && meta.allow_copy !== 0 && (
                  <DropdownMenuItem onClick={() => openCopy(false)}>
                    <CopyPlus className="h-4 w-4" /> Duplicate
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => void load()}>
                  <RefreshCw className="h-4 w-4" /> Reload
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { void navigator.clipboard.writeText(doc_.name); toast.success("Copied"); }}>
                  <Copy className="h-4 w-4" /> Copy name
                </DropdownMenuItem>
                {can("delete") && docstatus !== 1 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setConfirm("delete")} className="text-red-600">
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {docstatus === 2 && can("amend") && (
            <button type="button" onClick={() => openCopy(true)} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
              Amend
            </button>
          )}
          {submittable && docstatus === 0 && !isNew && dirty && can("write") && (
            <span className="hidden text-xs text-zinc-500 sm:inline">Save to enable Submit</span>
          )}
          {primary && (
            <button
              type="button"
              onClick={() => onPrimary(primary.kind)}
              disabled={!!busy}
              className={[
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60",
                primary.kind === "cancel"
                  ? "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                  : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
              ].join(" ")}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {primary.label}
              {primary.kind === "save" && <kbd className="hidden rounded bg-white/15 px-1 text-[10px] sm:inline">⌘S</kbd>}
            </button>
          )}
        </div>
      </div>

      {docstatus === 1 && <p className="text-xs text-zinc-500">This document is submitted and can no longer be edited. Cancel it to make changes (then Amend).</p>}
      {docstatus === 2 && <p className="text-xs text-zinc-500">This document is cancelled. Use Amend to create a corrected copy.</p>}

      {/* Form */}
      <FormRenderer
        formRef={formRef}
        hideActions
        meta={meta}
        doc={doc_ as unknown as FrappeDocument}
        editable={docstatus === 0 && can("write")}
        readOnly={docstatus !== 0}
        onChange={() => setDirty(true)}
        onSave={(values) => persist(values, "Save")}
        onSubmit={(values) => persist(values, "Submit")}
      />

      {/* Comments + activity */}
      {!isNew && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Comments</h2>
          <div className="flex gap-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void addComment();
              }}
              rows={2}
              placeholder="Add a comment (⌘↵ to post)"
              className="flex-1 resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={() => void addComment()}
              disabled={!comment.trim()}
              aria-label="Post comment"
              className="self-end rounded-lg bg-zinc-900 p-2.5 text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          <h2 className="mb-3 mt-6 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Activity</h2>
          <ol className="relative space-y-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
            {timeline.map((t, i) => (
              <li key={i} className="text-sm">
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
              <b className="font-medium text-zinc-800 dark:text-zinc-200">{String(doc_.owner ?? "")}</b> created this · {timeAgo(doc_.creation)}
            </li>
          </ol>
        </div>
      )}

      {/* Confirmations */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirm === "submit" ? `Permanently submit ${doc_.name}?` : confirm === "cancel" ? `Permanently cancel ${doc_.name}?` : `Delete ${doc_.name}?`}
            </DialogTitle>
            <DialogDescription>
              {confirm === "delete" ? "This cannot be undone." : confirm === "submit" ? "Submitted documents cannot be edited." : "Cancelled documents cannot be edited; you can amend them."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" onClick={() => setConfirm(null)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600">
              No
            </button>
            <button
              type="button"
              onClick={() => (confirm === "submit" ? onSubmitConfirmed() : confirm === "cancel" ? void onCancelConfirmed() : void onDeleteConfirmed())}
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
