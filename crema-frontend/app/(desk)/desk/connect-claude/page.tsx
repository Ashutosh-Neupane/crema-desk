import type { Metadata } from "next";
import ConnectClaude from "@/components/ai/ConnectClaude";

export const metadata: Metadata = { title: "Connect Claude | Crema" };

/** Phase 2 PR C1 (docs/PHASE2_DESIGN.md § 5.14): connect Claude to this site over MCP. */
export default function ConnectClaudePage() {
  return <ConnectClaude />;
}
