import type { Metadata } from "next";
import MyWorkView from "@/components/phase2/home/MyWorkView";

export const metadata: Metadata = { title: "My work | Crema" };

/** Phase 2 Home (docs/GAPS.md § 3.4): documents waiting on me, my drafts, recent records, pinned shortcuts. */
export default function MyWorkPage() {
  return <MyWorkView />;
}
