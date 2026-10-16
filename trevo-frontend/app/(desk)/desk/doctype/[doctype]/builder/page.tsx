import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ doctype: string }>;
}

/** The form builder lives in the DocType form's Form tab (like Desk v16). */
export default async function BuilderPage({ params }: Props) {
  const { doctype } = await params;
  redirect(`/desk/doctype/DocType/${doctype}`);
}
