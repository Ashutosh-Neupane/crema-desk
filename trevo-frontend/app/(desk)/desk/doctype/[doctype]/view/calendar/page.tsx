import CalendarView from "@/components/views/CalendarView";
import { safeDecode } from "@/lib/utils/safeDecode";

interface Props {
  params: Promise<{ doctype: string }>;
}

/** Desk: /app/<doctype>/view/calendar */
export default async function CalendarPage({ params }: Props) {
  const { doctype } = await params;
  const d = safeDecode(doctype);
  return <CalendarView key={d} doctype={d} />;
}
