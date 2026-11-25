import { cn } from "@/lib/utils";

/**
 * Bar pinned to the bottom of the screen for the state of the page and what to do about it (GAPS § 3.4:
 * "Unsaved changes" bar on forms, the bulk bar on lists). The message is announced politely to screen readers.
 * `placement="sticky"` keeps it inside a scroll container instead of the viewport.
 */
export function BottomBar({
  open = true,
  message,
  children,
  label = "Page actions",
  placement = "fixed",
  className,
}: {
  open?: boolean;
  message?: React.ReactNode;
  /** actions, primary last */
  children?: React.ReactNode;
  label?: string;
  placement?: "fixed" | "sticky";
  className?: string;
}) {
  return (
    <>
      {/* the live region stays mounted so the message is announced when the bar appears */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {open ? message : null}
      </div>
      {open && (
        <div
          role="region"
          aria-label={label}
          className={cn(
            placement === "fixed" ? "fixed inset-x-0 bottom-0" : "sticky bottom-0",
            "z-[var(--z-bottombar)] border-t border-[var(--border-color)] bg-[var(--card)] pb-[env(safe-area-inset-bottom)] shadow-elev-3",
            className,
          )}
        >
          <div className="mx-auto flex flex-wrap items-center justify-between gap-[var(--density-gap)] px-gutter py-[var(--density-pad-y)]">
            {message && <div className="min-w-0 text-sm font-medium text-[var(--text-color)]">{message}</div>}
            <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
