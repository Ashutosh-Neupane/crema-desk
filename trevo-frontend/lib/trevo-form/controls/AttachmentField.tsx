"use client";

/**
 * Attach / Attach Image (Desk: ControlAttach + FileUploader). The value is one file URL.
 * Upload goes to upload_file attached to this document (doctype/docname/fieldname); on an
 * unsaved doc the file is uploaded loose and Frappe attaches it on save
 * (File.attach_files_to_document). Drop, pick or paste a URL; preview for images.
 */
import { useRef, useState } from "react";
import { FileUp, Link2, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import type { FieldControlProps } from "./index";
import { fileNameFromUrl, isImageUrl, uploadFile } from "@/lib/frappe/upload";

export default function AttachmentField({ field, value, onChange, disabled, doc, inputId }: FieldControlProps) {
  const url = typeof value === "string" ? value : "";
  const image = field.fieldtype === "Attach Image";
  const [progress, setProgress] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [link, setLink] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const saved = doc && doc.name && !doc.__islocal && !String(doc.name).startsWith("new-");
  const upload = async (file: File) => {
    if (image && !file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setProgress(0);
    try {
      const r = await uploadFile(file, {
        doctype: saved ? String(doc!.doctype ?? "") : undefined,
        docname: saved ? String(doc!.name) : undefined,
        fieldname: saved ? field.fieldname : undefined,
        // Desk's uploader defaults to private; images shown on the web are usually public
        is_private: !image,
        onProgress: setProgress,
      });
      onChange(r.file_url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed", { duration: 8000 });
    } finally {
      setProgress(null);
    }
  };

  if (url) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
        {isImageUrl(url) ? (
          // eslint-disable-next-line @next/next/no-img-element -- served by the Frappe file proxy at runtime
          <img src={url} alt={String(field.label ?? field.fieldname)} className="h-12 w-12 shrink-0 rounded-md border border-zinc-200 object-cover dark:border-zinc-700" />
        ) : (
          <Paperclip className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
        )}
        <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm text-zinc-800 hover:underline dark:text-zinc-200">
          {fileNameFromUrl(url)}
        </a>
        {!disabled && (
          <button type="button" onClick={() => onChange("")} aria-label={`Clear ${field.label ?? field.fieldname}`} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800">
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  if (disabled) return <div className="text-sm text-zinc-400">—</div>;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void upload(f);
      }}
      className={`rounded-lg border border-dashed px-3 py-2.5 text-sm transition-colors ${drag ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30" : "border-zinc-300 dark:border-zinc-700"}`}
    >
      {progress !== null ? (
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Uploading… {progress}%
        </div>
      ) : linkMode ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && link.trim()) onChange(link.trim());
              if (e.key === "Escape") setLinkMode(false);
            }}
            placeholder="https://… or /files/…"
            aria-label="File URL"
            className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button type="button" disabled={!link.trim()} onClick={() => onChange(link.trim())} className="rounded-md bg-zinc-900 px-3 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
            Set
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 font-medium text-zinc-800 hover:underline dark:text-zinc-200">
            <FileUp className="h-4 w-4" aria-hidden /> {image ? "Upload image" : "Attach"}
          </button>
          <button type="button" onClick={() => setLinkMode(true)} className="inline-flex items-center gap-1.5 text-zinc-500 hover:underline">
            <Link2 className="h-4 w-4" aria-hidden /> Link
          </button>
          <span className="text-xs text-zinc-400">or drop a file here</span>
        </div>
      )}
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={image ? "image/*" : undefined}
        className="sr-only"
        aria-label={String(field.label ?? field.fieldname)}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
