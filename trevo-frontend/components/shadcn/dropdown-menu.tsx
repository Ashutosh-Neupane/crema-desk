"use client";

import * as React from "react";

const DropdownContext = React.createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

function useDropdown() {
  const ctx = React.useContext(DropdownContext);
  if (!ctx) throw new Error("Dropdown components must be used within <DropdownMenu>");
  return ctx;
}

export function DropdownMenu({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  return (
    <DropdownContext.Provider value={{ open, setOpen: onOpenChange }}>
      <div className="relative">{children}</div>
    </DropdownContext.Provider>
  );
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
