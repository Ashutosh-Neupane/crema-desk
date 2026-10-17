import TreeView from "@/components/views/TreeView";
import { safeDecode } from "@/lib/utils/safeDecode";

interface Props {
  params: Promise<{ doctype: string }>;
}

export default async function TreePage({ params }: Props) {
  const { doctype } = await params;
  const d = safeDecode(doctype);
  return <TreeView key={d} doctype={d} />;
}
