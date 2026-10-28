"use client";

import * as React from "react";

type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId?: string;
  descriptionId?: string;
  setWidth: (maxWidth: string) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

const DEFAULT_WIDTH = "max-w-lg";

/**
 * Modal dialog: role="dialog" + aria-modal, Escape and backdrop click close,
 * focus moves into the dialog on open and returns to the opener on close. DialogTitle / DialogDescription
 * name and describe it (aria-labelledby / aria-describedby).
 */
export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  // the panel's width is the max-w-* class given to DialogContent (DialogContent reports it up)
  const [width, setWidth] = React.useState(DEFAULT_WIDTH);
  React.useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("keydown", onKey);
    // focus the primary action (last button) or the first focusable element
    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    const target = panel?.querySelector<HTMLElement>("input, select, textarea") ?? (focusables && focusables[focusables.length - 1]);
    target?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open, onOpenChange]);
  return (
    <DialogContext.Provider value={{ open, setOpen: onOpenChange, titleId, descriptionId, setWidth }}>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => onOpenChange(false)} aria-hidden="true" />
          <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className={`relative z-50 max-h-[90vh] w-full ${width} overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-zinc-900`}>
            {children}
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function DialogContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  // width classes (max-w-*) size the panel (via context); the content itself keeps the rest of className
  const ctx = React.useContext(DialogContext);
  const maxWidth = className.match(/\bmax-w-\S+/)?.[0] ?? DEFAULT_WIDTH;
  const setWidth = ctx?.setWidth;
  React.useLayoutEffect(() => {
    setWidth?.(maxWidth);
    return () => setWidth?.(DEFAULT_WIDTH);
  }, [setWidth, maxWidth]);
  return <div className={className.replace(/\bmax-w-\S+/g, "")}>{children}</div>;
}

export function DialogHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

export function DialogTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(DialogContext);
  return <h2 id={ctx?.titleId} className={`text-lg font-semibold text-zinc-900 dark:text-zinc-100 ${className}`}>{children}</h2>;
}

export function DialogDescription({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(DialogContext);
  return <p id={ctx?.descriptionId} className={`text-sm text-zinc-500 dark:text-zinc-400 ${className}`}>{children}</p>;
}

export function DialogFooter({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mt-6 flex justify-end gap-2 ${className}`}>{children}</div>;
}
