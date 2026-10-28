/**
 * Reports page — thin Server Component wrapper that exports metadata,
 * then delegates to the client-side ReportQueryBuilder island.
 *
 * generateMetadata must live in a Server Component (not a "use client" file).
 */
import type { Metadata } from "next";
import { ReportQueryBuilder } from "@/components/features/reports";

export const metadata: Metadata = {
  title: "Reports | Crema",
  description: "View and run reports from your Frappe installation",
};

export default function ReportsPage() {
  return <ReportQueryBuilder />;
}
