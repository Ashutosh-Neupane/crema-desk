import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Notes | Trevo",
    description: "Quick notes and reminders stored in Frappe",
  };
}

import { SystemDoctypeList } from "@/components/features/system";

export default function NotesPage() {
  return (
    <SystemDoctypeList
      doctype="Note"
      title="Notes"
      description="Quick notes and reminders stored in Frappe."
      columns={[
        { fieldname: "name", label: "Title" },
        { fieldname: "content", label: "Content", render: (r) => <NotePreview content={r.content} /> },
        { fieldname: "public", label: "Public", render: (r) => (r.public === true || r.public === 1 ? "Yes" : "No") },
        { fieldname: "notify_on_every_login", label: "Notify on Login", render: (r) => (r.notify_on_every_login === true || r.notify_on_every_login === 1 ? "Yes" : "No") },
      ]}
      viewHref={(name) => `/desk/doctype/Note/${encodeURIComponent(name)}`}
      emptyMessage="No notes yet. Create your first note to get started."
    />
  );
}

function NotePreview({ content }: { content?: unknown }) {
  const text = typeof content === "string" ? content.replace(/<[^>]*>/g, "").slice(0, 80) : "-";
  return (
    <span className="block max-w-xs truncate text-zinc-500">
      {text}
      {typeof content === "string" && content.length > 80 ? "…" : ""}
    </span>
  );
}

