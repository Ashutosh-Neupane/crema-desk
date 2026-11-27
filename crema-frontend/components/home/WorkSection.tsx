"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { focusRing } from "./data";


/** A card on the My work page: heading, count, "View all", and its loading / error / empty / list body. */
export function WorkSection({
  id,
  title,
  icon,
  count,
  viewAll,
  loading,
  error,
  onRetry,
  empty,
  children,
  className = "",
}: {
  id: string;
  title: string;
  icon: ReactNode;
  count?: number;
  viewAll?: { href: string; label: string };
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** shown when not loading, no error and no children */
  empty: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const headingId = `${id}-heading`;
  let body: ReactNode = children;
  if (loading) body = <SectionSkeleton />;
  else if (error) body = <SectionError onRetry={onRetry} />;
  else if (!children) body = empty;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      aria-busy={loading || undefined}
      className={`flex min-w-0 flex-col rounded-xl border border-border bg-card p-section text-card-foreground shadow-sm ${className}`}
    >
      <header className="mb-3 flex items-center gap-2">
        <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
        <h2 id={headingId} className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        {!loading && !!count && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {count}
            <span className="sr-only"> items</span>
          </span>
        )}
        {viewAll && (
          <Link
            href={viewAll.href}
            className={`ml-auto inline-flex min-h-10 items-center rounded-md px-2 text-xs font-medium text-muted-foreground hover:text-foreground ${focusRing}`}
          >
            {viewAll.label}
          </Link>
        )}
      </header>
      {body}
    </section>
  );
}

function SectionSkeleton() {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex min-h-12 items-center gap-3 rounded-lg px-1">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-muted" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 py-3 text-sm text-muted-foreground" role="alert">
      <p>Couldn&apos;t load this right now.</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted ${focusRing}`}
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}

/** Empty state with the next step: one sentence and one action (a link or a button). */
export function EmptyNext({
  icon,
  message,
  action,
}: {
  icon: ReactNode;
  message: string;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  const cls = `inline-flex min-h-10 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted ${focusRing}`;
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-6 text-center">
      <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
      <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
      {action?.href ? (
        <Link href={action.href} className={cls}>
          {action.label}
        </Link>
      ) : action?.onClick ? (
        <button type="button" onClick={action.onClick} className={cls}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
