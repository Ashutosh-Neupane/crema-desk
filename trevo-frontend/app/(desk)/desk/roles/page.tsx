import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Roles | Trevo",
    description: "Manage user roles and permission profiles",
  };
}

import { SystemDoctypeList } from "@/components/features/system";

export default function RolesPage() {
  return (
    <SystemDoctypeList
      doctype="Role"
      title="Roles"
      description="Manage user roles and permission profiles."
      columns={[
        { fieldname: "name", label: "Role Name" },
        { fieldname: "desk_access", label: "Desk Access", render: (r) => formatYesNo(r.desk_access) },
        { fieldname: "disabled", label: "Status", render: (r) => formatDisabled(r.disabled) },
        { fieldname: "modified", label: "Modified", render: (r) => formatDate(r.modified) },
      ]}
      viewHref={(name) => `/desk/doctype/Role/${encodeURIComponent(name)}`}
      emptyMessage="No roles found."
    />
  );
}

function formatYesNo(v: unknown): React.ReactNode {
  return v === true || v === 1 ? (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
      Yes
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
      No
    </span>
  );
}

function formatDisabled(v: unknown): React.ReactNode {
  return v === true || v === 1 ? (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
      Disabled
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
      Active
    </span>
  );
}

function formatDate(v: unknown): string {
  if (!v) return "-";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

