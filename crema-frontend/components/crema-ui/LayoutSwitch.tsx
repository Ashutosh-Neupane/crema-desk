"use client";

import { LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";
import { setNewLayout, useNewLayout } from "@/lib/ui/newLayout";

function Track({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-[var(--duration-fast)]",
        on ? "border-[var(--primary)] bg-[var(--primary)]" : "border-[var(--dark-border-color)] bg-[var(--control-bg-on-gray)]",
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 rounded-full shadow-elev-1 transition-transform duration-[var(--duration-fast)]",
          on ? "translate-x-[18px] bg-[var(--primary-foreground)]" : "translate-x-[2px] bg-[var(--card)]",
        )}
      />
    </span>
  );
}

/**
 * The per-user "New layout" switch (GAPS § 3.6). `variant="menu"` renders a menuitemcheckbox row for the user
 * menu (components/desk/UserMenu.tsx); the default is a standalone role="switch" button.
 */
export function LayoutSwitch({ variant = "switch", className }: { variant?: "switch" | "menu"; className?: string }) {
  const on = useNewLayout();
  const toggle = () => setNewLayout(!on);
  if (variant === "menu") {
    return (
      <div
        role="menuitemcheckbox"
        aria-checked={on}
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        className={cn(
          "crema-focus flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700",
          className,
        )}
      >
        <LayoutTemplate className="h-4 w-4" aria-hidden="true" />
        <span className="flex-1">New layout</span>
        <Track on={on} />
      </div>
    );
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      className={cn("crema-focus inline-flex min-h-control items-center gap-2 rounded-control px-2 text-sm text-[var(--text-color)] hover:bg-[var(--fg-hover-color)]", className)}
    >
      <span>New layout</span>
      <Track on={on} />
    </button>
  );
}
