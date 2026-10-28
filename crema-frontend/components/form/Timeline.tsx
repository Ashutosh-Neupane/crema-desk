"use client";

/**
 * Form timeline (Desk: frappe/public/js/frappe/form/footer/form_timeline.js):
 * comment box with @mentions, comments (edit / delete your own), version diffs, emails,
 * assignment / attachment / like / info / workflow logs — newest first, like Desk.
 *   form.utils.add_comment · update_comment · client.delete(Comment)
 */
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Mail, MessageSquare, Pencil, Send, Trash2 } from "lucide-react";
import { deskCall, type Doc, type DocInfo } from "@/lib/frappe/form";
import { searchLink } from "@/lib/frappe/search";
import { sanitizeHtml } from "@/lib/report/columns";
import { timeAgo } from "@/lib/list/format";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import type { FieldStatus } from "@/lib/form/perm";
import EmailComposer from "@/components/form/EmailComposer";

type Entry =
  | { kind: "comment"; at: string; by: string; html: string; name: string; email?: string }
  | { kind: "email"; at: string; by: string; subject: string; html: string; to: string; received: boolean; name: string }
  | { kind: "version"; at: string; by: string; lines: string[]; name: string }
  | { kind: "log"; at: string; by: string; html: string; name: string };

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Desk format_content_for_timeline: HTML → text, cut to 40 characters, empty as "" */
const show = (v: unknown) => {
  if (v === null || v === undefined || v === "") return '""';
  let t = String(v);
  if (/<[a-z/!]/i.test(t)) t = new DOMParser().parseFromString(t, "text/html").body.textContent ?? "";
  t = t.replace(/\s+/g, " ").trim();
  return !t ? '""' : t.length > 40 ? `${t.slice(0, 40)}...` : t;
};

type VersionField = DocField & { show_on_timeline?: unknown };

/**
 * Version.data → readable lines (Desk: form/footer/version_timeline_content_builder.js):
 * docstatus becomes "submitted / cancelled this document", hidden fields and fields the user can't read
 * are left out (unless show_on_timeline), at most 3 changes per kind, added / removed rows counted per table.
 */
function versionLines(raw: string, meta: DocTypeMeta, childMetas: DocTypeMeta[], fieldPerm?: (df: DocField) => FieldStatus): string[] {
  let d: { changed?: unknown[][]; added?: unknown[][]; removed?: unknown[][]; row_changed?: unknown[][]; comment?: string } = {};
  try {
    d = JSON.parse(raw);
  } catch {
    return [];
  }
  if (d.comment) return [show(d.comment)];
  const field = (m: DocTypeMeta | undefined, f: string) => m?.fields?.find((x) => x.fieldname === f) as VersionField | undefined;
  const visible = (df: VersionField | undefined): df is VersionField => {
    if (!df || (df.hidden && !df.show_on_timeline)) return false;
    return !!(df.hidden && df.show_on_timeline) || (fieldPerm?.(df) ?? "Read") !== "None";
  };
  const tableMeta = (table: string) => childMetas.find((c) => c.name === field(meta, table)?.options);
  const out: string[] = [];

  const parts: string[] = [];
  for (const [f, a, b] of (d.changed ?? []) as Array<[string, unknown, unknown]>) {
    if (f === "docstatus") {
      if (b === 1) out.push("submitted this document");
      else if (b === 2) out.push("cancelled this document");
    } else {
      const df = field(meta, f);
      if (visible(df)) parts.push(`${df.label ?? f} from ${show(a)} to ${show(b)}`);
    }
    if (parts.length >= 3) break;
  }
  if (parts.length) out.push(`changed the value of ${parts.join(", ")}`);

  const rowParts: string[] = [];
  outer: for (const [table, idx, , changes] of (d.row_changed ?? []) as Array<[string, number, string, Array<[string, unknown, unknown]>]>) {
    for (const [f, a, b] of changes ?? []) {
      const df = field(tableMeta(table), f);
      if (visible(df)) rowParts.push(`${df.label ?? f} from ${show(a)} to ${show(b)} in row #${Number(idx) + 1}`);
      if (rowParts.length >= 3) break outer;
    }
  }
  if (rowParts.length) out.push(`changed the values for ${rowParts.join(", ")}`);

  for (const key of ["added", "removed"] as const) {
    const counts = new Map<string, number>();
    for (const [table] of (d[key] ?? []) as Array<[string]>) {
      const df = field(meta, table);
      if (visible(df)) counts.set(df.label ?? table, (counts.get(df.label ?? table) ?? 0) + 1);
    }
    const msgs = [...counts].map(([t, n]) => `${n} ${n > 1 ? "rows" : "row"} ${key === "added" ? "to" : "from"} ${t}`);
    if (msgs.length) out.push(`${key} ${msgs.join(", ")}`);
  }
  return out;
}

export default function Timeline({
  doc,
  docinfo,
  meta,
  childMetas,
  user,
  fullName,
  onChanged,
  fieldPerm,
}: {
  doc: Doc;
  docinfo: DocInfo;
  meta: DocTypeMeta;
  childMetas: DocTypeMeta[];
  user?: string;
  fullName?: string;
  onChanged: () => Promise<unknown> | void;
  /** the form's field permission check: changes to fields the user can't read stay out of the timeline */
  fieldPerm?: (df: DocField) => FieldStatus;
}) {
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<Record<string, string>>({});
  const [suggest, setSuggest] = useState<{ q: string; items: Array<{ value: string; description?: string }> } | null>(null);
  const [editing, setEditing] = useState<{ name: string; text: string } | null>(null);
  const [composing, setComposing] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    for (const c of (docinfo.comments ?? []) as Array<Record<string, unknown>>)
      list.push({ kind: "comment", at: String(c.creation ?? ""), by: String(c.owner ?? c.comment_email ?? ""), html: String(c.content ?? ""), name: String(c.name), email: c.comment_email as string | undefined });
    for (const c of (docinfo.communications ?? []) as Array<Record<string, unknown>>)
      list.push({
        kind: "email",
        at: String(c.communication_date ?? c.creation ?? ""),
        by: String(c.sender_full_name ?? c.sender ?? ""),
        subject: String(c.subject ?? ""),
        html: String(c.content ?? ""),
        to: String(c.recipients ?? ""),
        received: c.sent_or_received === "Received",
        name: String(c.name),
      });
    for (const v of (docinfo.versions ?? []) as Array<Record<string, unknown>>) {
      const lines = versionLines(String(v.data ?? "{}"), meta, childMetas, fieldPerm);
      if (lines.length) list.push({ kind: "version", at: String(v.creation ?? ""), by: String(v.owner ?? ""), lines, name: String(v.name) });
    }
    for (const key of ["assignment_logs", "attachment_logs", "info_logs", "like_logs", "workflow_logs"]) {
      for (const l of (docinfo[key] as Array<Record<string, unknown>> | undefined) ?? [])
        list.push({ kind: "log", at: String(l.creation ?? ""), by: String(l.owner ?? ""), html: String(l.content ?? l.comment_type ?? ""), name: `${key}:${String(l.name)}` });
    }
    return list.sort((a, b) => b.at.localeCompare(a.at));
  }, [docinfo, meta, childMetas, fieldPerm]);

  // @mention autocomplete on the word before the caret
  const onType = async (v: string) => {
    setText(v);
    const caret = box.current?.selectionStart ?? v.length;
    const m = /(^|\s)@([\w.-]*)$/.exec(v.slice(0, caret));
    if (!m) return setSuggest(null);
    try {
      const items = await searchLink("User", m[2], { page_length: 6 });
      setSuggest({ q: m[2], items: items.filter((i) => i.value !== "Guest") });
    } catch {
      setSuggest(null);
    }
  };
  const pickMention = (u: { value: string; description?: string }) => {
    const label = u.description || u.value;
    const caret = box.current?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@[\w.-]*$/, `@${label} `);
    setText(before + text.slice(caret));
    setMentions((m) => ({ ...m, [label]: u.value }));
    setSuggest(null);
    box.current?.focus();
  };

  /** plain text → comment HTML with Frappe mention spans (notifications parse data-id) */
  const toHtml = (s: string) => {
    let html = escapeHtml(s.trim()).replace(/\n/g, "<br>");
    for (const [label, id] of Object.entries(mentions)) {
      const span = `<span class="mention" data-id="${escapeHtml(id)}" data-value="${escapeHtml(label)}" data-denotation-char="@">@${escapeHtml(label)}</span>`;
      html = html.split(`@${escapeHtml(label)}`).join(span);
    }
    return `<div>${html}</div>`;
  };

  const post = async () => {
    if (!text.trim()) return;
    try {
      await deskCall("frappe.desk.form.utils.add_comment", { reference_doctype: doc.doctype, reference_name: doc.name, content: toHtml(text), comment_email: user, comment_by: fullName });
      setText("");
      setMentions({});
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add comment");
    }
  };
  const saveEdit = async () => {
    if (!editing) return;
    try {
      await deskCall("frappe.desk.form.utils.update_comment", { name: editing.name, content: toHtml(editing.text) });
      setEditing(null);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update comment");
    }
  };
  const remove = async (name: string) => {
    try {
      await deskCall("frappe.client.delete", { doctype: "Comment", name });
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete comment");
    }
  };
  const plain = (html: string) => {
    const div = typeof document !== "undefined" ? document.createElement("div") : null;
    if (!div) return html;
    div.innerHTML = sanitizeHtml(html.replace(/<br\s*\/?>/g, "\n"));
    return div.textContent ?? "";
  };

  const dot = "absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-zinc-300 dark:border-zinc-900 dark:bg-zinc-600";

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900" aria-label="Activity">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Activity</h2>
        <button type="button" onClick={() => setComposing(true)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
          <Mail className="h-3.5 w-3.5" aria-hidden /> New Email
        </button>
      </div>

      <div className="relative flex gap-2">
        <textarea
          ref={box}
          aria-label="Add a comment"
          value={text}
          onChange={(e) => void onType(e.target.value)}
          onKeyDown={(e) => {
            if (suggest?.items.length && (e.key === "Enter" || e.key === "Tab")) {
              e.preventDefault();
              pickMention(suggest.items[0]);
            } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void post();
            else if (e.key === "Escape") setSuggest(null);
          }}
          rows={2}
          placeholder="Add a comment — @ to mention, ⌘↵ to post"
          className="flex-1 resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button type="button" onClick={() => void post()} disabled={!text.trim()} aria-label="Post comment" className="self-end rounded-lg bg-zinc-900 p-2.5 text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900">
          <Send className="h-4 w-4" aria-hidden />
        </button>
        {suggest && suggest.items.length > 0 && (
          <ul role="listbox" aria-label="Mention a user" className="absolute left-0 top-full z-30 mt-1 w-64 rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {suggest.items.map((u, i) => (
              <li
                key={u.value}
                role="option"
                aria-selected={i === 0}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickMention(u);
                }}
                className={`cursor-pointer px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${i === 0 ? "bg-zinc-50 dark:bg-zinc-800/60" : ""}`}
              >
                <span className="block truncate text-zinc-900 dark:text-zinc-100">{u.description || u.value}</span>
                <span className="block truncate text-xs text-zinc-500">{u.value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ol className="relative mt-5 space-y-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
        {entries.map((t) => (
          <li key={`${t.kind}:${t.name}`} className="text-sm">
            <span className={dot} aria-hidden />
            {t.kind === "comment" ? (
              <div className="group rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60" aria-label={`Comment by ${t.by}`}>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <MessageSquare className="h-3 w-3" aria-hidden />
                  <b className="font-medium text-zinc-700 dark:text-zinc-300">{t.by}</b> · {timeAgo(t.at)}
                  {(t.by === user || t.email === user) && editing?.name !== t.name && (
                    <span className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                      <button type="button" aria-label="Edit comment" onClick={() => setEditing({ name: t.name, text: plain(t.html) })} className="rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                        <Pencil className="h-3 w-3" aria-hidden />
                      </button>
                      <button type="button" aria-label="Delete comment" onClick={() => void remove(t.name)} className="rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                        <Trash2 className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  )}
                </div>
                {editing?.name === t.name ? (
                  <div className="mt-1.5 space-y-1.5">
                    <textarea
                      aria-label="Edit comment text"
                      value={editing.text}
                      autoFocus
                      onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void saveEdit();
                        if (e.key === "Escape") setEditing(null);
                      }}
                      rows={2}
                      className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    />
                    <div className="flex gap-2 text-xs">
                      <button type="button" onClick={() => void saveEdit()} className="rounded-md bg-zinc-900 px-2.5 py-1 text-white dark:bg-zinc-100 dark:text-zinc-900">
                        Save
                      </button>
                      <button type="button" onClick={() => setEditing(null)} className="rounded-md px-2.5 py-1 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-zinc-800 dark:text-zinc-200 [&_.mention]:rounded [&_.mention]:bg-blue-50 [&_.mention]:px-0.5 [&_.mention]:text-blue-700 dark:[&_.mention]:bg-blue-950/50 dark:[&_.mention]:text-blue-300" dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.html) }} />
                )}
              </div>
            ) : t.kind === "email" ? (
              <details className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Mail className="h-3 w-3" aria-hidden />
                    <b className="font-medium text-zinc-700 dark:text-zinc-300">{t.by}</b> {t.received ? "sent an email" : `emailed ${t.to}`} · {timeAgo(t.at)}
                  </div>
                  <div className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{t.subject}</div>
                </summary>
                <div className="mt-2 border-t border-zinc-100 pt-2 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.html) }} />
              </details>
            ) : t.kind === "version" ? (
              <div className="text-zinc-600 dark:text-zinc-400">
                <b className="font-medium text-zinc-800 dark:text-zinc-200">{t.by}</b> {t.lines[0]}
                {t.lines.length > 1 && <span className="text-zinc-400"> and {t.lines.length - 1} more</span>} · {timeAgo(t.at)}
                {t.lines.length > 1 && (
                  <ul className="mt-1 list-disc pl-5 text-xs text-zinc-500">
                    {t.lines.slice(1).map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="text-zinc-600 dark:text-zinc-400 [&_a]:underline">
                <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.html) }} /> · {timeAgo(t.at)}
              </div>
            )}
          </li>
        ))}
        <li className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className={dot} aria-hidden />
          <b className="font-medium text-zinc-800 dark:text-zinc-200">{String(doc.owner ?? "")}</b> created this · {timeAgo(doc.creation)}
        </li>
      </ol>

      {composing && <EmailComposer doc={doc} meta={meta} onClose={() => setComposing(false)} onSent={onChanged} />}
    </section>
  );
}
