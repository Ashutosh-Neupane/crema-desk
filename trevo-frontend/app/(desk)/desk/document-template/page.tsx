import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Document Templates | Trevo",
    description: "Manage document templates",
  };
}

import { DocumentTemplateList } from "@/components/features/system/DocumentTemplateList";

export default function DocumentTemplatePage() {
  return <DocumentTemplateList />;
}
