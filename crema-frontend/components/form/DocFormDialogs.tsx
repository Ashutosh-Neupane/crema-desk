"use client";

/** DocForm's own dialogs: workflow help, Jump to field, missing mandatory fields, submit / cancel / delete confirmation */
import { useRef } from "react";
import Link from "next/link";
import { Command } from "cmdk";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { editableBy, type WorkflowDoc, type WorkflowStatus } from "@/lib/form/workflow";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { jumpableFields, pageErrorText } from "@/components/form/docFormRules";
import { useBackdropClose } from "@/components/form/useBackdropClose";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

/** Desk pageview.js show_not_permitted / show_not_found */
export function PageError({ error, doctype, name }: { error: { message: string; status?: number }; doctype: string; name?: string }) {
  const { heading, detail } = pageErrorText(error, doctype, name);
  return (
    <div className="mx-auto max-w-lg p-10 text-center" role="alert">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{heading}</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{detail}</p>
      <Link href={`${doctypeUrl(doctype)}`} className="mt-4 inline-block text-sm text-zinc-600 underline">Back to {doctype} list</Link>
    </div>
  );
}

/** Desk FormStates.setup_help: who can do what in the current state */
export function WorkflowHelpDialog({ open, onOpenChange, workflow, status }: { open: boolean; onOpenChange: (o: boolean) => void; workflow: WorkflowDoc; status: WorkflowStatus }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Workflow: {workflow.name}</DialogTitle>
          <DialogDescription>Who can do what in this document&apos;s current state.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <p>Current status: <strong>{status.state ?? "not set"}</strong></p>
          <p>Document is only editable by users with role: <strong>{status.state ? editableBy(workflow, status.state).join(", ") || "nobody" : "-"}</strong></p>
          <p>
            Next actions:{" "}
            {status.next.length ? status.next.map((t, i) => (
              <span key={`${t.action}|${t.allowed}|${t.next_state}`}>{i > 0 && ", "}<strong>{t.action}</strong> by role {t.allowed}</span>
            )) : <strong>None: End of Workflow</strong>}
          </p>
          <p className="text-zinc-500"><strong>Note:</strong> Other permission rules may also apply.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Ctrl+J — Jump to field */
export function JumpToField({ meta, onClose, onPick }: { meta: DocTypeMeta; onClose: () => void; onPick: (fieldname: string) => void }) {
  const backdrop = useRef<HTMLDivElement>(null);
  useBackdropClose(backdrop, onClose);
  return (
    <div ref={backdrop} className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]">
      <Command loop className="w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900" onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <Command.Input autoFocus placeholder="Jump to field…" className="h-11 w-full border-b border-zinc-200 bg-transparent px-4 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:text-zinc-100" />
        <Command.List className="max-h-80 overflow-y-auto p-1.5">
          <Command.Empty className="px-3 py-6 text-center text-sm text-zinc-500">No field found</Command.Empty>
          {jumpableFields(meta).map((f) => (
            <Command.Item
              key={f.fieldname}
              value={`${f.label} ${f.fieldname}`}
              onSelect={() => onPick(f.fieldname)}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-800 data-[selected=true]:bg-zinc-100 dark:text-zinc-200 dark:data-[selected=true]:bg-zinc-800"
            >
              <span className="flex-1 truncate">{f.label}</span>
              <span className="text-xs text-zinc-400">{f.fieldtype}</span>
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}

/** Desk's "Missing Fields" dialog */
export function MissingFieldsDialog({ doctype, missing, onClose }: { doctype: string; missing: string[] | null; onClose: () => void }) {
  return (
    <Dialog open={!!missing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Missing fields</DialogTitle>
          <DialogDescription>Mandatory fields required in {doctype}:</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-200">{(missing ?? []).map((m) => <li key={m}>{m}</li>)}</ul>
        <DialogFooter>
          <button type="button" onClick={onClose} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">OK</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type ConfirmKind = "submit" | "cancel" | "delete";

const CONFIRM_TEXT: Record<ConfirmKind, { title: (n: string) => string; description: string }> = {
  submit: { title: (n) => `Permanently submit ${n}?`, description: "Submitted documents cannot be edited." },
  cancel: { title: (n) => `Permanently cancel ${n}?`, description: "Cancelled documents cannot be edited; you can amend them." },
  delete: { title: (n) => `Delete ${n}?`, description: "This cannot be undone." },
};

export function ConfirmDialog({ kind, name, onClose, onConfirm }: { kind: ConfirmKind | null; name: string; onClose: () => void; onConfirm: (kind: ConfirmKind) => void }) {
  const text = CONFIRM_TEXT[kind ?? "delete"];
  return (
    <Dialog open={!!kind} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{text.title(name)}</DialogTitle>
          <DialogDescription>{text.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-200">No</button>
          <button
            type="button"
            onClick={() => kind && onConfirm(kind)}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${kind === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"}`}
          >
            Yes
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
