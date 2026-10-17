import PrintView from "@/components/views/PrintView";
import { safeDecode } from "@/lib/utils/safeDecode";

interface Props {
  params: Promise<{ doctype: string; name: string }>;
}

/** Desk: /app/print/<doctype>/<name> */
export default async function PrintPage({ params }: Props) {
  const { doctype, name } = await params;
  const d = safeDecode(doctype);
  const n = safeDecode(name);
  return <PrintView key={`${d}|${n}`} doctype={d} name={n} />;
}
