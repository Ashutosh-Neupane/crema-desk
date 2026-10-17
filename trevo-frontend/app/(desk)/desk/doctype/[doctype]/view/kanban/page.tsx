import { KanbanBoards } from "@/components/views/KanbanView";
import { safeDecode } from "@/lib/utils/safeDecode";

interface Props {
  params: Promise<{ doctype: string }>;
}

export default async function KanbanBoardsPage({ params }: Props) {
  const { doctype } = await params;
  const d = safeDecode(doctype);
  return <KanbanBoards key={d} doctype={d} />;
}
