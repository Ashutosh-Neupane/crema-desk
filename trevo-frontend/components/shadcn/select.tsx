"use client";

import * as React from "react";

interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelect() {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error("Select components must be used within <Select>");
  return ctx;
}

export function Select({ value, onValueChange, children, open: controlledOpen, onOpenChange }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ className = "", children, ...props }: React.HTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  const { open, setOpen } = useSelect();

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={`flex h-7 w-full items-center justify-between rounded-lg border border-[var(--control-bg)] bg-[var(--control-bg)] px-2 py-1 text-sm text-foreground transition-colors focus:outline-none focus:shadow-[var(--focus-default)] disabled:cursor-not-allowed disabled:bg-[var(--disabled-control-bg)] disabled:opacity-70 dark:border-[var(--control-bg)] dark:bg-[var(--control-bg)] dark:text-foreground ${className}`}
      {...props}
    >
      {children}
      <svg className="h-4 w-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = useSelect();
  return <span>{value || placeholder}</span>;
}

export function SelectContent({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const { open } = useSelect();
  if (!open) return null;

  return (
    <div className={`absolute z-50 top-full mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 ${className}`}>
      {children}
    </div>
  );
}

export function SelectItem({ value, children, className = "" }: { value: string; children: React.ReactNode; className?: string }) {
  const { value: selected, onValueChange, setOpen } = useSelect();
  const isSelected = selected === value;

  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onValueChange(value);
          setOpen(false);
        }
      }}
      className={`flex cursor-pointer items-center px-3 py-2 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 ${isSelected ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300"} ${className}`}
    >
      {children}
    </div>
  );
}
