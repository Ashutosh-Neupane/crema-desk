"use client";

import { useEffect, useRef } from "react";
import type QuillType from "quill";
import "quill/dist/quill.snow.css";
import { sanitizeHtml } from "@/lib/report/columns";
import { editorValue, isEmptyHtml, loadQuill, TABLE_LABELS, TOOL_LABELS, TOOLBAR } from "@/lib/crema-form/quill";
import type { FieldControlProps } from "./index";

/**
 * Text Editor field (Desk: form/controls/text_editor.js) — Quill 2 with Desk's toolbar (text style, size, colours,
 * quote / code, direction, link, image, lists incl. checklist, align, indent, table), so the saved HTML is what
 * Desk writes and reads. Images are stored inline (data URL) and Frappe turns them into File records on save
 * (extract_images_from_doc). Pasted content goes through Quill's clipboard (Word / web markup cleaned up).
 * In a grid there is no toolbar (Desk: grid_row → theme null). Read-only shows the HTML (Desk `.ql-editor.read-mode`).
 * Mentions are not on: Desk enables them only for the comment box (enable_mentions), which Crema's timeline has.
 * The value is written back only when the user edits, never on mount, so opening a form doesn't make it dirty.
 */
export default function TextEditorField({ field, inputId, value, onChange, disabled, error, compact }: FieldControlProps) {
  const html = typeof value === "string" ? value : value == null ? "" : String(value);
  const readOnly = disabled || !!field.read_only;

  if (readOnly) {
    if (isEmptyHtml(html)) return <div id={inputId ?? field.fieldname} className="text-sm text-zinc-400">—</div>;
    return (
      <div
        id={inputId ?? field.fieldname}
        role="document"
        aria-label={field.label || field.fieldname}
        className="crema-rich rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      />
    );
  }
  return <QuillBox html={html} onChange={onChange} field={field} inputId={inputId} error={error} compact={compact} />;
}

function QuillBox({ html, onChange, field, inputId, error, compact }: { html: string; onChange: (v: unknown) => void; field: FieldControlProps["field"]; inputId?: string; error?: string; compact?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const quill = useRef<QuillType | null>(null);
  // the value the editor holds (loaded or last emitted): an incoming value equal to it is our own echo
  const last = useRef(html);
  const latest = useRef({ html, onChange });
  useEffect(() => {
    latest.current = { html, onChange };
  });
  const label = field.label || field.fieldname;
  const maxHeight = typeof field.max_height === "string" && field.max_height ? field.max_height : undefined;

  // q.on listeners belong to the editor; the cleanup empties the host, which drops the editor with them
  // react-doctor-disable-next-line effect-needs-cleanup
  useEffect(() => {
    let dead = false;
    const el = host.current;
    void loadQuill().then((Quill) => {
      if (dead || !el) return;
      const box = document.createElement("div");
      el.appendChild(box);
      const q = new Quill(box, {
        theme: compact ? undefined : "snow",
        placeholder: String(field.placeholder || "Type something..."),
        bounds: el,
        modules: {
          toolbar: compact
            ? false
            : {
                container: TOOLBAR,
                handlers: {
                  // text_editor.js handle_table_actions
                  table(this: unknown, value: string) {
                    const t = q.getModule("table") as Record<string, (...a: number[]) => void>;
                    const fn = {
                      "insert-table": () => t.insertTable(2, 2),
                      "insert-row-above": () => t.insertRowAbove(),
                      "insert-row-below": () => t.insertRowBelow(),
                      "insert-column-left": () => t.insertColumnLeft(),
                      "insert-column-right": () => t.insertColumnRight(),
                      "delete-row": () => t.deleteRow(),
                      "delete-column": () => t.deleteColumn(),
                      "delete-table": () => t.deleteTable(),
                    }[value];
                    fn?.();
                    if (value !== "delete-row") t.balanceTables?.();
                  },
                },
              },
          table: true,
        },
      });
      const start = latest.current.html;
      last.current = start;
      if (start) q.setContents(q.clipboard.convert({ html: start, text: "" }), "silent");
      q.history.clear();
      // Crema: pasted <script> / <style> contents are dropped (Quill would keep their text; Desk strips the tags on parse)
      const Delta = Quill.import("delta") as new () => unknown;
      for (const tag of ["SCRIPT", "STYLE"]) q.clipboard.addMatcher(tag, () => new Delta() as never);

      const root = q.root;
      if (inputId ?? field.fieldname) root.id = inputId ?? field.fieldname;
      root.setAttribute("role", "textbox");
      root.setAttribute("aria-multiline", "true");
      root.setAttribute("aria-label", label);
      if (field.reqd) root.setAttribute("aria-required", "true");
      if (maxHeight) Object.assign(box.style, { maxHeight, overflow: "auto" });

      const bar = (q.getModule("toolbar") as { container?: HTMLElement } | undefined)?.container;
      if (bar) {
        bar.setAttribute("role", "toolbar");
        bar.setAttribute("aria-label", `${label} formatting`);
        for (const [sel, text] of Object.entries(TOOL_LABELS)) {
          bar.querySelectorAll<HTMLElement>(sel).forEach((b) => (b.setAttribute("aria-label", text), b.setAttribute("title", text)));
        }
        bar.querySelectorAll<HTMLElement>(".ql-table .ql-picker-item").forEach((i) => {
          const t = TABLE_LABELS[i.dataset.value ?? ""] ?? "";
          i.setAttribute("data-label", t);
          i.setAttribute("aria-label", t);
        });
      }

      q.on("text-change", (_d, _o, source) => {
        if (source !== "user") return;
        const v = isEmptyHtml(q.root.innerHTML) ? "" : editorValue(q.root);
        if (v === last.current) return;
        last.current = v;
        latest.current.onChange(v);
      });
      quill.current = q;
    });
    return () => {
      dead = true;
      quill.current = null;
      el?.replaceChildren();
    };
    // the editor is built once per mount (and again when it moves in or out of a grid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);

  // a value set from outside (script set_value, reload, undo of the form) replaces the content (set_formatted_input)
  useEffect(() => {
    const q = quill.current;
    if (!q || html === last.current) return;
    last.current = html;
    if (!html) q.setText("", "silent");
    else q.setContents(q.clipboard.convert({ html, text: "" }), "silent");
  }, [html]);

  useEffect(() => {
    quill.current?.root.setAttribute("aria-invalid", error ? "true" : "false");
  }, [error]);

  return (
    <div
      ref={host}
      data-fieldname={field.fieldname}
      className={`crema-quill rounded-lg border bg-white transition-colors focus-within:border-zinc-900 focus-within:ring-2 focus-within:ring-zinc-900/20 dark:bg-zinc-950 dark:focus-within:border-zinc-500 ${error ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"} ${compact ? "crema-quill-compact" : ""}`}
    />
  );
}
