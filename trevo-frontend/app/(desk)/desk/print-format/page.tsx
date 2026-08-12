/**
 * Print Format page — Server Component for metadata.
 * Client implementation is in PrintFormatClient.tsx.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Print Formats | Trevo",
  description: "Design print templates for your documents",
};

export { default } from "./PrintFormatClient";
