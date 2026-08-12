/**
 * Workflow Builder page — Server Component for metadata.
 * Client implementation is in WorkflowBuilderClient.tsx.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workflow Builder | Trevo",
  description: "Design approval and status workflows",
};

export { default } from "./WorkflowBuilderClient";
