"use client";

import TextEditorField from "./TextEditorField";
import type { FieldControlProps } from "@/lib/crema-form/controls";

const hasContent = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() !== "" || html.includes("<img");

/**
 * Comment control (Desk form/controls/comment.js, a Text Editor): used in dialogs. The "Comment" button shows once
 * there is text (update_state) and, like Ctrl+Enter, submits — the dialog hands the value to the control's
 * on_submit (see DialogHost).
 */
export default function CommentField(props: FieldControlProps) {
  const { field, value, onClick, disabled } = props;
  const html = typeof value === "string" ? value : "";
  const ready = hasContent(html);
  return (
    // the editor is the interactive element; this group only listens for Ctrl+Enter bubbling up from it
    <div
      role="group"
      aria-label={field.label || "Comment"}
      className="flex flex-col gap-2"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && ready) {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <TextEditorField {...props} field={{ ...field, placeholder: field.placeholder || "Type a reply / comment" }} />
      {ready && !disabled && (
        <button
          type="button"
          onClick={onClick}
          className="self-start rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Comment
        </button>
      )}
    </div>
  );
}
