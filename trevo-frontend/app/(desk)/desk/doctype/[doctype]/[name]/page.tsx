/**
 * Document detail page — Server Component wrapper for metadata.
 * The actual UI is in DocumentDetailClient (client component).
 */
import type { Metadata } from "next";
import { generatePageTitle } from "@/lib/utils/generatePageTitle";
import { DocumentDetailClient } from "./DocumentDetailClient";

interface Props {
  params: Promise<{ doctype: string; name: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doctype, name } = await params;
  const d = decodeURIComponent(doctype);
  const n = decodeURIComponent(name);
  return {
    title: generatePageTitle(n, d),
    description: `${n} — ${d}`,
  };
}

export default async function DoctypeDetailPage({ params }: Props) {
  const { doctype, name } = await params;
  return (
    <DocumentDetailClient
      doctype={decodeURIComponent(doctype)}
      name={decodeURIComponent(name)}
    />
  );
}
