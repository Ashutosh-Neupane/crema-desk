import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Custom HTML Blocks | Trevo",
    description: "Manage custom HTML blocks",
  };
}

import { SystemDoctypeList } from "@/components/features/system";

export default function CustomHtmlBlockPage() {
  return (
    <SystemDoctypeList
      doctype="Custom HTML Block"
      title="Custom HTML Blocks"
      description="Reusable HTML snippets for workspaces and pages."
      columns={[
        { fieldname: "name", label: "Name" },
        { fieldname: "html", label: "HTML", render: (r) => (typeof r.html === "string" ? r.html.slice(0, 80) + "..." : "") },
      ]}
      viewHref={(name) => `/desk/doctype/Custom HTML Block/${encodeURIComponent(name)}`}
      emptyMessage="No custom HTML blocks found."
    />
  );
}
