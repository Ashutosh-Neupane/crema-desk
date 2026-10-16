/**
 * Workspace page — renders a Frappe Workspace from its `content` blocks, like Desk:
 * header / paragraph / spacer / shortcut / card (link groups) / chart / number_card /
 * quick_list on a 12-column grid using each block's `col`.
 */
import type { Metadata } from "next";
import WorkspaceView from "@/components/desk/WorkspaceView";
import { safeDecode } from "@/lib/utils/safeDecode";

interface Props {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  return { title: `${safeDecode(name)} | Trevo` };
}

export default async function WorkspacePage({ params }: Props) {
  const { name } = await params;
  const decoded = safeDecode(name);
  return <WorkspaceView key={decoded} name={decoded} />;
}
