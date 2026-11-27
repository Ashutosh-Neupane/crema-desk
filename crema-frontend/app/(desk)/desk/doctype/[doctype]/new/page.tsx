"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import DocForm from "@/components/form/DocForm";
import { NewDocTypeStart } from "@/components/doctype/NewDocTypeStart";
import { useNewLayout } from "@/lib/ui/newLayout";
import { safeDecode } from "@/lib/utils/safeDecode";

/**
 * New document — same Desk-style form as an existing doc, with Desk's defaults applied.
 * A new DocType in the New layout starts with a short guided step instead (name, kind, naming); `?advanced=1` (or
 * any other query string, e.g. route options) opens the full form.
 */
export default function DoctypeNewPage() {
  return (
    <Suspense>
      <NewPage />
    </Suspense>
  );
}

function NewPage() {
  const params = useParams<{ doctype: string }>();
  const search = useSearchParams();
  const newLayout = useNewLayout();
  const doctype = safeDecode(params.doctype);
  if (doctype === "DocType" && newLayout && !search.toString()) return <NewDocTypeStart />;
  return <DocForm doctype={doctype} />;
}
