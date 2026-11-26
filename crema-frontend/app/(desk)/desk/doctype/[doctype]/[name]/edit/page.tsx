/**
 * Legacy /edit URL — the document page is the editable form (like Desk), so redirect there.
 */
import { redirect } from "next/navigation";
import { docUrl } from "@/lib/navigation/deskUrl";

interface Props {
  params: Promise<{ doctype: string; name: string }>;
}

export default async function DoctypeEditPage({ params }: Props) {
  const { doctype, name } = await params;
  redirect(docUrl(decodeURIComponent(doctype), decodeURIComponent(name)));
}
