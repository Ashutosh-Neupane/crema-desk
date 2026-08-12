/**
 * DocType list page — Server Component for metadata.
 * The interactive list is in DoctypeListClient (client component).
 *
 * generateMetadata must live in a Server Component (cannot be in a "use client" file).
 */
import type { Metadata } from "next";
import { generatePageTitle } from "@/lib/utils/generatePageTitle";

interface Props {
  params: Promise<{ doctype: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doctype } = await params;
  const d = decodeURIComponent(doctype);
  return {
    title: generatePageTitle(d),
    description: `${d} list view`,
  };
}

// The default export is the client component — Next.js uses this as the page.
export { default } from "./DoctypeListClient";



