"use client";

/**
 * Tooltip for icon-only buttons and truncated text (docs/PHASE2_DESIGN.md § 2.4, § 2.5). Radix Tooltip: shows on
 * hover and keyboard focus, Esc closes it, the trigger gets aria-describedby. An optional shortcut shows as <Kbd>.
 *
 *   <Tooltip label="Search" shortcut="Mod+K"><button aria-label="Search">…</button></Tooltip>
 *
 * The trigger keeps its own accessible name (aria-label); the tooltip only describes it.
 */
import * as RT from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { Kbd } from "./Kbd";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RT.Provider delayDuration={400} skipDelayDuration={200}>
      {children}
    </RT.Provider>
  );
}

export function Tooltip({ label, shortcut, side = "bottom", children }: { label: ReactNode; shortcut?: string; side?: "top" | "right" | "bottom" | "left"; children: ReactNode }) {
  return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="crema-fade z-(--z-popover) flex max-w-xs items-center gap-2 rounded-[var(--round-control)] bg-[var(--gray-900)] px-2 py-1 text-[var(--type-caption)] text-white shadow-[var(--elevation-2)]"
        >
          {label}
          {shortcut && <Kbd keys={shortcut} className="border-white/20 bg-white/10 text-white" />}
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}
