"use client";

import { cn } from "@/lib/utils";
import { setDensity, useDensity, type Density } from "@/lib/ui/newLayout";

const OPTIONS: { value: Density; label: string }[] = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

/** Comfortable / Compact (Desk-like) per user (GAPS § 3.2); a radio group, arrow keys move the choice */
export function DensitySwitch({ className }: { className?: string }) {
  const density = useDensity();
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next = density === "compact" ? "comfortable" : "compact";
    setDensity(next);
    e.currentTarget.querySelector<HTMLElement>(`[data-value="${next}"]`)?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label="Density"
      onKeyDown={onKeyDown}
      className={cn("inline-flex rounded-control border border-[var(--dark-border-color)] bg-[var(--control-bg)] p-0.5", className)}
    >
      {OPTIONS.map((o) => {
        const checked = density === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            data-value={o.value}
            onClick={() => setDensity(o.value)}
            className={cn(
              "crema-focus min-h-[calc(var(--density-control-height)-6px)] rounded-[calc(var(--round-control)-2px)] px-3 text-sm",
              checked ? "bg-[var(--card)] font-medium text-[var(--text-color)] shadow-elev-1" : "text-[var(--text-muted)] hover:text-[var(--text-color)]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
