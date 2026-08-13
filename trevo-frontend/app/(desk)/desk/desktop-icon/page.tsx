import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Desktop Icons | Trevo",
    description: "Manage desk desktop icons",
  };
}

import { SystemDoctypeList } from "@/components/features/system";

export default function DesktopIconPage() {
  return (
    <SystemDoctypeList
      doctype="Desktop Icon"
      title="Desktop Icons"
      description="Icons shown on the desk home page."
      columns={[
        { fieldname: "name", label: "Name" },
        { fieldname: "label", label: "Label" },
        { fieldname: "module", label: "Module" },
        { fieldname: "hidden", label: "Hidden", render: (r) => (r.hidden ? "Yes" : "No") },
      ]}
      viewHref={(name) => `/desk/doctype/Desktop Icon/${encodeURIComponent(name)}`}
      emptyMessage="No desktop icons found."
    />
  );
}
