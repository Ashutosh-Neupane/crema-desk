"use client";

/**
 * Code, HTML Editor, Markdown Editor and JSON controls (Desk: form/controls/code.js, html_editor.js,
 * markdown_editor.js, json.js). Desk uses Ace; Crema uses CodeMirror 6 with Desk's behaviour:
 *  - language from `options` with Desk's map (no / unknown options → plain text); HTML Editor → HTML,
 *    Markdown Editor → Markdown (unless options say otherwise), JSON → JSON
 *  - 300px tall with Expand / Collapse (600px), unless the field sets max_lines / min_lines / max_height
 *  - `wrap`; Markdown and HTML editors wrap and have Preview / Edit (markdown via frappe.markdown, HTML with
 *    script / style removed)
 *  - read-only Code shows Copy to Clipboard
 *  - df.autocompletions (set_df_property(f, "autocompletions", items | fn) — Server Script, System Console)
 *  - Markdown Editor: dropping an image uploads it and inserts ![](url) (markdown_editor.js setup_image_drop)
 * The value is the text as typed (JSON too: Desk saves the text; a parse error is shown, the server validates).
 */
import { useState } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { Check, Copy } from "lucide-react";
import { useResolvedTheme } from "@/lib/hooks/useResolvedTheme";
import { markdownToHtml } from "@/lib/frappe/markdown";
import { sanitizeHtml } from "@/lib/report/columns";
import type { FieldControlProps } from "./index";
import { codeSizing, completionsFrom, jsonParseError, languageFor, markdownImageDrop, warnUnknownLanguage } from "./codeEditor";

const SMALL_BUTTON =
  "rounded-md border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

/** read-only Code: Copy to Clipboard (code.js) */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard refused (permissions / insecure context): nothing to show
    }
  };
  return (
    <button
      type="button"
      title="Copy to Clipboard"
      aria-label="Copy to Clipboard"
      onClick={() => void copy()}
      className="absolute right-2 top-2 rounded-md border border-zinc-200 bg-white p-1 text-zinc-500 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:text-zinc-200"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** Markdown / HTML Editor preview: markdown via frappe.markdown, HTML with script / style removed */
function CodePreview({ kind, text, label }: { kind: "markdown" | "html"; text: string; label: string }) {
  const previewHtml = kind === "markdown" ? markdownToHtml(text) : sanitizeHtml(text);
  return (
    <div
      role="document"
      aria-label={`${label} preview`}
      className="crema-rich min-h-[120px] rounded-lg border border-zinc-200 px-4 py-3 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
      dangerouslySetInnerHTML={{ __html: previewHtml || "<p class='text-zinc-400'>Nothing to preview</p>" }}
    />
  );
}

function previewKindOf(fieldtype: string): "markdown" | "html" | null {
  if (fieldtype === "Markdown Editor") return "markdown";
  if (fieldtype === "HTML Editor") return "html";
  return null;
}

function codeText(value: unknown): string {
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value, null, 4);
}

function StatusLines({ dropMsg, jsonError }: { dropMsg: string | null; jsonError: string | null }) {
  return (
    <>
      {dropMsg && (
        <p role="status" className="text-xs text-zinc-500">
          {dropMsg}
        </p>
      )}
      {jsonError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          Invalid JSON: {jsonError}
        </p>
      )}
    </>
  );
}

// the editor's language, completions, wrapping and (Markdown) image drop for this field
function codeExtensions(field: FieldControlProps["field"], readOnly: boolean, wrap: boolean, onDropMsg: (m: string | null) => void, doc: FieldControlProps["doc"]) {
  const ft = field.fieldtype;
  const autocompletions = (field as { autocompletions?: unknown }).autocompletions;
  return [
    ...languageFor(field.options, ft),
    ...completionsFrom(autocompletions),
    ...(wrap ? [EditorView.lineWrapping] : []),
    ...(ft === "Markdown Editor" && !readOnly ? [markdownImageDrop(onDropMsg, doc)] : []),
  ];
}

function editorClass(invalid: boolean, readOnly: boolean) {
  return [
    "overflow-hidden rounded-lg border text-[13px]",
    invalid ? "border-red-500" : "border-zinc-300 focus-within:border-zinc-500 dark:border-zinc-700 dark:focus-within:border-zinc-500",
    readOnly ? "opacity-90" : "",
  ].join(" ");
}

function PreviewToggle({ preview, onToggle }: { preview: boolean; onToggle: () => void }) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onToggle}
        className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {preview ? "Edit" : "Preview"}
      </button>
    </div>
  );
}

type EditorProps = Pick<FieldControlProps, "field" | "inputId" | "onChange" | "doc"> & {
  text: string;
  readOnly: boolean;
  invalid: boolean;
  wrap: boolean;
  expanded: boolean;
  onDropMsg: (m: string | null) => void;
};

function CodeEditor({ field, inputId, onChange, doc, text, readOnly, invalid, wrap, expanded, onDropMsg }: EditorProps) {
  const theme = useResolvedTheme();
  const label = field.label || field.fieldname;
  const { height, minHeight, maxHeight } = codeSizing(field, expanded);
  return (
    <div data-fieldname={field.fieldname} className={editorClass(invalid, readOnly)}>
      <CodeMirror
        id={inputId ?? field.fieldname}
        aria-label={label}
        value={text}
        onChange={(v) => onChange(v)}
        extensions={codeExtensions(field, readOnly, wrap, onDropMsg, doc)}
        theme={theme}
        editable={!readOnly}
        readOnly={readOnly}
        height={height}
        minHeight={minHeight}
        maxHeight={maxHeight}
        placeholder={String(field.placeholder ?? "")}
        basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: !readOnly, autocompletion: true, tabSize: 4 }}
      />
    </div>
  );
}

export default function CodeField({ field, inputId, value, onChange, disabled, error, doc }: FieldControlProps) {
  const text = codeText(value);
  const readOnly = disabled || !!field.read_only;
  const ft = field.fieldtype;
  const previewKind = previewKindOf(ft);
  const [preview, setPreview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dropMsg, setDropMsg] = useState<string | null>(null);
  const label = field.label || field.fieldname;

  warnUnknownLanguage(field, label);
  const { sized } = codeSizing(field, expanded);
  const jsonError = jsonParseError(ft, text);
  const showPreview = preview && !!previewKind;
  const canCopy = readOnly && ft === "Code" && !!text;

  return (
    <div className="relative space-y-1.5" data-code-field={field.fieldname}>
      {previewKind && <PreviewToggle preview={preview} onToggle={() => setPreview((p) => !p)} />}
      {showPreview ? (
        <CodePreview kind={previewKind} text={text} label={label} />
      ) : (
        <CodeEditor
          field={field}
          inputId={inputId}
          onChange={onChange}
          doc={doc}
          text={text}
          readOnly={readOnly}
          invalid={!!(error || jsonError)}
          wrap={!!field.wrap || !!previewKind}
          expanded={expanded}
          onDropMsg={setDropMsg}
        />
      )}
      {canCopy && <CopyButton text={text} />}
      <StatusLines dropMsg={dropMsg} jsonError={jsonError} />
      {!sized && !preview && (
        <button type="button" onClick={() => setExpanded((x) => !x)} className={SMALL_BUTTON}>
          {expanded ? "Collapse" : "Expand"}
        </button>
      )}
    </div>
  );
}
