import ReportView from "@/components/views/ReportView";
import { safeDecode } from "@/lib/utils/safeDecode";

interface Props {
  params: Promise<{ doctype: string; report: string }>;
}

/** Saved Report Builder report (Desk: /app/<doctype>/view/report/<name>) */
export default async function SavedReportPage({ params }: Props) {
  const { doctype, report } = await params;
  const d = safeDecode(doctype);
  const r = safeDecode(report);
  return <ReportView key={`${d}|${r}`} doctype={d} reportName={r} />;
}
