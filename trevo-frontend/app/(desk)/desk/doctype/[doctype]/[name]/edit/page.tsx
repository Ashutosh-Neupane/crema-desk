/**
 * Document edit page — Server Component wrapper for metadata + client island.
 */
import type { Metadata } from "next";
import { generatePageTitle } from "@/lib/utils/generatePageTitle";
import { DocumentEditClient } from "./DocumentEditClient";

interface Props {
  params: Promise<{ doctype: string; name: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doctype, name } = await params;
  const d = decodeURIComponent(doctype);
  const n = decodeURIComponent(name);
  return {
    title: generatePageTitle(`Edit ${n}`, d),
    description: `Edit ${n} — ${d}`,
  };
}

export default async function DoctypeEditPage({ params }: Props) {
  const { doctype, name } = await params;
  return (
    <DocumentEditClient
      doctype={decodeURIComponent(doctype)}
      name={decodeURIComponent(name)}
    />
  );
}
