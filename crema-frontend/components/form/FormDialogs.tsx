"use client";

/**
 * Form menu dialogs (Desk: form/toolbar.js, linked_with.js, reminders.js):
 *   Rename — model.rename_doc.update_document_title (title and/or name, merge)
 *   Links  — form.linked_with.get, grouped by DocType
 *   Remind Me — automation reminder.create_new_reminder
 */
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { deskCall } from "@/lib/frappe/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import TimePicker from "@/components/form/TimePicker";
import DatePicker from "@/components/form/DatePicker";

const enc = encodeURIComponent;
const input = "h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const ghost = "rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-200";
const primary = "inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";

export function RenameDialog({
  doctype,
  name,
  titleField,
  title,
  allowRename,
  onClose,
  onDone,
}: {
  doctype: string;
  name: string;
  titleField?: string;
  title?: string;
  allowRename: boolean;
  onClose: () => void;
  /** new name (may equal the old one when only the title changed) */
  onDone: (newName: string) => void;
}) {
  const [newTitle, setNewTitle] = useState(title ?? "");
  const [newName, setNewName] = useState(name);
  const [merge, setMerge] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const { env } = await deskCall("frappe.model.rename_doc.update_document_title", {
        doctype,
        docname: name,
        title: titleField ? newTitle : undefined,
        name: allowRename && newName !== name ? newName : undefined,
        merge: merge ? 1 : 0,
      });
      toast.success("Renamed");
      onDone(String(env.message ?? newName));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rename failed", { duration: 10000 });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
          <DialogDescription>{allowRename ? "Change the title or the document name (ID). Links to this document are updated." : "Change the title."}</DialogDescription>
        </DialogHeader>
        {titleField && (
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Title
            <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className={`${input} mt-1 font-normal`} />
          </label>
        )}
        {allowRename && (
          <>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              New name
              <input autoFocus={!titleField} value={newName} onChange={(e) => setNewName(e.target.value)} className={`${input} mt-1 font-normal`} />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} /> Merge with existing
            </label>
          </>
        )}
        <DialogFooter>
          <button type="button" onClick={onClose} className={ghost}>
            Cancel
          </button>
          <button type="button" disabled={busy || (!newName.trim() && allowRename)} onClick={() => void run()} className={primary}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Rename
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LinksDialog({ doctype, name, onClose }: { doctype: string; name: string; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["linked-with", doctype, name],
    queryFn: async () => ((await deskCall("frappe.desk.form.linked_with.get", { doctype, docname: name })).env.message as Record<string, { docs?: Array<Record<string, unknown>> }>) ?? {},
  });
  const groups = Object.entries(data ?? {}).filter(([, g]) => g.docs?.length);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Linked with {name}</DialogTitle>
          <DialogDescription>Documents that reference this {doctype}.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-auto">
          {isLoading && <div className="h-20 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />}
          {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}
          {!isLoading && !groups.length && <p className="text-sm text-zinc-500">Not linked to any document</p>}
          {groups.map(([dt, g]) => (
            <section key={dt}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {dt} <span className="font-normal">({g.docs!.length})</span>
              </h3>
              <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {g.docs!.slice(0, 50).map((d) => (
                  <li key={String(d.name)}>
                    <Link href={`/desk/doctype/${enc(dt)}/${enc(String(d.name))}`} onClick={onClose} className="flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{String(d.name)}</span>
                      {d.status ? <span className="text-xs text-zinc-500">{String(d.status)}</span> : null}
                      {Number(d.docstatus) === 2 && <span className="text-xs text-red-500">Cancelled</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReminderDialog({ doctype, name, onClose }: { doctype: string; name: string; onClose: () => void }) {
  // default: an hour from now (computed once, not on every render)
  const [initial] = useState(() => {
    const d = new Date(Date.now() + 3600_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  });
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await deskCall("frappe.automation.doctype.reminder.reminder.create_new_reminder", {
        remind_at: `${date} ${time}:00`,
        description: note || `${doctype} ${name}`,
        reminder_doctype: doctype,
        reminder_docname: name,
      });
      toast.success(`Reminder set for ${date} ${time}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not set reminder", { duration: 8000 });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Remind Me</DialogTitle>
          <DialogDescription>You&apos;ll get a notification at this time.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <DatePicker value={date} onChange={(v) => setDate(v ?? date)} ariaLabel="Reminder date" />
          <TimePicker ariaLabel="Reminder time" value={time ? `${time}:00` : null} onChange={(t) => setTime(t ? t.slice(0, 5) : "")} />
        </div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Note
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900" />
        </label>
        <DialogFooter>
          <button type="button" onClick={onClose} className={ghost}>
            Cancel
          </button>
          <button type="button" disabled={busy || !date || !time} onClick={() => void run()} className={primary}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Set reminder
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
