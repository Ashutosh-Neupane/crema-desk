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
import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { sql } from "@codemirror/lang-sql";
import { markdown } from "@codemirror/lang-markdown";
import type { Extension } from "@codemirror/state";
import { Check, Copy } from "lucide-react";
import { useResolvedTheme } from "@/lib/hooks/useResolvedTheme";
import { markdownToHtml } from "@/lib/frappe/markdown";
import { sanitizeHtml } from "@/lib/report/columns";
import { uploadFile } from "@/lib/frappe/upload";
import type { FieldControlProps } from "./index";

/** code.js set_language language_map (Desk's option names, exact case); Golang has no CodeMirror mode here */
const LANGUAGES: Record<string, () => Extension[]> = {
  Javascript: () => [javascript()],
  JS: () => [javascript()],
  Python: () => [python()],
  Py: () => [python()],
  PythonExpression: () => [python()],
  HTML: () => [html()],
  Jinja: () => [html()],
  CSS: () => [css()],
  SCSS: () => [css()],
  Markdown: () => [markdown()],
  JSON: () => [json()],
  SQL: () => [sql()],
};

/** the option name for a field: HTML Editor forces HTML, Markdown Editor defaults to Markdown, JSON is JSON */
export function languageOption(options: unknown, fieldtype?: string): string {
  if (fieldtype === "HTML Editor") return "HTML";
  if (fieldtype === "JSON") return "JSON";
  const o = typeof options === "string" ? options.trim() : "";
  if (fieldtype === "Markdown Editor" && !o) return "Markdown";
  return o;
}

export function languageFor(options: unknown, fieldtype?: string): Extension[] {
  return LANGUAGES[languageOption(options, fieldtype)]?.() ?? [];
}

type Completion = string | { value: string; caption?: string; meta?: string; score?: number };
type CompletionGetter = (ctx: { prefix: string }) => Completion[];

/** code.js setup_autocompletion: items (or getters) offered once a word has been started */
function completionsFrom(source: unknown): Extension[] {
  if (!source || (Array.isArray(source) && source.length === 0)) return [];
  const getters: CompletionGetter[] = (Array.isArray(source) && source.every((s) => typeof s === "function") ? source : [source]).map((g) =>
    typeof g === "function" ? (g as CompletionGetter) : () => g as Completion[],
  );
  return [
    autocompletion({
      override: [
        (ctx: CompletionContext) => {
          const word = ctx.matchBefore(/[\w.$]+/);
          if (!word || word.from === word.to) return null;
          const prefix = word.text;
          const items = getters.flatMap((g) => {
            try {
              return g({ prefix }) ?? [];
            } catch {
              return [];
            }
          });
          return {
            from: word.from,
            options: items.map((a) => (typeof a === "string" ? { label: a } : { label: a.value, displayLabel: a.caption, detail: a.meta, boost: a.score })),
            validFor: /^[\w.$]*$/,
          };
        },
      ],
    }),
  ];
}

export default function CodeField({ field, inputId, value, onChange, disabled, error, doc }: FieldControlProps) {
  const theme = useResolvedTheme();
  const text = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value, null, 4);
  const readOnly = disabled || !!field.read_only;
  const ft = field.fieldtype;
  const previewKind = ft === "Markdown Editor" ? "markdown" : ft === "HTML Editor" ? "html" : null;
  const [preview, setPreview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dropMsg, setDropMsg] = useState<string | null>(null);
  const docRef = { doctype: doc?.doctype as string | undefined, name: doc?.name as string | undefined, isNew: !!doc?.__islocal };
  const label = field.label || field.fieldname;

  const opt = languageOption(field.options, ft);
  if (opt && !LANGUAGES[opt] && opt !== "Golang" && opt !== "Go") {
    console.warn(`Invalid language option provided for field "${label}". Valid options are ${Object.keys(LANGUAGES).join(", ")}, Golang, Go.`);
  }
  const autocompletions = (field as { autocompletions?: unknown }).autocompletions;
  const wrap = !!field.wrap || !!previewKind;
  const imageDrop =
    ft === "Markdown Editor" && !readOnly
      ? [
          EditorView.domEventHandlers({
            drop(e, view) {
              const files = e.dataTransfer?.files;
              if (!files?.length) return false;
              e.preventDefault();
              if (!files[0].type.includes("image")) {
                setDropMsg("You can only insert images in Markdown fields");
                return true;
              }
              setDropMsg("Uploading…");
              const at = view.posAtCoords({ x: e.clientX, y: e.clientY }) ?? view.state.selection.main.head;
              uploadFile(files[0], { folder: "Home/Attachments", ...(docRef.doctype && docRef.name && !docRef.isNew ? { doctype: docRef.doctype, docname: docRef.name } : {}) })
                .then((f) => {
                  view.dispatch({ changes: { from: at, insert: `![](${encodeURI(f.file_url)})` } });
                  setDropMsg(null);
                })
                .catch((err: unknown) => setDropMsg(err instanceof Error ? err.message : "Upload failed"));
              return true;
            },
          }),
        ]
      : [];
  const extensions = [...languageFor(field.options, ft), ...completionsFrom(autocompletions), ...(wrap ? [EditorView.lineWrapping] : []), ...imageDrop];

  // code.js: fixed 300px with Expand (600px) unless the field sizes itself
  const lines = (n: unknown) => (Number(n) > 0 ? `${Math.round(Number(n) * 19.5 + 8)}px` : undefined);
  const sized = !!(field.max_lines || field.min_lines || field.max_height);
  const height = sized ? undefined : expanded ? "600px" : "300px";
  const minHeight = sized ? lines(field.min_lines) : undefined;
  const maxHeight = sized ? (typeof field.max_height === "string" && field.max_height ? field.max_height : lines(field.max_lines)) : undefined;

  let jsonError: string | null = null;
  if (ft === "JSON" && text.trim()) {
    try {
      JSON.parse(text);
    } catch (e) {
      jsonError = e instanceof Error ? e.message : "Invalid JSON";
    }
  }

  const previewHtml = preview ? (previewKind === "markdown" ? markdownToHtml(text) : sanitizeHtml(text)) : "";

  return (
    <div className="relative space-y-1.5" data-code-field={field.fieldname}>
      {previewKind && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {preview ? "Edit" : "Preview"}
          </button>
        </div>
      )}
      {preview ? (
        <div
          role="document"
          aria-label={`${label} preview`}
          className="crema-rich min-h-[120px] rounded-lg border border-zinc-200 px-4 py-3 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          dangerouslySetInnerHTML={{ __html: previewHtml || "<p class='text-zinc-400'>Nothing to preview</p>" }}
        />
      ) : (
        <div
          data-fieldname={field.fieldname}
          className={[
            "overflow-hidden rounded-lg border text-[13px]",
            error || jsonError ? "border-red-500" : "border-zinc-300 focus-within:border-zinc-500 dark:border-zinc-700 dark:focus-within:border-zinc-500",
            readOnly ? "opacity-90" : "",
          ].join(" ")}
        >
          <CodeMirror
            id={inputId ?? field.fieldname}
            aria-label={label}
            value={text}
            onChange={(v) => onChange(v)}
            extensions={extensions}
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
      )}
      {readOnly && ft === "Code" && text && (
        <button
          type="button"
          title="Copy to Clipboard"
          aria-label="Copy to Clipboard"
          onClick={() => void navigator.clipboard?.writeText(text).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}
          className="absolute right-2 top-2 rounded-md border border-zinc-200 bg-white p-1 text-zinc-500 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:text-zinc-200"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
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
      {!sized && !preview && (
        <button type="button" onClick={() => setExpanded((x) => !x)} className="rounded-md border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
          {expanded ? "Collapse" : "Expand"}
        </button>
      )}
    </div>
  );
}
