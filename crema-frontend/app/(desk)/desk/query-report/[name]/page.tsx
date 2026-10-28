import QueryReport from "@/components/views/QueryReport";
import { safeDecode } from "@/lib/utils/safeDecode";

interface Props {
  params: Promise<{ name: string }>;
}

export default async function QueryReportPage({ params }: Props) {
  const { name } = await params;
  const n = safeDecode(name);
  return <QueryReport key={n} name={n} />;
}
