"use client";

/**
 * DocForm's actions: the save pipeline (Desk frappe.ui.form.save: validate → before_save → mandatory check → savedocs →
 * reload → after_save → refresh; Submit adds before_submit / on_submit), Cancel, Delete, Duplicate / Amend, next /
 * previous record, and the form shortcuts (frappe/public/js/frappe/form/toolbar.js, form.js).
 */
import { useCallback, useEffect, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastError } from "@/lib/frappe/errors";
import { cancelDoc, deleteDoc, deskCall, isNewDoc, saveDoc, type SaveAction } from "@/lib/frappe/form";
import { PREFILL_KEY } from "@/lib/form/prefill";
import { loadUserSettings, userSettingsKey } from "@/lib/list/useUserListState";
import { clearDoctypeMetaCache } from "@/lib/frappe/doctype";
import { useShortcuts } from "@/lib/shortcuts";
import type { FormController } from "@/lib/form/FormController";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { META_EDITORS, copyForNew } from "@/components/form/docFormRules";
import type { ConfirmKind } from "@/components/form/DocFormDialogs";
import type { Loaded } from "@/components/form/useDocForm";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

const enc = encodeURIComponent;
type Busy = null | "save" | "submit" | "cancel" | "delete";

/** ⌘S / Save while a field still has focus: cells and inputs commit on blur (Link fields 150 ms later, so a click on a
 * suggestion still counts), so blur it and let that land first, or the last edit is lost */
async function commitFocusedField() {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.matches("input,textarea,select,[contenteditable=true]")) {
    active.blur();
    await new Promise((r) => setTimeout(r, 200));
  }
}

export function useDocActions({
  doctype,
  meta,
  ctlRef,
  ctl,
  load,
  setLoaded,
}: {
  doctype: string;
  meta: DocTypeMeta | undefined;
  ctlRef: RefObject<FormController | null>;
  ctl: FormController | null;
  load: () => Promise<void>;
  setLoaded: (l: Loaded) => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<Busy>(null);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [missing, setMissing] = useState<string[] | null>(null);

  const afterSave = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["list", doctype] });
    if (META_EDITORS.has(doctype)) {
      clearDoctypeMetaCache();
      qc.invalidateQueries({ queryKey: ["form-metas"] });
      qc.invalidateQueries({ queryKey: ["doctype"] });
    }
  }, [qc, doctype]);

  // Desk form/save.js + form.js validate_and_save: a plain Save of an unchanged doc sends nothing and says
  // "No changes in document"; after a real save the form refreshes in place from the savedocs response
  const persist = useCallback(
    async (action: SaveAction) => {
      const c = ctlRef.current;
      if (!c) return;
      const wasNew = isNewDoc(c.getDoc());
      if (action === "Save" && !wasNew && !c.isDirty()) {
        toast.warning("No changes in document");
        return;
      }
      if (!(await c.trigger("validate"))) return;
      if (!(await c.trigger(action === "Submit" ? "before_submit" : "before_save"))) return;
      const miss = c.validateMandatory();
      if (miss.length) {
        setMissing(miss);
        return;
      }
      const { doc: saved, docinfo, messages } = await saveDoc(c.getDoc(), action);
      messages.forEach((m) => toast.info(m));
      c.load(saved);
      await c.trigger(action === "Submit" ? "on_submit" : "after_save");
      afterSave();
      toast.success(action === "Submit" ? "Submitted" : action === "Update" ? "Updated" : "Saved");
      if (wasNew) {
        router.replace(`${doctypeUrl(doctype)}/${enc(saved.name)}`);
        return;
      }
      // docinfo (versions, comments) came back with the save; the controller already holds the saved doc
      if (docinfo) setLoaded({ doc: saved, docinfo });
      else await load();
      await c.runLoadEvents(false);
    },
    [doctype, router, load, ctlRef, setLoaded, afterSave],
  );

  const run = useCallback(
    async (kind: "save" | "submit", action: SaveAction) => {
      setBusy(kind);
      try {
        await commitFocusedField();
        await persist(action);
      } catch (e) {
        toastError(e, "Save failed", { duration: 10000 });
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
  }, [ctl, run, load, ctlRef]);

  // Desk form.js navigate_records: the next / previous record in the list's own filters and sort
  // (frappe.desk.form.utils.get_next; user_settings.List when the list isn't open), keeping the active tab
  const navigate = useCallback(
    async (prev: boolean) => {
      const c = ctlRef.current;
      if (!c || isNewDoc(c.getDoc())) return;
      try {
        const s = await qc.fetchQuery({ queryKey: userSettingsKey(doctype), queryFn: () => loadUserSettings(doctype), staleTime: 30_000 });
        const list = s.List ?? {};
        const { env, messages } = await deskCall("frappe.desk.form.utils.get_next", {
          doctype,
          value: c.docname,
          prev: prev ? 1 : 0,
          filters: JSON.stringify(list.filters ?? []),
          ...(list.sort_by ? { sort_field: list.sort_by } : {}),
          ...(list.sort_order ? { sort_order: list.sort_order } : {}),
        });
        const next = typeof env.message === "string" ? env.message : "";
        if (next) router.push(`${doctypeUrl(doctype)}/${enc(next)}${window.location.hash}`);
        else toast.info(messages[0] ?? "No further records");
      } catch (e) {
        toastError(e, "Could not open the next document");
      }
    },
    [doctype, qc, router, ctlRef],
  );

  const [jumpOpen, setJumpOpen] = useState(false);
  const docstatusNow = () => Number(ctlRef.current?.getDoc().docstatus ?? 0);
  const savedDoc = () => (ctlRef.current && !isNewDoc(ctlRef.current.getDoc()) ? ctlRef.current : null);
  // Desk form shortcuts (frappe/public/js/frappe/form/toolbar.js, form.js)
  useShortcuts(
    [
      { keys: "mod+s", description: "Save", group: "Form", allowInInput: true, action: () => docstatusNow() === 0 && void run("save", "Save") },
      { keys: "mod+j", description: "Jump to field", group: "Form", allowInInput: true, action: () => setJumpOpen(true) },
      { keys: "mod+b", description: `New ${doctype}`, group: "Form", allowInInput: true, action: () => router.push(`${doctypeUrl(doctype)}/new`) },
      { keys: "shift+mod+d", description: "Delete", group: "Form", action: () => savedDoc() && docstatusNow() !== 1 && setConfirm("delete") },
      { keys: "shift+r", description: "Reload", group: "Form", action: () => void load() },
      { keys: "shift+mod+>", description: "Next document", group: "Form", action: () => void navigate(false) },
      { keys: "shift+mod+<", description: "Previous document", group: "Form", action: () => void navigate(true) },
      {
        keys: "mod+p",
        description: "Print",
        group: "Form",
        action: () => {
          const c = savedDoc();
          if (c) router.push(`/desk/print/${enc(doctype)}/${enc(c.docname)}`);
        },
      },
    ],
    [run, load, doctype, router],
  );

  const cancel = async () => {
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
      toastError(e, "Cancel failed", { duration: 10000 });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    const c = ctlRef.current;
    setConfirm(null);
    if (!c) return;
    setBusy("delete");
    try {
      await deleteDoc(doctype, c.docname);
      toast.success(`${doctype} ${c.docname} deleted`);
      qc.invalidateQueries({ queryKey: ["list", doctype] });
      router.push(`${doctypeUrl(doctype)}`);
    } catch (e) {
      toastError(e, "Delete failed", { duration: 10000 });
      setBusy(null);
    }
  };

  /** the confirmation dialog's Yes */
  const confirmed = (kind: ConfirmKind) => {
    if (kind === "submit") {
      setConfirm(null);
      void run("submit", "Submit");
    } else if (kind === "cancel") void cancel();
    else void remove();
  };

  /** Duplicate / Amend: a new form prefilled with the copy (Desk frappe.model.copy_doc) */
  const openCopy = (amend: boolean) => {
    const c = ctlRef.current;
    if (!c || !meta) return;
    const copy = copyForNew(meta, c.getDoc());
    if (amend) copy.amended_from = c.docname;
    sessionStorage.setItem(PREFILL_KEY(doctype), JSON.stringify(copy));
    router.push(`${doctypeUrl(doctype)}/new`);
  };

  return { busy, confirm, setConfirm, confirmed, missing, setMissing, run, navigate, openCopy, jumpOpen, setJumpOpen };
}
