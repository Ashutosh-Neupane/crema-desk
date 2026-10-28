"use client";

import * as React from "react";

const DropdownContext = React.createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

function useDropdown() {
  const ctx = React.useContext(DropdownContext);
  if (!ctx) throw new Error("Dropdown components must be used within <DropdownMenu>");
  return ctx;
}

/**
 * Controlled (`open` + `onOpenChange`) or uncontrolled. Closes on outside
 * click and Escape.
 */
export function DropdownMenu({
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={ref} className={`relative ${className}`}>{children}</div>
    </DropdownContext.Provider>
  );
}

export function DropdownMenuLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-3 pb-1 pt-2 text-xs font-medium text-zinc-500 ${className}`}>{children}</div>;
}

export function DropdownMenuTrigger({ children, ...props }: { children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen, open } = useDropdown();

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({ children, className = "", align = "start" }: { children: React.ReactNode; className?: string; align?: "start" | "center" | "end" }) {
  const { open } = useDropdown();
  if (!open) return null;

  const alignClass = align === "end" ? "right-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "left-0";

  return (
    <div className={`absolute z-50 mt-1 min-w-[180px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 ${alignClass} ${className}`}>
      {children}
    </div>
  );
}

export function DropdownMenuItem({ children, className = "", onClick, disabled, ...props }: { children: React.ReactNode; className?: string; onClick?: () => void; disabled?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  const { setOpen } = useDropdown();

  return (
    <div
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (disabled) return;
        onClick?.();
        setOpen(false);
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
          setOpen(false);
        }
      }}
      className={`flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 transition-colors dark:text-zinc-300 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700"
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className = "" }: { className?: string }) {
  return <div className={`my-1 h-px bg-zinc-200 dark:bg-zinc-700 ${className}`} />;
}
