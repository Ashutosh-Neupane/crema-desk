"use client";

/**
 * Server error details (Desk's "Server Error" dialog, request.js report_error): the message and the
 * server traceback in a <pre>, with copy. Opened from toasts via showErrorDetails(); mounted once in app/providers.tsx.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { usePathname } from "next/navigation";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { closeErrorDetails, getErrorDetails, setTracebacksAllowed, subscribeErrorDetails, type ErrorDetailsInfo } from "@/components/desk/errorDetailsStore";

// importers (lib/frappe/errors.ts) open the dialog through these; the state lives in errorDetailsStore
export { showErrorDetails, tracebacksAllowed, type ErrorDetailsInfo } from "@/components/desk/errorDetailsStore";

const noInfo = () => null;

export function ErrorDetailsHost() {
  const info = useSyncExternalStore(subscribeErrorDetails, getErrorDetails, noInfo);
  // "Copied" belongs to the error it was copied from: a newly shown error starts at "Copy"
  const [copiedFor, setCopiedFor] = useState<ErrorDetailsInfo | null>(null);
  const copied = !!info && copiedFor === info;
  // mounted app-wide (providers.tsx): only signed-in Desk pages have a context to load; /login has no session
  const inDesk = usePathname()?.startsWith("/desk") ?? false;
  const { data: ctx } = useDeskContext({ enabled: inDesk });
  useEffect(() => {
    setTracebacksAllowed(!!ctx?.roles?.includes("System Manager"));
  }, [ctx]);
  const copy = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.traceback);
      setCopiedFor(info);
    } catch {
      /* clipboard unavailable — the text stays selectable in the <pre> */
    }
  };
  return (
    <Dialog open={!!info} onOpenChange={(o) => !o && closeErrorDetails()}>
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
          <Button type="button" onClick={closeErrorDetails}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
