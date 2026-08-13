import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Desktop Layout | Trevo",
    description: "Manage desk home layout",
  };
}

import { SystemDoctypeList } from "@/components/features/system";

export default function DesktopLayoutPage() {
  return (
    <SystemDoctypeList
      doctype="Desktop Layout"
      title="Desktop Layout"
      description="Layout configuration for the desk home."
      columns={[
        { fieldname: "name", label: "Name" },
        { fieldname: "columns", label: "Columns" },
      ]}
      viewHref={(name) => `/desk/doctype/Desktop Layout/${encodeURIComponent(name)}`}
      emptyMessage="No desktop layouts found."
    />
  );
}
