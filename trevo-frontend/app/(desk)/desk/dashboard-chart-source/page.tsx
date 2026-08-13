import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Dashboard Chart Sources | Trevo",
    description: "Manage dashboard chart data sources",
  };
}

import { SystemDoctypeList } from "@/components/features/system";

export default function DashboardChartSourcePage() {
  return (
    <SystemDoctypeList
      doctype="Dashboard Chart Source"
      title="Dashboard Chart Sources"
      description="Data source configurations for dashboard charts."
      columns={[
        { fieldname: "name", label: "Name" },
        { fieldname: "source_name", label: "Source" },
        { fieldname: "modified", label: "Modified" },
      ]}
      viewHref={(name) => `/desk/doctype/Dashboard Chart Source/${encodeURIComponent(name)}`}
      emptyMessage="No dashboard chart sources found."
    />
  );
}
