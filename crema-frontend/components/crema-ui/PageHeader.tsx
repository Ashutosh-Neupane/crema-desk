import { cn } from "@/lib/utils";

/**
 * Page title row (GAPS § 3.4 "sticky header with title, status, stepper and one primary action").
 * Principle 1: one `primaryAction`; everything else goes in `actions` (secondary buttons / a menu).
 */
export function PageHeader({
  title,
  subtitle,
  status,
  breadcrumbs,
  actions,
  primaryAction,
  sticky = false,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** usually a <StatusPill> */
  status?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  /** secondary actions, shown before the primary one */
  actions?: React.ReactNode;
  primaryAction?: React.ReactNode;
  sticky?: boolean;
  /** extra rows under the title (a Stepper, tabs) */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "@container flex flex-col gap-[var(--density-gap)] border-b border-[var(--border-color)] bg-[var(--bg-color)] px-gutter py-[var(--density-pad-y)]",
        sticky && "sticky top-0 z-20",
        className,
      )}
    >
      {breadcrumbs && <div className="text-xs text-[var(--text-muted)]">{breadcrumbs}</div>}
      <div className="flex flex-col gap-2 @md:flex-row @md:items-center @md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate text-h1 font-semibold text-[var(--heading-color)]">{title}</h1>
            {status}
          </div>
          {subtitle && <p className="mt-0.5 text-sm text-[var(--text-muted)]">{subtitle}</p>}
        </div>
        {(actions || primaryAction) && (
          <div className="flex flex-wrap items-center gap-2 @md:shrink-0 @md:justify-end">
            {actions}
            {primaryAction}
          </div>
        )}
      </div>
      {children}
    </header>
  );
}
