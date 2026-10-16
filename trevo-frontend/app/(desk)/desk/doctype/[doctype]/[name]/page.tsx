/**
 * Document page — Server Component wrapper for metadata.
 * The form (view + edit in one, like Desk) is DocForm.
 */
import type { Metadata } from "next";
import { generatePageTitle } from "@/lib/utils/generatePageTitle";
import DocForm from "@/components/form/DocForm";
import { safeDecode } from "@/lib/utils/safeDecode";

interface Props {
  params: Promise<{ doctype: string; name: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doctype, name } = await params;
  const d = safeDecode(doctype);
  const n = safeDecode(name);
  return {
    title: generatePageTitle(n, d),
    description: `${n} — ${d}`,
  };
}

export default async function DoctypeDetailPage({ params }: Props) {
  const { doctype, name } = await params;
  return (
    <DocForm
      key={`${doctype}/${name}`}
      doctype={safeDecode(doctype)}
      name={safeDecode(name)}
    />
  );
}
