"use client";

/**
 * Form sidebar (Desk: frappe/public/js/frappe/form/sidebar/*): assignments, attachments, tags,
 * shared with, follow and like — each one editable like Desk.
 *   assign_to.add / remove · upload_file / form.utils.remove_attach · tag.add_tag / remove_tag
 *   share.add / set_permission · document_follow.update_follow · like.toggle_like
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Heart,
  Loader2,
  Paperclip,
  Plus,
  Share2,
  Tag,
  UserPlus,
  X,
} from "lucide-react";
import { deskCall, type Doc, type DocInfo } from "@/lib/frappe/form";
import { fileNameFromUrl, uploadFile } from "@/lib/frappe/upload";
import { timeAgo } from "@/lib/list/format";
import LinkInput from "@/components/list/LinkInput";

const card = "rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900";
const head =
  "mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400";
const addBtn =
  "ml-auto rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200";
const NO_FOLLOW = new Set([
  "Communication",
  "ToDo",
  "Email Unsubscribe",
  "File",
  "Comment",
  "Email Account",
  "Email Domain",
]);
const chipX =
  "rounded-full p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700";

export default function FormSidebar({
  doc,
  docinfo,
  user,
  canWrite,
  trackChanges,
  onChanged,
}: {
  doc: Doc;
  docinfo: DocInfo;
  user?: string;
  canWrite: boolean;
  /** DocType tracks changes — Frappe only allows following those */
  trackChanges?: boolean;
  /** reload doc + docinfo after a change */
  onChanged: () => Promise<unknown> | void;
}) {
  const dt = doc.doctype;
  const dn = doc.name;
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState<null | "assign" | "tag" | "share">(null);
  const [tagText, setTagText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const act = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) toast.success(ok);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed", { duration: 8000 });
    } finally {
      setBusy(null);
    }
  };

  const assignments = (docinfo.assignments ?? []) as Array<{
    name?: string;
    owner?: string;
    allocated_to?: string;
  }>;
  const attachments = (docinfo.attachments ?? []) as Array<{
    name: string;
    file_url?: string;
    file_name?: string;
    is_private?: number;
  }>;
  const tags = String(doc._user_tags || docinfo.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const shared = (docinfo.shared ?? []) as Array<{
    user?: string;
    everyone?: number;
    read?: number;
    write?: number;
    share?: number;
  }>;
  let likedBy: string[] = [];
  try {
    likedBy = doc._liked_by ? (JSON.parse(String(doc._liked_by)) as string[]) : [];
  } catch {
    likedBy = [];
  }
  const liked = !!user && likedBy.includes(user);
  const following = !!docinfo.is_document_followed;
  // Frappe's _follow_document refuses these (document_follow.py); Desk hides the control
  const canFollow = !!trackChanges && user !== "Administrator" && !NO_FOLLOW.has(dt);

  return (
    <aside
      className="space-y-4 text-sm xl:sticky xl:top-28 xl:self-start"
      aria-label="Document sidebar"
    >
      {/* Assigned to */}
      <section className={card} aria-label="Assigned to">
        <h3 className={head}>
          <UserPlus className="h-3.5 w-3.5" aria-hidden /> Assigned to
          {canWrite && (
            <button
              type="button"
              className={addBtn}
              aria-label="Add assignment"
              onClick={() => setAdding(adding === "assign" ? null : "assign")}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </h3>
        {adding === "assign" && (
          <LinkInput
            doctype="User"
            value=""
            autoFocus
            placeholder="Assign to user"
            getQuery={() => ({ filters: { enabled: 1, user_type: "System User" } })}
            onChange={(u) => {
              if (!u) return;
              setAdding(null);
              void act(
                "assign",
                () =>
                  deskCall("frappe.desk.form.assign_to.add", {
                    doctype: dt,
                    name: dn,
                    assign_to: JSON.stringify([u]),
                  }),
                `Assigned to ${u}`
              );
            }}
            className="mb-2 [&_input]:h-8 [&_input]:w-full"
          />
        )}
        {assignments.length ? (
          <ul className="space-y-1">
            {assignments.map((a) => {
              const who = String(a.owner ?? a.allocated_to ?? a.name);
              return (
                <li key={String(a.name)} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-medium uppercase dark:bg-zinc-700">
                    {who.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">
                    {who}
                  </span>
                  {canWrite && (
                    <button
                      type="button"
                      className={chipX}
                      aria-label={`Remove assignment ${who}`}
                      onClick={() =>
                        void act(`un-${who}`, () =>
                          deskCall("frappe.desk.form.assign_to.remove", {
                            doctype: dt,
                            name: dn,
                            assign_to: who,
                          })
                        )
                      }
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-zinc-400">Nobody</p>
        )}
      </section>

      {/* Attachments */}
      <section className={card} aria-label="Attachments">
        <h3 className={head}>
          <Paperclip className="h-3.5 w-3.5" aria-hidden /> Attachments
          {busy === "attach" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {canWrite && (
            <button
              type="button"
              className={addBtn}
              aria-label="Attach a file"
              onClick={() => fileInput.current?.click()}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </h3>
        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          aria-label="Attachment file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f)
              void act(
                "attach",
                () => uploadFile(f, { doctype: dt, docname: dn, is_private: true }),
                `Attached ${f.name}`
              );
          }}
        />
        {attachments.length ? (
          <ul className="space-y-1">
            {attachments.map((a) => (
              <li key={a.name} className="flex items-center gap-2">
                <a
                  href={String(a.file_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-zinc-700 hover:underline dark:text-zinc-200"
                >
                  {a.file_name ?? fileNameFromUrl(String(a.file_url ?? a.name))}
                </a>
                {canWrite && (
                  <button
                    type="button"
                    className={chipX}
                    aria-label={`Remove attachment ${a.file_name ?? a.name}`}
                    onClick={() =>
                      void act(`rm-${a.name}`, () =>
                        deskCall("frappe.desk.form.utils.remove_attach", { fid: a.name, dt, dn })
                      )
                    }
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-zinc-400">None</p>
        )}
      </section>

      {/* Tags */}
      <section className={card} aria-label="Tags">
        <h3 className={head}>
          <Tag className="h-3.5 w-3.5" aria-hidden /> Tags
          {canWrite && (
            <button
              type="button"
              className={addBtn}
              aria-label="Add tag"
              onClick={() => setAdding(adding === "tag" ? null : "tag")}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </h3>
        {adding === "tag" && (
          <input
            autoFocus
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setAdding(null);
              if (e.key === "Enter" && tagText.trim()) {
                const t = tagText.trim();
                setTagText("");
                setAdding(null);
                void act("tag", () =>
                  deskCall("frappe.desk.doctype.tag.tag.add_tag", { tag: t, dt, dn })
                );
              }
            }}
            placeholder="Tag name, Enter to add"
            aria-label="New tag"
            className="mb-2 h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        )}
        {tags.length ? (
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-0.5 rounded-full bg-zinc-100 py-0.5 pl-2 pr-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {t}
                {canWrite && (
                  <button
                    type="button"
                    className={chipX}
                    aria-label={`Remove tag ${t}`}
                    onClick={() =>
                      void act(`untag-${t}`, () =>
                        deskCall("frappe.desk.doctype.tag.tag.remove_tag", { tag: t, dt, dn })
                      )
                    }
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-zinc-400">No tags</p>
        )}
      </section>

      {/* Shared with */}
      <section className={card} aria-label="Shared with">
        <h3 className={head}>
          <Share2 className="h-3.5 w-3.5" aria-hidden /> Shared with
          {canWrite && (
            <button
              type="button"
              className={addBtn}
              aria-label="Share"
              onClick={() => setAdding(adding === "share" ? null : "share")}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </h3>
        {adding === "share" && (
          <LinkInput
            doctype="User"
            value=""
            autoFocus
            placeholder="Share with user"
            onChange={(u) => {
              if (!u) return;
              setAdding(null);
              void act(
                "share",
                () => deskCall("frappe.share.add", { doctype: dt, name: dn, user: u, read: 1 }),
                `Shared with ${u}`
              );
            }}
            className="mb-2 [&_input]:h-8 [&_input]:w-full"
          />
        )}
        {shared.length ? (
          <ul className="space-y-1">
            {shared.map((s) => {
              const who = s.everyone ? "Everyone" : String(s.user);
              return (
                <li key={who} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">
                    {who}
                  </span>
                  <span className="text-xs text-zinc-400">{s.write ? "can edit" : "can view"}</span>
                  {canWrite && (
                    <button
                      type="button"
                      className={chipX}
                      aria-label={`Stop sharing with ${who}`}
                      onClick={() =>
                        void act(`unshare-${who}`, () =>
                          deskCall("frappe.share.set_permission", {
                            doctype: dt,
                            name: dn,
                            user: s.everyone ? null : s.user,
                            permission_to: "read",
                            value: 0,
                            everyone: s.everyone ? 1 : 0,
                          })
                        )
                      }
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-zinc-400">Not shared</p>
        )}
      </section>

      {/* follow / like */}
      <div className="flex gap-2">
        {canFollow && (
          <button
            type="button"
            aria-pressed={following}
            disabled={busy === "follow"}
            onClick={() =>
              void act(
                "follow",
                () =>
                  deskCall("frappe.desk.form.document_follow.update_follow", {
                    doctype: dt,
                    doc_name: dn,
                    following: !following,
                  }),
                following ? "Unfollowed" : "Following — you'll get email updates"
              )
            }
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {following ? (
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Eye className="h-3.5 w-3.5" aria-hidden />
            )}
            {following ? "Unfollow" : "Follow"}
          </button>
        )}
        <button
          type="button"
          aria-pressed={liked}
          aria-label={liked ? "Unlike" : "Like"}
          disabled={busy === "like"}
          onClick={() =>
            void act("like", () =>
              deskCall("frappe.desk.like.toggle_like", {
                doctype: dt,
                name: dn,
                add: liked ? "No" : "Yes",
              })
            )
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Heart
            className={`h-3.5 w-3.5 ${liked ? "fill-red-500 text-red-500" : ""}`}
            aria-hidden
          />
          {likedBy.length || ""}
        </button>
      </div>

      <div className="space-y-1 px-1 text-xs text-zinc-500">
        <p>
          Created by{" "}
          <b className="font-medium text-zinc-700 dark:text-zinc-300">{String(doc.owner ?? "")}</b>{" "}
          · {timeAgo(doc.creation)}
        </p>
        <p>
          Updated by{" "}
          <b className="font-medium text-zinc-700 dark:text-zinc-300">
            {String(doc.modified_by ?? "")}
          </b>{" "}
          · {timeAgo(doc.modified)}
        </p>
      </div>
    </aside>
  );
}
