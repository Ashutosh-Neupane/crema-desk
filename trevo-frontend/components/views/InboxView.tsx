"use client";

/**
 * Email inbox (Desk: frappe/public/js/frappe/views/inbox/inbox_view.js — Communication "Inbox" view).
 * Folders: the user's email accounts (boot.email_accounts, else the site's accounts), Sent, Spam, Trash;
 * Desk's filters per folder; read/unread via email.inbox.create_email_flag_queue; trash, spam, close;
 * compose through the shared EmailComposer.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Inbox, Mail, MailOpen, Paperclip, PenSquare, Send, ShieldAlert, Trash2 } from "lucide-react";
import { deskCall } from "@/lib/frappe/form";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { fetchRows, type Filter, type Row } from "@/lib/list/api";
import { timeAgo } from "@/lib/list/format";
import EmailComposer from "@/components/form/EmailComposer";

const enc = encodeURIComponent;
const btn = "inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

export default function InboxView() {
  const qc = useQueryClient();
  const { data: ctx } = useDeskContext();
  const bootAccounts = (ctx?.boot?.email_accounts as Array<{ email_account: string; email_id?: string }> | undefined)?.filter((a) => a.email_account && a.email_id !== "All Accounts") ?? [];
  const { data: siteAccounts = [] } = useQuery({
    queryKey: ["email-accounts"],
    enabled: !!ctx && !bootAccounts.length,
    queryFn: async () => ((await deskCall("frappe.client.get_list", { doctype: "Email Account", fields: ["name", "email_id"], limit_page_length: 50 })).env.message as Array<{ name: string; email_id?: string }>) ?? [],
  });
  const accounts = bootAccounts.length ? bootAccounts.map((a) => ({ name: a.email_account, email_id: a.email_id })) : siteAccounts;
  const [folder, setFolder] = useState<string | null>(null);
  const current = folder ?? (accounts.length > 1 ? "All Accounts" : accounts[0]?.name ?? "All Accounts");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState(false);
  const [limit, setLimit] = useState(30);

  // Desk get_inbox_filters
  const filters = useMemo<Filter[]>(() => {
    const base: Filter[] = [
      ["Communication", "communication_type", "=", "Communication"],
      ["Communication", "communication_medium", "=", "Email"],
    ];
    const names = accounts.map((a) => a.name);
    if (current === "Sent") return [...base, ["Communication", "sent_or_received", "=", "Sent"], ["Communication", "email_status", "not in", ["Spam", "Trash"]]];
    if (current === "Spam" || current === "Trash") return [...base, ["Communication", "email_status", "=", current], ["Communication", "email_account", "in", names]];
    return [
      ...base,
      ["Communication", "sent_or_received", "=", "Received"],
      ["Communication", "status", "=", "Open"],
      current === "All Accounts" ? ["Communication", "email_account", "in", names.length ? names : [""]] : ["Communication", "email_account", "=", current],
      ["Communication", "email_status", "not in", ["Spam", "Trash"]],
    ];
  }, [current, accounts]);

  const listQ = useQuery<Row[]>({
    queryKey: ["inbox", filters, limit],
    enabled: !!ctx,
    placeholderData: keepPreviousData,
    queryFn: () => fetchRows({ doctype: "Communication", fields: ["name", "subject", "sender", "sender_full_name", "recipients", "communication_date", "seen", "_seen", "has_attachment", "reference_doctype", "reference_name"], filters, orderBy: "`tabCommunication`.`communication_date` desc", start: 0, pageLength: limit }),
  });
  const rows = listQ.data ?? [];
  const isSeen = (r: Row) => !!Number(r.seen) || (() => {
    try {
      return (JSON.parse(String(r._seen || "[]")) as string[]).includes(ctx?.user ?? "");
    } catch {
      return false;
    }
  })();

  const act = async (label: string, fn: (name: string) => Promise<unknown>, names = [...selected]) => {
    try {
      for (const n of names) {
        // one call per message, like Desk
        // react-doctor-disable-next-line async-await-in-loop
        await fn(n);
      }
      toast.success(label);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed", { duration: 8000 });
    }
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["inbox"] });
  };
  const flag = (action: "Read" | "Unread", names = [...selected]) =>
    act(`Marked as ${action.toLowerCase()}`, async () => deskCall("frappe.email.inbox.create_email_flag_queue", { names: JSON.stringify(names), action }), names.slice(0, 1));

  const nav = [
    ...(accounts.length > 1 ? [{ id: "All Accounts", label: "All Accounts", icon: Inbox }] : []),
    ...accounts.map((a) => ({ id: a.name, label: a.name, icon: Inbox })),
    { id: "Sent", label: "Sent", icon: Send },
    { id: "Spam", label: "Spam", icon: ShieldAlert },
    { id: "Trash", label: "Trash", icon: Trash2 },
  ];

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-4 p-4">
      <aside className="w-52 shrink-0 space-y-1" aria-label="Mail folders">
        <button type="button" onClick={() => setComposing(true)} className="mb-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          <PenSquare className="h-4 w-4" aria-hidden /> Compose
        </button>
        {nav.map((n) => (
          <button
            key={n.id}
            type="button"
            aria-current={current === n.id ? "page" : undefined}
            onClick={() => {
              setFolder(n.id);
              setSelected(new Set());
            }}
            className={`flex w-full items-center gap-2 truncate rounded-md px-2.5 py-1.5 text-left text-sm ${current === n.id ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"}`}
          >
            <n.icon className="h-4 w-4 shrink-0" aria-hidden /> <span className="truncate">{n.label}</span>
          </button>
        ))}
        {!accounts.length && <p className="px-2.5 pt-2 text-xs text-zinc-500">No email account is set up. Add one in Email Account to receive mail here.</p>}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-2" aria-label={current}>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-lg font-semibold text-zinc-900 dark:text-zinc-100">{current}</h1>
          {selected.size > 0 && (
            <>
              <button type="button" className={btn} onClick={() => void flag("Read")}>
                <MailOpen className="h-4 w-4" aria-hidden /> Mark read
              </button>
              <button type="button" className={btn} onClick={() => void flag("Unread")}>
                <Mail className="h-4 w-4" aria-hidden /> Mark unread
              </button>
              <button type="button" className={btn} onClick={() => void act("Moved to trash", (n) => deskCall("frappe.email.inbox.mark_as_trash", { communication: n }))}>
                <Trash2 className="h-4 w-4" aria-hidden /> Trash
              </button>
              <button type="button" className={btn} onClick={() => void act("Closed", (n) => deskCall("frappe.email.inbox.mark_as_closed_open", { communication: n, status: "Closed" }))}>
                Close
              </button>
            </>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <ul aria-label="Messages">
            {rows.map((r) => {
              const seen = isSeen(r);
              return (
                <li key={r.name} className={`flex items-center gap-3 border-b border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800 ${seen ? "" : "bg-blue-50/40 dark:bg-blue-950/20"}`}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${String(r.subject || r.name)}`}
                    checked={selected.has(r.name)}
                    onChange={() =>
                      setSelected((s) => {
                        const x = new Set(s);
                        if (x.has(r.name)) x.delete(r.name);
                        else x.add(r.name);
                        return x;
                      })
                    }
                  />
                  <Link href={`/desk/doctype/Communication/${enc(r.name)}`} onClick={() => !seen && void flag("Read", [r.name])} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className={`w-48 shrink-0 truncate ${seen ? "text-zinc-600 dark:text-zinc-400" : "font-semibold text-zinc-900 dark:text-zinc-100"}`}>{String(current === "Sent" ? r.recipients : r.sender_full_name || r.sender || "")}</span>
                    <span className={`min-w-0 flex-1 truncate ${seen ? "text-zinc-700 dark:text-zinc-300" : "font-semibold text-zinc-900 dark:text-zinc-100"}`}>{String(r.subject || "(no subject)")}</span>
                    {!!Number(r.has_attachment) && <Paperclip className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-label="Has attachment" />}
                    {r.reference_doctype ? <span className="hidden shrink-0 rounded bg-zinc-100 px-1.5 text-xs text-zinc-600 md:inline dark:bg-zinc-800 dark:text-zinc-300">{String(r.reference_doctype)}</span> : null}
                    <span className="w-12 shrink-0 text-right text-xs text-zinc-500">{timeAgo(r.communication_date)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {!listQ.isLoading && !rows.length && <p className="p-10 text-center text-sm text-zinc-500">No mail in {current}</p>}
          {rows.length >= limit && (
            <div className="p-3 text-center">
              <button type="button" className={btn} onClick={() => setLimit((l) => l + 30)}>
                Load more
              </button>
            </div>
          )}
        </div>
      </section>

      {composing && <EmailComposer onClose={() => setComposing(false)} onSent={() => qc.invalidateQueries({ queryKey: ["inbox"] })} />}
    </div>
  );
}
