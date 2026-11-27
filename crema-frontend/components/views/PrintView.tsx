"use client";

/**
 * Print view (Desk: frappe/public/js/frappe/form/print_utils.js + views/print — /app/print/<dt>/<dn>):
 * pick print format and letterhead, preview the server-rendered HTML, print or download PDF.
 *   www.printview.get_html_and_style · utils.print_format.download_pdf
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2, PenLine, Printer } from "lucide-react";
import { toast } from "sonner";
import { deskCall } from "@/lib/frappe/form";
import { frappeErrorMessage, parseServerMessages } from "@/lib/frappe/errors";
import { useDoctype } from "@/lib/hooks/useDoctype";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

const enc = encodeURIComponent;
/** Desk's print page is one page kept between documents, so the format picked last stays picked; Crema keeps it per DocType */
const pickKey = (doctype: string) => `crema:print-format:${doctype}`;
const noSubscribe = () => () => {};
function readPick(doctype: string): string | null {
  try {
    return localStorage.getItem(pickKey(doctype));
  } catch {
    return null;
  }
}
function savePick(doctype: string, format: string) {
  try {
    localStorage.setItem(pickKey(doctype), format);
  } catch {
    /* private mode: the pick lasts for this page only */
  }
}
const sel = "h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

/**
 * The builder autosaves to the format's draft (print_format.py save_draft) and prints use what was applied, so a
 * format edited without "Save & Apply" still prints its old layout. Say so here, with Apply and the builder a click away.
 */
function DraftNotice({ format }: { format: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data: pf } = useQuery({
    queryKey: ["print-format-draft", format],
    enabled: format !== "Standard",
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => ((await deskCall("frappe.client.get_value", { doctype: "Print Format", filters: format, fieldname: JSON.stringify(["draft_data", "modified"]) })).env.message ?? null) as { draft_data?: string | null; modified?: string } | null,
  });
  if (format === "Standard" || !pf?.draft_data) return null;
  const apply = async () => {
    setBusy(true);
    try {
      await deskCall("frappe.printing.doctype.print_format.print_format.apply_draft", { name: format, modified: pf.modified });
      toast.success(`Applied: ${format} prints with the builder's changes now`);
      await qc.invalidateQueries({ queryKey: ["print-format-draft", format] });
      await qc.invalidateQueries({ queryKey: ["print-html"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't apply the changes", { duration: 8000 });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
      <PenLine className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <strong className="font-medium">{format}</strong>{" "}has changes in the builder that aren&apos;t applied yet. This preview and prints use the last applied version.
      </span>
      <Link href={`/desk/print-format-builder/${enc(format)}`} className="rounded-md px-2.5 py-1 underline underline-offset-2 hover:bg-amber-100 dark:hover:bg-amber-900/40">
        Open builder
      </Link>
      <button type="button" disabled={busy} onClick={() => void apply()} className="inline-flex items-center gap-1.5 rounded-md bg-amber-900 px-3 py-1 font-medium text-white disabled:opacity-50 dark:bg-amber-200 dark:text-amber-950">
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />} Apply changes
      </button>
    </div>
  );
}

export default function PrintView({ doctype, name }: { doctype: string; name: string }) {
  const { data: meta } = useDoctype(doctype);
  const frame = useRef<HTMLIFrameElement>(null);

  const { data: formats = [], isFetched: formatsReady } = useQuery({
    queryKey: ["print-formats", doctype],
    // a format made or enabled in the builder shows up the next time print opens
    staleTime: 0,
    queryFn: async () => ((await deskCall("frappe.client.get_list", { doctype: "Print Format", filters: { doc_type: doctype, disabled: 0 }, fields: ["name"], limit_page_length: 100 })).env.message as Array<{ name: string }>) ?? [],
  });
  const { data: letterheads = [] } = useQuery({
    queryKey: ["letterheads"],
    queryFn: async () => ((await deskCall("frappe.client.get_list", { doctype: "Letter Head", filters: { disabled: 0 }, fields: ["name", "is_default"], limit_page_length: 100 })).env.message as Array<{ name: string; is_default?: number }>) ?? [],
  });

  // Desk default: the DocType's default_print_format, else Standard; default letterhead
  const [format, setFormat] = useState<string | null>(null);
  const [letterhead, setLetterhead] = useState<string | null>(null);
  const remembered = useSyncExternalStore(noSubscribe, () => readPick(doctype), () => null);
  // print.js set_default_print_format: keep the picked format while it is one of the DocType's formats,
  // else the DocType's default_print_format, else Standard
  const usable = (f: string | null | undefined) => !!f && (f === "Standard" || formats.some((x) => x.name === f));
  const fallback = String((meta as { default_print_format?: string } | undefined)?.default_print_format || "") || "Standard";
  const fmt = format ?? (usable(remembered) ? remembered! : fallback);
  const pick = (f: string) => {
    setFormat(f);
    savePick(doctype, f);
  };
  const lh = letterhead ?? letterheads.find((l) => l.is_default)?.name ?? "";

  const { data, isFetching, error } = useQuery({
    queryKey: ["print-html", doctype, name, fmt, lh],
    // wait for the format list so a remembered format is checked before the first render
    enabled: !!meta && formatsReady,
    // rendered fresh each time print opens: the format may have been edited in the builder since
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { env } = await deskCall("frappe.www.printview.get_html_and_style", { doc: doctype, name, print_format: fmt, no_letterhead: lh ? 0 : 1, letterhead: lh || undefined });
      return env.message as { html: string; style?: string };
    },
  });

  // full document for the sandboxed preview; relative /files and /assets resolve against Crema
  const srcDoc = useMemo(
    () =>
      data
        ? `<!doctype html><html><head><meta charset="utf-8"><base href="${typeof window !== "undefined" ? window.location.origin : ""}/"><style>body{margin:0;padding:24px;background:#fff;color:#111} ${data.style ?? ""}</style></head><body>${data.html}</body></html>`
        : "",
    [data],
  );

  const pdfHref = `/api/frappe/api/method/frappe.utils.print_format.download_pdf?${new URLSearchParams({ doctype, name, format: fmt, no_letterhead: lh ? "0" : "1", ...(lh ? { letterhead: lh } : {}) })}`;

  // fetch first so a server failure (e.g. a format whose PDF generator isn't installed) shows its message
  const [pdfBusy, setPdfBusy] = useState(false);
  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const res = await fetch(pdfHref, { credentials: "include" });
      if (!res.ok || !res.headers.get("content-type")?.includes("pdf")) {
        const env = await res.json().catch(() => ({}));
        throw new Error(frappeErrorMessage(env, parseServerMessages((env as { _server_messages?: string })._server_messages), res.status));
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      toast.error(e instanceof Error ? `PDF failed: ${e.message}` : "PDF failed", { duration: 10000 });
    } finally {
      setPdfBusy(false);
    }
  };

  // Ctrl/⌘+P prints the preview, not the app chrome (Desk does the same on the print page)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        frame.current?.contentWindow?.print();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
        <Link href={`${doctypeUrl(doctype)}/${enc(name)}`} className="inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {name}
        </Link>
        <h1 className="sr-only">
          Print {doctype} {name}
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select aria-label="Print format" value={fmt} onChange={(e) => pick(e.target.value)} className={sel}>
            <option>Standard</option>
            {formats.filter((f) => f.name !== "Standard").map((f) => (
              <option key={f.name}>{f.name}</option>
            ))}
          </select>
          <select aria-label="Letter head" value={lh} onChange={(e) => setLetterhead(e.target.value)} className={sel}>
            <option value="">No Letter Head</option>
            {letterheads.map((l) => (
              <option key={l.name}>{l.name}</option>
            ))}
          </select>
          <button type="button" onClick={() => void downloadPdf()} disabled={pdfBusy} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-3 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />} PDF
          </button>
          <button type="button" onClick={() => frame.current?.contentWindow?.print()} disabled={!data} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
            <Printer className="h-4 w-4" aria-hidden /> Print
          </button>
        </div>
      </div>
      <DraftNotice format={fmt} />
      <div className="relative flex-1 overflow-auto bg-zinc-100 p-6 dark:bg-zinc-900">
        {isFetching && (
          <div className="absolute right-6 top-6 flex items-center gap-2 text-xs text-zinc-500" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Rendering…
          </div>
        )}
        {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}
        {srcDoc && (
          <iframe
            ref={frame}
            title={`Print preview of ${name}`}
            srcDoc={srcDoc}
            // same-origin so the parent can call print(); no scripts run inside
            sandbox="allow-same-origin allow-modals"
            className="mx-auto block h-[calc(100%-1rem)] min-h-[60vh] w-full max-w-[210mm] rounded bg-white shadow-lg"
          />
        )}
      </div>
    </div>
  );
}
