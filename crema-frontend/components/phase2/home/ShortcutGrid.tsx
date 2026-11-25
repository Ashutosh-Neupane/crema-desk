"use client";

import Link from "next/link";
import { ArrowUpRight, BarChart3, FileText, LayoutGrid, Link2 } from "lucide-react";
import { focusRing, type Shortcut } from "./data";

function TypeIcon({ type }: { type: string }) {
  const cls = "h-4 w-4 shrink-0 text-muted-foreground";
  if (type === "Report") return <BarChart3 className={cls} aria-hidden="true" />;
  if (type === "URL") return <Link2 className={cls} aria-hidden="true" />;
  if (type === "Dashboard" || type === "Page") return <LayoutGrid className={cls} aria-hidden="true" />;
  return <FileText className={cls} aria-hidden="true" />;
}

/** The user's workspace shortcuts as large tap targets: 2 per row on phones, more as the card widens. */
export function ShortcutGrid({ shortcuts }: { shortcuts: Shortcut[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Shortcuts">
      {shortcuts.map((s) => (
        <li key={s.key} className="min-w-0">
          <ShortcutTile s={s} />
        </li>
      ))}
    </ul>
  );
}

function ShortcutTile({ s }: { s: Shortcut }) {
  const cls = `flex min-h-12 items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted ${focusRing}`;
  const body = (
    <>
      <TypeIcon type={s.type} />
      <span className="min-w-0 flex-1 truncate">{s.label}</span>
      {s.external && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="opens in a new tab" />}
    </>
  );
  return s.external ? (
    <a href={s.href} target="_blank" rel="noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <Link href={s.href} className={cls}>
      {body}
    </Link>
  );
}
