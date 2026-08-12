import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Users | Trevo",
    description: "Manage users who can access this Frappe instance",
  };
}

import { SystemDoctypeList } from "@/components/features/system";

export default function UsersPage() {
  return (
    <SystemDoctypeList
      doctype="User"
      title="Users"
      description="Manage users who can access this Frappe instance."
      columns={[
        { fieldname: "name", label: "Email" },
        { fieldname: "full_name", label: "Full Name" },
        { fieldname: "enabled", label: "Status", render: (r) => formatEnabled(r.enabled) },
        { fieldname: "last_login", label: "Last Login", render: (r) => formatDate(r.last_login) },
      ]}
      viewHref={(name) => `/desk/doctype/User/${encodeURIComponent(name)}`}
      emptyMessage="No users found."
    />
  );
}

function formatEnabled(v: unknown): React.ReactNode {
  const enabled = v === true || v === 1;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        enabled
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      }`}
    >
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

function formatDate(v: unknown): string {
  if (!v) return "-";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

