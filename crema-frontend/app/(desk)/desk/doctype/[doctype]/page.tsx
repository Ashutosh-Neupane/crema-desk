/**
 * DocType list page — Server Component for metadata; the list is the
 * Desk-style ListView client component.
 */
import type { Metadata } from "next";
import { Suspense } from "react";
import { generatePageTitle } from "@/lib/utils/generatePageTitle";
import ListView from "@/components/list/ListView";
import { safeDecode } from "@/lib/utils/safeDecode";

interface Props {
  params: Promise<{ doctype: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doctype } = await params;
  const d = safeDecode(doctype);
  return { title: generatePageTitle(d), description: `${d} list view` };
}

export default async function DoctypeListPage({ params }: Props) {
  const { doctype } = await params;
  const d = safeDecode(doctype);
  return (
    <Suspense>
      <ListView key={d} doctype={d} />
    </Suspense>
  );
}
