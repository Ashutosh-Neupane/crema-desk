import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Server Scripts | Trevo",
    description: "Extend server-side behavior with Python scripts",
  };
}

import { SystemDoctypeList } from "@/components/features/system";

export default function ServerScriptsPage() {
  return (
    <SystemDoctypeList
      doctype="Server Script"
      title="Server Scripts"
      description="Extend server-side behavior with Python scripts."
      columns={[
        { fieldname: "name", label: "Name" },
        { fieldname: "script_type", label: "Type" },
        { fieldname: "disabled", label: "Status", render: (r) => formatDisabled(r.disabled) },
        { fieldname: "modified", label: "Modified", render: (r) => formatDate(r.modified) },
      ]}
      viewHref={(name) => `/desk/doctype/Server Script/${encodeURIComponent(name)}`}
      emptyMessage="No server scripts found."
    />
  );
}

function formatDisabled(v: unknown): React.ReactNode {
  return v === true || v === 1 ? (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
      Disabled
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
      Enabled
    </span>
  );
}

function formatDate(v: unknown): string {
  if (!v) return "-";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

