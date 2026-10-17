"use client";

/**
 * New Email from a document (Desk: frappe/public/js/frappe/views/communication.js).
 * Sends through frappe.core.doctype.communication.email.make, which records a Communication
 * on the document's timeline and queues the email on the outgoing account.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { deskCall, type Doc } from "@/lib/frappe/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import type { DocTypeMeta } from "@/lib/frappe/types";

const input = "h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

/** Comma list input with contact suggestions (frappe.email.get_contact_list) for the last entry */
function Recipients({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const [items, setItems] = useState<Array<{ value: string; description?: string }>>([]);
  const last = value.split(",").pop()?.trim() ?? "";
  const lookup = async (v: string) => {
    onChange(v);
    const q = v.split(",").pop()?.trim() ?? "";
    if (q.length < 2) return setItems([]);
    try {
      const { env } = await deskCall("frappe.email.get_contact_list", { txt: q, page_length: 6 });
      setItems(((env.message as Array<{ value: string; description?: string }>) ?? []).filter((x) => x.value));
    } catch {
      setItems([]);
    }
  };
  const pick = (email: string) => {
    const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
    parts[parts.length ? parts.length - 1 : 0] = email;
    onChange(`${parts.join(", ")}, `);
    setItems([]);
  };
  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <input id={id} value={value} onChange={(e) => void lookup(e.target.value)} onBlur={() => setTimeout(() => setItems([]), 150)} className={input} autoComplete="off" />
      {items.length > 0 && last && (
        <ul role="listbox" className="absolute z-30 mt-1 w-full rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {items.map((c) => (
            <li
              key={c.value}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c.value);
              }}
              className="cursor-pointer px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              {c.value}
              {c.description && <span className="ml-2 text-xs text-zinc-500">{c.description}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function EmailComposer({ doc, meta, onClose, onSent }: { doc: Doc; meta: DocTypeMeta; onClose: () => void; onSent: () => Promise<unknown> | void }) {
  const titleField = typeof meta.title_field === "string" ? meta.title_field : "";
  const defaultTo = String(doc.contact_email ?? doc.email_id ?? doc.email ?? "");
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState(`${doc.doctype}: ${String((titleField && doc[titleField]) || doc.name)}`);
  const [body, setBody] = useState("");
  const [attachPrint, setAttachPrint] = useState(false);
  const [printFormat, setPrintFormat] = useState("Standard");
  const [copy, setCopy] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: formats = [] } = useQuery({
    queryKey: ["print-formats", doc.doctype],
    queryFn: async () => ((await deskCall("frappe.client.get_list", { doctype: "Print Format", filters: { doc_type: doc.doctype, disabled: 0 }, fields: ["name"], limit_page_length: 50 })).env.message as Array<{ name: string }>) ?? [],
  });

  const send = async () => {
    const recipients = to.split(",").map((s) => s.trim()).filter(Boolean);
    if (!recipients.length) return toast.error("Add at least one recipient");
    setSending(true);
    try {
      const html = `<div>${body.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!).replace(/\n/g, "<br>")}</div>`;
      const { env } = await deskCall("frappe.core.doctype.communication.email.make", {
        doctype: doc.doctype,
        name: doc.name,
        recipients: recipients.join(", "),
        cc: cc.split(",").map((s) => s.trim()).filter(Boolean).join(", "),
        bcc: bcc.split(",").map((s) => s.trim()).filter(Boolean).join(", "),
        subject,
        content: html,
        send_email: 1,
        print_format: attachPrint ? printFormat : undefined,
        send_me_a_copy: copy ? 1 : 0,
      });
      const r = env.message as { name?: string; emails_not_sent_to?: string } | undefined;
      toast.success(r?.emails_not_sent_to ? `Saved — not sent to ${r.emails_not_sent_to}` : "Email queued");
      onClose();
      await onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send email", { duration: 10000 });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Email</DialogTitle>
          <DialogDescription>
            Linked to {doc.doctype} {doc.name}; it appears on this document&apos;s timeline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Recipients id="email-to" label="To" value={to} onChange={setTo} />
          {showCc ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Recipients id="email-cc" label="CC" value={cc} onChange={setCc} />
              <Recipients id="email-bcc" label="BCC" value={bcc} onChange={setBcc} />
            </div>
          ) : (
            <button type="button" onClick={() => setShowCc(true)} className="text-xs text-zinc-500 hover:underline">
              Add CC / BCC
            </button>
          )}
          <div>
            <label htmlFor="email-subject" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Subject
            </label>
            <input id="email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="email-body" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Message
            </label>
            <textarea id="email-body" value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-700 dark:text-zinc-300">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={attachPrint} onChange={(e) => setAttachPrint(e.target.checked)} /> Attach document print
            </label>
            {attachPrint && (
              <select aria-label="Print format" value={printFormat} onChange={(e) => setPrintFormat(e.target.value)} className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <option>Standard</option>
                {formats.map((f) => (
                  <option key={f.name}>{f.name}</option>
                ))}
              </select>
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} /> Send me a copy
            </label>
          </div>
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-200">
            Discard
          </button>
          <button type="button" onClick={() => void send()} disabled={sending || !to.trim()} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
            {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Send
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
