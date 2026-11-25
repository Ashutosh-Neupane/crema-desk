"use client";

import Link from "next/link";
import { ChevronRight, Clock, FilePen, GitPullRequestArrow, Pencil, UserCheck } from "lucide-react";
import { StatusPill } from "@/components/crema-ui";
import type { StatusTone } from "@/lib/ui/status";
import { focusRing, timeAgo, type WorkItem, type WorkKind } from "./data";

/** status word + colour + icon (GAPS § 3.1 rule 4) */
const KIND_STATUS: Record<WorkKind, StatusTone> = {
  approval: "warning",
  assignment: "info",
  draft: "neutral",
  viewed: "neutral",
  edited: "neutral",
};

const KIND_ICON: Record<WorkKind, typeof Clock> = {
  approval: GitPullRequestArrow,
  assignment: UserCheck,
  draft: FilePen,
  viewed: Clock,
  edited: Pencil,
};

const KIND_TONE: Record<WorkKind, string> = {
  approval: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  assignment: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  viewed: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  edited: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

/** Documents as rows on wide screens and as stacked cards on phones; the whole row opens the document. */
export function WorkList({ items, label }: { items: WorkItem[]; label: string }) {
  return (
    <ul className="flex flex-col gap-2 sm:-mx-2 sm:gap-0.5" aria-label={label}>
      {items.map((item) => (
        <li key={item.key}>
          <WorkRow item={item} />
        </li>
      ))}
    </ul>
  );
}

function WorkRow({ item }: { item: WorkItem }) {
  const Icon = KIND_ICON[item.kind];
  const when = timeAgo(item.at);
  return (
    <Link
      href={item.href}
      className={`group flex min-h-12 items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:bg-muted sm:border-transparent sm:bg-transparent sm:px-2 sm:py-2 ${focusRing}`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${KIND_TONE[item.kind]}`} aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {item.doctype}
          {item.title !== item.name && ` · ${item.name}`}
          {item.detail && ` · ${item.detail}`}
          {when && ` · ${when}`}
        </span>
      </span>
      {item.status && (
        <StatusPill tone={item.overdue ? "danger" : KIND_STATUS[item.kind]} className="hidden shrink-0 min-[420px]:inline-flex">
          {item.overdue ? "Overdue" : item.status}
        </StatusPill>
      )}
      <span className="flex shrink-0 items-center text-xs font-medium text-muted-foreground group-hover:text-foreground">
        <span className="hidden md:inline">Open</span>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}
