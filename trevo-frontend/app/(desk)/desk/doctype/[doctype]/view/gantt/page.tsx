import GanttView from "@/components/views/GanttView";
import { safeDecode } from "@/lib/utils/safeDecode";

interface Props {
  params: Promise<{ doctype: string }>;
}

/** Desk: /app/<doctype>/view/gantt */
export default async function GanttPage({ params }: Props) {
  const { doctype } = await params;
  const d = safeDecode(doctype);
  return <GanttView key={d} doctype={d} />;
}
