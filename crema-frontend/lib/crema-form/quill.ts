/**
 * Quill 2, set up like Desk's Text Editor (frappe/public/js/frappe/form/controls/text_editor.js, Quill 2.0.3 —
 * the version Frappe pins), so HTML written here and in Desk is the same: <pre> code blocks, <br> breaks in table
 * cells, the font-size whitelist, inline-style colour / background / font / align / direction, tables with
 * `table table-bordered`, images keeping style / align, `<div class="ql-editor read-mode">` around the value and
 * bullet lists as <ul>. Loaded on demand (only editable Text Editors need it).
 * Not ported: image resize handles (frappe-quill-image-resize), magic URLs (quill-magic-url).
 */
import type QuillType from "quill";

/** text_editor.js font_sizes (false = default) */
export const FONT_SIZES: Array<string | false> = [false, "8px", "9px", "10px", "11px", "12px", "13px", "14px", "15px", "16px", "18px", "20px", "22px", "24px", "32px", "36px", "40px", "48px", "54px", "64px", "96px", "128px"];

/** text_editor.js get_toolbar_options */
export const TOOLBAR = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ size: FONT_SIZES }],
  ["bold", "italic", "underline", "strike", "clean"],
  [{ color: [] }, { background: [] }],
  ["blockquote", "code-block"],
  [{ direction: "rtl" }],
  ["link", "image"],
  [{ list: "ordered" }, { list: "bullet" }, { list: "check" }],
  [{ align: [] }],
  [{ indent: "-1" }, { indent: "+1" }],
  [{ table: ["insert-table", "insert-row-above", "insert-row-below", "insert-column-right", "insert-column-left", "delete-row", "delete-column", "delete-table"] }],
];

/** text_editor.js add_toolbar_tooltips / dress_toolbar_pickers labels (also the buttons' accessible names) */
export const TOOL_LABELS: Record<string, string> = {
  "button.ql-bold": "Bold",
  "button.ql-italic": "Italic",
  "button.ql-underline": "Underline",
  "button.ql-strike": "Strikethrough",
  "button.ql-clean": "Clear formatting",
  "button.ql-blockquote": "Quote",
  "button.ql-code-block": "Code block",
  "button.ql-direction": "Text direction",
  "button.ql-link": "Insert link",
  "button.ql-image": "Insert image",
  'button.ql-list[value="ordered"]': "Numbered list",
  'button.ql-list[value="bullet"]': "Bullet list",
  'button.ql-list[value="check"]': "Checklist",
  'button.ql-indent[value="-1"]': "Decrease indent",
  'button.ql-indent[value="+1"]': "Increase indent",
  ".ql-header .ql-picker-label": "Text style",
  ".ql-size .ql-picker-label": "Font size",
  ".ql-color .ql-picker-label": "Text color",
  ".ql-background .ql-picker-label": "Background color",
  ".ql-align .ql-picker-label": "Align",
  ".ql-table .ql-picker-label": "Table",
};

export const TABLE_LABELS: Record<string, string> = {
  "insert-table": "Insert Table",
  "insert-row-above": "Insert Row Above",
  "insert-row-below": "Insert Row Below",
  "insert-column-right": "Insert Column Right",
  "insert-column-left": "Insert Column Left",
  "delete-row": "Delete Row",
  "delete-column": "Delete Column",
  "delete-table": "Delete Table",
};

let loading: Promise<typeof QuillType> | null = null;

export function loadQuill(): Promise<typeof QuillType> {
  loading ??= import("quill").then(({ default: Quill }) => {
    const CodeBlockContainer = Quill.import("formats/code-block-container") as { tagName: string };
    CodeBlockContainer.tagName = "PRE";
    Quill.register(CodeBlockContainer as never, true);

    const Embed = Quill.import("blots/embed") as new (...a: never[]) => object;
    class BreakBlot extends Embed {
      static blotName = "Break";
      static tagName = "br";
    }
    Quill.register(BreakBlot as never);

    const Size = Quill.import("attributors/style/size") as { whitelist: unknown[] };
    Size.whitelist = FONT_SIZES;
    Quill.register(Size as never, true);
    for (const a of ["attributors/style/background", "attributors/style/color", "attributors/style/font", "attributors/style/align", "attributors/style/direction", "attributors/class/direction"]) {
      Quill.register(Quill.import(a) as never, true);
    }

    const Table = Quill.import("formats/table-container") as { create: (v: unknown) => HTMLElement };
    const superCreate = Table.create.bind(Table);
    Table.create = (value: unknown) => {
      const node = superCreate(value);
      node.classList.add("table", "table-bordered");
      return node;
    };
    Quill.register(Table as never, true);

    // images keep style / align (text_editor.js MyImage)
    const Image = Quill.import("formats/image") as unknown as {
      new (...a: never[]): object;
      create(v: unknown): HTMLElement;
    };
    class CremaImage extends Image {
      static create(value: unknown) {
        const node = super.create(value);
        if (value && typeof value === "object") {
          for (const a of ["style", "align", "src"]) {
            const v = (value as Record<string, string>)[a];
            if (v) node.setAttribute(a, v);
          }
        }
        return node;
      }
      static value(node: HTMLImageElement) {
        return { align: node.getAttribute("align") ?? undefined, style: node.style.cssText, src: node.getAttribute("src") };
      }
    }
    Quill.register(CremaImage as never, true);
    return Quill;
  });
  return loading;
}

/** text_editor.js patch_unordered_list: Quill writes bullets as <ol><li data-list="bullet">; Desk saves <ul> */
function patchUnorderedList(html: string): string {
  const el = document.createElement("div");
  el.innerHTML = html;
  el.querySelectorAll("ol > li[data-list=bullet]:first-child").forEach((li) => {
    const ol = li.parentNode as HTMLElement;
    const ul = document.createElement("ul");
    for (const child of Array.from(ol.children)) ul.appendChild(child);
    ol.replaceWith(ul);
  });
  return el.innerHTML;
}

/** text_editor.js get_input_value */
export function editorValue(root: HTMLElement): string {
  let value = root.innerHTML.replace(/(\s)(\s)/g, " &nbsp;");
  value = patchUnorderedList(value);
  if (!/class="[^"]*\bql-editor\b/.test(value)) value = `<div class="ql-editor read-mode">${value}</div>`;
  return value;
}

/** Quill leaves `<p><br></p>` for an empty editor; Desk treats that as empty */
export const isEmptyHtml = (html: string) => !html.replace(/<(p|div|br|span)[^>]*>|<\/(p|div|span)>|&nbsp;|\s/gi, "") && !/<(img|table|hr|iframe)\b/i.test(html);
