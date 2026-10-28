"use client";

/**
 * Server error details (Desk's "Server Error" dialog, request.js report_error): the message and the
 * server traceback in a <pre>, with copy. Opened from toasts via showErrorDetails(); mounted once in app/providers.tsx.
 */
import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { useDeskContext } from "@/lib/hooks/useDeskContext";

export interface ErrorDetailsInfo {
  message: string;
  traceback: string;
}

let current: ErrorDetailsInfo | null = null;
const listeners = new Set<() => void>();
// Desk shows tracebacks to System Managers only (the host keeps this in sync with the desk context roles)
let systemManager = false;

/** Whether the current user may see server tracebacks (Desk: System Manager) */
export function tracebacksAllowed(): boolean {
  return systemManager;
}

/** Open the error details dialog for an error with a server traceback */
export function showErrorDetails(info: ErrorDetailsInfo) {
  current = info;
  listeners.forEach((l) => l());
}

export function ErrorDetailsHost() {
  const [info, setInfo] = useState<ErrorDetailsInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const { data: ctx } = useDeskContext();
  useEffect(() => {
    systemManager = !!ctx?.roles?.includes("System Manager");
  }, [ctx]);
  useEffect(() => {
    const sync = () => {
      setInfo(current);
      setCopied(false);
    };
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);
  const close = useCallback(() => {
    current = null;
    setInfo(null);
  }, []);
  const copy = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.traceback);
      setCopied(true);
    } catch {
      /* clipboard unavailable — the text stays selectable in the <pre> */
    }
  };
  return (
    <Dialog open={!!info} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Server Error</DialogTitle>
          <DialogDescription>{info?.message}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <pre className="max-h-[50vh] overflow-auto rounded-md bg-zinc-100 p-3 font-mono text-xs leading-relaxed text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200" tabIndex={0} aria-label="Traceback">
            {info?.traceback}
          </pre>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={copy}>
            {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button type="button" onClick={close}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
