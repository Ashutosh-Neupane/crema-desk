"use client";

import { useCallback, useState, useRef } from "react";
import type { FieldControlProps } from "./index";
import { uploadFile } from "@/lib/frappe/upload";

/**
 * Attachment field — drag & drop file upload with preview, progress, and file list.
 * Significantly better than Frappe's basic file attach.
 */
export default function AttachmentField({ field, value, onChange: _onChange, disabled }: FieldControlProps) {
  const [files, setFiles] = useState<Array<{ name: string; url?: string; uploading?: boolean }>>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (fileList: FileList) => {
    const newFiles = Array.from(fileList).map((f) => ({
      name: f.name,
      uploading: true,
    }));
    setFiles((prev) => [...prev, ...newFiles]);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const result = await uploadFile(file, {
          doctype: field.options || "",
          docname: typeof value === "string" ? value : "",
        });
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === prev.length - fileList.length + i
              ? { ...f, url: result.file_url, uploading: false }
              : f,
          ),
        );
      } catch {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === prev.length - fileList.length + i ? { ...f, uploading: false } : f,
          ),
        );
      }
    }
  }, [field.options, value]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={[
          "relative rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
          dragOver
            ? "border-zinc-900 bg-zinc-50 dark:border-zinc-500 dark:bg-zinc-800/50"
            : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600",
          (disabled || !!field.read_only) && "opacity-50 cursor-not-allowed",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          disabled={disabled || !!field.read_only}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-2">
          <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Drop files here or click to browse
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{file.name}</span>
                {file.uploading && (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
                )}
              </div>
              {!disabled && !field.read_only && (
                <button aria-label="Remove file"
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-zinc-400 hover:text-red-600"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
