import { Suspense } from "react";
import type { Metadata } from "next";
import DataImport from "@/components/views/DataImport";

export const metadata: Metadata = { title: "Data Import | Crema" };

export default function DataImportPage() {
  return (
    <Suspense>
      <DataImport />
    </Suspense>
  );
}
