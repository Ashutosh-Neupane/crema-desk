"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/ui/useFocusTrap";

const noopSubscribe = () => () => {};

/**
 * Drawer for looking at or editing something without losing the page (GAPS § 3.3): a list row preview, a linked
 * document peek, the timeline. From the right on ≥ 640px, a bottom sheet below that.
 * role="dialog" + aria-modal, focus trapped inside (Tab cycles), Escape / backdrop / Close button close it, and
 * focus returns to the opener. Give the element to focus first `data-autofocus`.
 */
export function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closeLabel = "Close",
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** actions pinned under the scrolling body (primary action last) */
  footer?: React.ReactNode;
  closeLabel?: string;
  className?: string;
}) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!open || !mounted) return null;
  return createPortal(
    <SidePanelSurface onClose={() => onOpenChange(false)} title={title} description={description} footer={footer} closeLabel={closeLabel} className={className}>
      {children}
    </SidePanelSurface>,
    document.body,
  );
}

function SidePanelSurface({
  onClose,
  title,
  description,
  footer,
  closeLabel,
  className,
  children,
}: {
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  closeLabel: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true, onClose);
  // the page behind doesn't scroll while the panel is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-[var(--z-panel)]">
      <div className="crema-backdrop absolute inset-0 bg-black/40" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={description ? `${id}-d` : undefined}
        tabIndex={-1}
        data-crema-panel=""
        className={cn(
          "crema-panel absolute flex flex-col bg-[var(--card)] text-[var(--text-color)] shadow-elev-4 outline-none",
          // phones: bottom sheet
          "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-panel pb-[env(safe-area-inset-bottom)]",
          // ≥ 640px: drawer on the right
          "sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:h-full sm:max-h-none sm:w-[var(--panel-width)] sm:rounded-none sm:rounded-l-panel sm:pb-0",
          className,
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--gray-300)] sm:hidden" aria-hidden="true" />
        <div className="flex items-start gap-3 border-b border-[var(--border-color)] px-[var(--density-section-pad)] py-[var(--density-pad-y)]">
          <div className="min-w-0 flex-1 py-1">
            <h2 id={`${id}-t`} className="truncate text-h2 font-semibold text-[var(--heading-color)]">
              {title}
            </h2>
            {description && (
              <p id={`${id}-d`} className="mt-0.5 text-sm text-[var(--text-muted)]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="crema-focus flex h-touch w-touch shrink-0 items-center justify-center rounded-control text-[var(--text-muted)] hover:bg-[var(--fg-hover-color)] hover:text-[var(--text-color)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-[var(--density-section-pad)] text-density">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border-color)] px-[var(--density-section-pad)] py-[var(--density-pad-y)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
