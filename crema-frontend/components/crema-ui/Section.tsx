"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A card-like block of a page (GAPS § 3.4 "sections as cards with fluid spacing").
 * `collapsible` sections (principle 2: empty optional sections collapsed) toggle with a button that carries
 * aria-expanded / aria-controls; controlled with `open` + `onOpenChange` or uncontrolled with `defaultOpen`.
 */
export function Section({
  title,
  description,
  actions,
  collapsible = false,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  headingLevel = 2,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  headingLevel?: 2 | 3 | 4;
  children?: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const headingId = `${id}-h`;
  const bodyId = `${id}-b`;
  const [openState, setOpenState] = useState(defaultOpen);
  const open = !collapsible || (openProp ?? openState);
  const toggle = () => {
    const next = !open;
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  };
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={cn("rounded-card border border-[var(--border-color)] bg-[var(--card)] shadow-elev-1", className)}
    >
      {title && (
        <div className={cn("flex items-start justify-between gap-3 px-[var(--density-section-pad)] pt-[var(--density-section-pad)]", !open && "pb-[var(--density-section-pad)]")}>
          <div className="min-w-0 flex-1">
            <Heading id={headingId} className="text-h3 font-semibold text-[var(--heading-color)]">
              {collapsible ? (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={bodyId}
                  onClick={toggle}
                  className="crema-focus -mx-1 flex min-h-control w-full items-center gap-1.5 rounded-control px-1 text-left"
                >
                  <ChevronDown
                    aria-hidden="true"
                    className={cn("h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-[var(--duration-fast)]", !open && "-rotate-90")}
                  />
                  {title}
                </button>
              ) : (
                title
              )}
            </Heading>
            {description && <p className="mt-0.5 text-sm text-[var(--text-muted)]">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div id={bodyId} hidden={!open} className="p-[var(--density-section-pad)] text-density">
        {children}
      </div>
    </section>
  );
}
