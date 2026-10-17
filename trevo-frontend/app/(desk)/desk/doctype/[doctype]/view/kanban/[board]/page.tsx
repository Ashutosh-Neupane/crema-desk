import KanbanView from "@/components/views/KanbanView";
import { safeDecode } from "@/lib/utils/safeDecode";

interface Props {
  params: Promise<{ doctype: string; board: string }>;
}

export default async function KanbanBoardPage({ params }: Props) {
  const { doctype, board } = await params;
  const d = safeDecode(doctype);
  const b = safeDecode(board);
  return <KanbanView key={`${d}|${b}`} doctype={d} boardName={b} />;
}
