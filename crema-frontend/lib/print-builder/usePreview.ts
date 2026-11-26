"use client";

/**
 * The Print Format Builder's server rendering of the unsaved draft (docs/GAPS.md § 2.19 B): the HTML preview
 * (`render_builder_preview`) and the PDF download (`download_builder_preview_pdf`, Desk's builder "Download PDF").
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { deskCall } from "@/lib/frappe/form";

const PF_GEN = "frappe.utils.print_format_generator.";
type PreviewArgs = Record<string, unknown> & { name: unknown };

/** POST the draft to the PDF endpoint and save what comes back */
async function fetchPdf(args: PreviewArgs, fileName: string) {
  const res = await fetch(`/api/frappe/api/method/${PF_GEN}download_builder_preview_pdf`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("pdf")) {
    const env = (await res.json().catch(() => ({}))) as { exception?: string; exc_type?: string };
    const msg = env.exception?.split("\n")[0] || `PDF failed (${res.status})`;
    // builder formats print through the server's Chromium (also when "wkhtmltopdf" is picked, print_format_generator
    // render_pdf); in containers it often can't start for missing system libraries such as libnss3
    throw new Error(/Chromium/i.test(msg) ? `${msg} The server's PDF renderer (Chromium) isn't working — ask your administrator.` : msg);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function usePreview({ name, active, previewArgs }: { name: string; active: boolean; previewArgs: () => PreviewArgs | null }) {
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const renderPreview = useCallback(async () => {
    const args = previewArgs();
    if (!args) {
      setPreviewHtml(null);
      return;
    }
    setPreviewBusy(true);
    try {
      const { env } = await deskCall(`${PF_GEN}render_builder_preview`, args);
      setPreviewHtml(typeof env.message === "string" ? env.message : "");
    } catch (e) {
      setPreviewHtml(null);
      toast.error(e instanceof Error ? e.message : "Could not render the preview");
    } finally {
      setPreviewBusy(false);
    }
  }, [previewArgs]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async render; the HTML is set after the await
    if (active) void renderPreview();
  }, [active, renderPreview]);

  /** the draft as a PDF, through the format's own PDF renderer */
  const downloadPdf = async () => {
    const args = previewArgs();
    if (!args) return;
    setPdfBusy(true);
    try {
      await fetchPdf(args, `${name} - ${String(args.name)}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not make the PDF");
    } finally {
      setPdfBusy(false);
    }
  };

  return { previewHtml, previewBusy, pdfBusy, downloadPdf };
}
