import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Website Builder | Trevo",
    description: "Build and manage website pages",
  };
}

import { WebsiteBuilder } from "@/components/features/website/WebsiteBuilder";

export default function WebsiteBuilderPage() {
  return <WebsiteBuilder />;
}
