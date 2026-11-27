import { Suspense } from "react";
import { KanbanBoards } from "@/components/views/KanbanView";
import { safeDecode } from "@/lib/utils/safeDecode";

interface Props {
  params: Promise<{ doctype: string }>;
}

export default async function KanbanBoardsPage({ params }: Props) {
  const { doctype } = await params;
  const d = safeDecode(doctype);
  // KanbanBoards reads ?new=1 (useSearchParams): "New Kanban board" from the view menu opens the create dialog
  return (
    <Suspense>
      <KanbanBoards key={d} doctype={d} />
    </Suspense>
  );
}
