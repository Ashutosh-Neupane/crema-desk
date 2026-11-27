"use client";

/**
 * List row activity (Desk: list/list_view.js get_meta_html, get_like_html, get_seen_class, setup_like):
 * assignee avatars (click → filter by that user), comment count (99+), a like heart per row (frappe.desk.like.toggle_like)
 * and the header's "liked by me" heart, which filters on _liked_by. Unread (track_seen) subjects are bold — see isUnread.
 */
import { useState } from "react";
import { Heart, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { deskCall } from "@/lib/frappe/form";
import { jsonList } from "@/lib/list/rowMeta";

const initials = (u: string) =>
  (u.split("@")[0].match(/[A-Za-z0-9]/g) ?? ["?"]).slice(0, 2).join("").toUpperCase();

/** frappe.avatar_group(users, max - 1, { filterable: true }) */
export function AssigneeAvatars({
  users,
  onFilter,
  max = 3,
}: {
  users: string[];
  onFilter: (user: string) => void;
  max?: number;
}) {
  if (!users.length) return null;
  const shown = users.length > max ? users.slice(0, max - 1) : users;
  const extra = users.length - shown.length;
  return (
    <span className="inline-flex -space-x-1.5" aria-label={`Assigned to ${users.join(", ")}`}>
      {shown.map((u) => (
        <button
          key={u}
          type="button"
          title={u}
          aria-label={`Filter by assigned to ${u}`}
          onClick={() => onFilter(u)}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-zinc-200 text-[9px] font-semibold text-zinc-700 hover:z-10 hover:ring-1 hover:ring-zinc-400 dark:border-zinc-900 dark:bg-zinc-700 dark:text-zinc-200"
        >
          {initials(u)}
        </button>
      ))}
      {extra > 0 && (
        <span
          title={users.slice(shown.length).join(", ")}
          className="flex h-5 min-w-5 items-center justify-center rounded-full border border-white bg-zinc-100 px-1 text-[9px] font-semibold text-zinc-600 dark:border-zinc-900 dark:bg-zinc-800 dark:text-zinc-300"
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

export function CommentCount({ count }: { count: unknown }) {
  const n = Number(count) || 0;
  return (
    <span
      className="inline-flex items-center gap-0.5"
      title={`${n} comment${n === 1 ? "" : "s"}`}
      data-comment-count={n}
    >
      <MessageSquare className="h-3 w-3" aria-hidden />
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** the row's like heart: liked by me → filled; click toggles (frappe.ui.toggle_like) */
export function LikeButton({
  doctype,
  name,
  likedBy,
  user,
  onChanged,
}: {
  doctype: string;
  name: string;
  likedBy: unknown;
  user: string;
  onChanged?: () => void;
}) {
  const initial = jsonList(likedBy);
  const [local, setLocal] = useState<{ base: string; users: string[] } | null>(null);
  // a fresh server value replaces the optimistic one
  const base = JSON.stringify(initial);
  const users = local && local.base === base ? local.users : initial;
  const liked = users.includes(user);
  const toggle = async () => {
    const next = liked ? users.filter((u) => u !== user) : [...users, user];
    setLocal({ base, users: next });
    try {
      await deskCall("frappe.desk.like.toggle_like", { doctype, name, add: liked ? "No" : "Yes" });
      onChanged?.();
    } catch (e) {
      setLocal(null);
      toast.error(e instanceof Error ? e.message : "Could not update the like");
    }
  };
  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={liked ? `Unlike ${name}` : `Like ${name}`}
      title={users.join(", ")}
      onClick={() => void toggle()}
      className="inline-flex items-center gap-0.5 rounded p-0.5 hover:text-zinc-700 dark:hover:text-zinc-200"
    >
      <Heart className={`h-3 w-3 ${liked ? "fill-red-500 text-red-500" : ""}`} aria-hidden />
      {users.length > 0 && <span>{users.length}</span>}
    </button>
  );
}
