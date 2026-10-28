"use client";

import * as React from "react";

const PopoverContext = React.createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

function usePopover() {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) throw new Error("Popover components must be used within <Popover>");
  return ctx;
}

/** Controlled or uncontrolled; closes on outside click and Escape. */
export function Popover({
  open: openProp,
  onOpenChange,
  children,
  className = "",
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [openState, setOpenState] = React.useState(false);
  const open = openProp ?? openState;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setOpenState(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);
  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div ref={ref} className={`relative ${className}`}>{children}</div>
    </PopoverContext.Provider>
  );
}

export function usePopoverClose() {
  const { setOpen } = usePopover();
  return () => setOpen(false);
}

export function PopoverTrigger({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  const { setOpen, open } = usePopover();
  return (
    <button type="button" onClick={() => setOpen(!open)} {...props}>
      {children}
    </button>
  );
}

export function PopoverContent({ children, className = "", align = "start" }: { children: React.ReactNode; className?: string; align?: "start" | "center" | "end" }) {
  const { open } = usePopover();
  if (!open) return null;

  const alignClass = align === "end" ? "right-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "left-0";

  return (
    <div className={`absolute z-50 mt-1 w-80 rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-800 ${alignClass} ${className}`}>
      {children}
    </div>
  );
}
