import { Suspense } from "react";
import PermissionManager from "@/components/views/PermissionManager";
import { safeDecode } from "@/lib/utils/safeDecode";

interface Props {
  params: Promise<{ doctype?: string[] }>;
}

/** Desk: /app/permission-manager/<doctype> — native, ahead of the legacy page host's catch-all */
export default async function PermissionManagerPage({ params }: Props) {
  const { doctype } = await params;
  return (
    <Suspense>
      <PermissionManager doctype={doctype?.[0] ? safeDecode(doctype[0]) : ""} />
    </Suspense>
  );
}
