"use client";

/**
 * Attach / Attach Image (Desk: ControlAttach + FileUploader). The value is one file URL.
 * Upload goes to upload_file attached to this document (doctype/docname/fieldname); on an
 * unsaved doc the file is uploaded loose and Frappe attaches it on save
 * (File.attach_files_to_document). Drop, pick or paste a URL; preview for images.
 */
import { useEffect, useRef, useState } from "react";
import { FileUp, Link2, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import type { FieldControlProps } from "./index";
import { fileNameFromUrl, isImageUrl, uploadFile } from "@/lib/frappe/upload";

/** FileUploader: attached to this document when it is saved, loose otherwise (Frappe attaches it on save) */
function useAttachUpload(field: FieldControlProps["field"], doc: FieldControlProps["doc"], image: boolean, onChange: (v: unknown) => void) {
  const [progress, setProgress] = useState<number | null>(null);
  const saved = !!(doc && doc.name && !doc.__islocal && !String(doc.name).startsWith("new-"));
  const target = saved && doc ? { doctype: String(doc.doctype ?? ""), docname: String(doc.name), fieldname: field.fieldname } : {};
  const upload = async (file: File) => {
    if (image && !file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setProgress(0);
    try {
      const r = await uploadFile(file, {
        ...target,
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
  return { progress, upload };
}

function AttachedFile({ url, label, disabled, onClear }: { url: string; label: string; disabled?: boolean; onClear: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
      {isImageUrl(url) ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by the Frappe file proxy at runtime
        <img src={url} alt={label} className="h-12 w-12 shrink-0 rounded-md border border-zinc-200 object-cover dark:border-zinc-700" />
      ) : (
        <Paperclip className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
      )}
      <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm text-zinc-800 hover:underline dark:text-zinc-200">
        {fileNameFromUrl(url)}
      </a>
      {!disabled && (
        <button type="button" onClick={onClear} aria-label={`Clear ${label}`} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800">
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** "Link": paste a URL instead of uploading; the box takes focus when it opens */
function LinkEntry({ onSet, onCancel }: { onSet: (url: string) => void; onCancel: () => void }) {
  const [link, setLink] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="flex gap-2">
      <input
        ref={ref}
        value={link}
        onChange={(e) => setLink(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && link.trim()) onSet(link.trim());
          if (e.key === "Escape") onCancel();
        }}
        placeholder="https://… or /files/…"
        aria-label="File URL"
        className="h-8 flex-1 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button type="button" disabled={!link.trim()} onClick={() => onSet(link.trim())} className="rounded-md bg-zinc-900 px-3 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        Set
      </button>
    </div>
  );
}

function PickButtons({ image, onPick, onLink }: { image: boolean; onPick: () => void; onLink: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={onPick} className="inline-flex items-center gap-1.5 font-medium text-zinc-800 hover:underline dark:text-zinc-200">
        <FileUp className="h-4 w-4" aria-hidden /> {image ? "Upload image" : "Attach"}
      </button>
      <button type="button" onClick={onLink} className="inline-flex items-center gap-1.5 text-zinc-500 hover:underline">
        <Link2 className="h-4 w-4" aria-hidden /> Link
      </button>
      <span className="text-xs text-zinc-400">or drop a file here</span>
    </div>
  );
}

export default function AttachmentField({ field, value, onChange, disabled, doc, inputId }: FieldControlProps) {
  const url = typeof value === "string" ? value : "";
  const image = field.fieldtype === "Attach Image";
  const label = String(field.label ?? field.fieldname);
  const [drag, setDrag] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { progress, upload } = useAttachUpload(field, doc, image, onChange);

  if (url) return <AttachedFile url={url} label={label} disabled={disabled} onClear={() => onChange("")} />;
  if (disabled) return <div className="text-sm text-zinc-400">—</div>;

  let body;
  if (progress !== null) {
    body = (
      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Uploading… {progress}%
      </div>
    );
  } else if (linkMode) {
    body = <LinkEntry onSet={(v) => onChange(v)} onCancel={() => setLinkMode(false)} />;
  } else {
    body = <PickButtons image={image} onPick={() => input.current?.click()} onLink={() => setLinkMode(true)} />;
  }

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
      {body}
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={image ? "image/*" : undefined}
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
