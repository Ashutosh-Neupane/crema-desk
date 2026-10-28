"use client";

/**
 * Code control — Desk uses Ace; Crema uses CodeMirror 6. Language comes from
 * the field's `options` (Javascript, Python, HTML, CSS, JSON, SQL, Markdown…),
 * as in Frappe; Client/Server Script `script` fields get JS/Python.
 * Theme follows Crema's light/dark setting.
 */
import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { sql } from "@codemirror/lang-sql";
import { markdown } from "@codemirror/lang-markdown";
import type { Extension } from "@codemirror/state";
import { useResolvedTheme } from "@/lib/hooks/useResolvedTheme";
import type { FieldControlProps } from "./index";

export function languageFor(options: string | null | undefined, fieldtype?: string): Extension[] {
  const o = String(options ?? "").toLowerCase();
  if (fieldtype === "HTML Editor" || o === "html" || o === "jinja") return [html()];
  if (fieldtype === "Markdown Editor" || o === "markdown") return [markdown()];
  if (o === "python" || o === "py") return [python()];
  if (o === "css" || o === "scss" || o === "less") return [css()];
  if (o === "json") return [json()];
  if (o === "sql" || o === "mysql") return [sql()];
  if (o === "javascript" || o === "js" || o === "") return [javascript({ jsx: false })];
  return [];
}

export default function CodeField({ field, inputId, value, onChange, disabled, error, doc }: FieldControlProps) {
  const theme = useResolvedTheme();
  // Script doctypes keep the language in a sibling field (Server Script is Python, Client Script JS)
  const lang = useMemo(() => {
    let opts = field.options as string | null | undefined;
    if (!opts && doc && "script_type" in doc) opts = "Python";
    return languageFor(opts, field.fieldtype);
  }, [field.options, field.fieldtype, doc]);
  const readOnly = disabled || !!field.read_only;

  return (
    <div
      className={[
        "overflow-hidden rounded-lg border text-[13px]",
        error ? "border-red-500" : "border-zinc-300 focus-within:border-zinc-500 dark:border-zinc-700 dark:focus-within:border-zinc-500",
        readOnly ? "opacity-80" : "",
      ].join(" ")}
    >
      <CodeMirror
        id={inputId ?? field.fieldname}
        value={String(value ?? "")}
        onChange={(v) => onChange(v || null)}
        extensions={lang}
        theme={theme}
        editable={!readOnly}
        readOnly={readOnly}
        minHeight="160px"
        maxHeight="560px"
        placeholder={String(field.placeholder ?? "")}
        basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: !readOnly, autocompletion: true, tabSize: 4 }}
      />
    </div>
  );
}
