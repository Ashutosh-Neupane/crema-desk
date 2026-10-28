"use client";

import { useParams } from "next/navigation";
import DocForm from "@/components/form/DocForm";
import { safeDecode } from "@/lib/utils/safeDecode";

/** New document — same Desk-style form as an existing doc, with Desk's defaults applied. */
export default function DoctypeNewPage() {
  const params = useParams<{ doctype: string }>();
  return <DocForm doctype={safeDecode(params.doctype)} />;
}
