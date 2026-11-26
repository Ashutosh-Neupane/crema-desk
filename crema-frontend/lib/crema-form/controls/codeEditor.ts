/**
 * CodeMirror setup for CodeField (Desk: form/controls/code.js, markdown_editor.js): language map, autocompletions,
 * Markdown image drop, sizing and the JSON parse check.
 */
import { EditorView } from "@uiw/react-codemirror";
import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { sql } from "@codemirror/lang-sql";
import { markdown } from "@codemirror/lang-markdown";
import type { Extension } from "@codemirror/state";
import { uploadFile } from "@/lib/frappe/upload";
import type { DocField } from "@/lib/frappe/types";

/** code.js set_language language_map (Desk's option names, exact case); Golang has no CodeMirror mode here */
export const LANGUAGES: Record<string, () => Extension[]> = {
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
export function completionsFrom(source: unknown): Extension[] {
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

/** markdown_editor.js setup_image_drop: an image dropped in a Markdown Editor uploads and inserts ![](url) */
export function markdownImageDrop(setMsg: (m: string | null) => void, doc?: Record<string, unknown>): Extension {
  const doctype = doc?.doctype as string | undefined;
  const name = doc?.name as string | undefined;
  const attach = doctype && name && !doc?.__islocal ? { doctype, docname: name } : {};
  return EditorView.domEventHandlers({
    drop(e, view) {
      const files = e.dataTransfer?.files;
      if (!files?.length) return false;
      e.preventDefault();
      if (!files[0].type.includes("image")) {
        setMsg("You can only insert images in Markdown fields");
        return true;
      }
      setMsg("Uploading…");
      const at = view.posAtCoords({ x: e.clientX, y: e.clientY }) ?? view.state.selection.main.head;
      uploadFile(files[0], { folder: "Home/Attachments", ...attach })
        .then((f) => {
          view.dispatch({ changes: { from: at, insert: `![](${encodeURI(f.file_url)})` } });
          setMsg(null);
        })
        .catch((err: unknown) => setMsg(err instanceof Error ? err.message : "Upload failed"));
      return true;
    },
  });
}

/** code.js: fixed 300px with Expand (600px) unless the field sizes itself with max_lines / min_lines / max_height */
export function codeSizing(field: DocField, expanded: boolean): { sized: boolean; height?: string; minHeight?: string; maxHeight?: string } {
  const lines = (n: unknown) => (Number(n) > 0 ? `${Math.round(Number(n) * 19.5 + 8)}px` : undefined);
  if (!(field.max_lines || field.min_lines || field.max_height)) return { sized: false, height: expanded ? "600px" : "300px" };
  return {
    sized: true,
    minHeight: lines(field.min_lines),
    maxHeight: typeof field.max_height === "string" && field.max_height ? field.max_height : lines(field.max_lines),
  };
}

/** json.js: Desk saves the text; a parse error is shown and the server validates */
export function jsonParseError(fieldtype: string, text: string): string | null {
  if (fieldtype !== "JSON" || !text.trim()) return null;
  try {
    JSON.parse(text);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid JSON";
  }
}

/** Desk warns once per render about an option outside its language map */
export function warnUnknownLanguage(field: DocField, label: string) {
  const opt = languageOption(field.options, field.fieldtype);
  if (opt && !LANGUAGES[opt] && opt !== "Golang" && opt !== "Go") {
    console.warn(`Invalid language option provided for field "${label}". Valid options are ${Object.keys(LANGUAGES).join(", ")}, Golang, Go.`);
  }
}
