import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Assignments | Trevo",
    description: "Tasks assigned to users",
  };
}

import { SystemDoctypeList } from "@/components/features/system";

export default function AssignmentsPage() {
  return (
    <SystemDoctypeList
      doctype="ToDo"
      title="Assignments"
      description="Tasks assigned to users (ToDo documents)."
      columns={[
        { fieldname: "name", label: "Subject" },
        { fieldname: "status", label: "Status", render: (r) => <StatusBadge status={String(r.status ?? "Open")} /> },
        { fieldname: "allocated_to", label: "Assigned To" },
        { fieldname: "date", label: "Due Date", render: (r) => formatDate(r.date) },
      ]}
      viewHref={(name) => `/desk/doctype/ToDo/${encodeURIComponent(name)}`}
      emptyMessage="No assignments found."
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Closed"
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : status === "Cancelled"
        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {status}
    </span>
  );
}

function formatDate(v: unknown): string {
  if (!v) return "-";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

