import { Suspense } from "react";
import ReportView from "@/components/views/ReportView";
import { safeDecode } from "@/lib/utils/safeDecode";

interface Props {
  params: Promise<{ doctype: string }>;
}

export default async function ReportViewPage({ params }: Props) {
  const { doctype } = await params;
  const d = safeDecode(doctype);
  return (
    <Suspense>
      <ReportView key={d} doctype={d} />
    </Suspense>
  );
}
