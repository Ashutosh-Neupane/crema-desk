import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Onboarding Steps | Trevo",
    description: "Manage onboarding wizard steps",
  };
}

import { SystemDoctypeList } from "@/components/features/system";

export default function OnboardingStepPage() {
  return (
    <SystemDoctypeList
      doctype="Onboarding Step"
      title="Onboarding Steps"
      description="Steps shown during user onboarding."
      columns={[
        { fieldname: "name", label: "Title" },
        { fieldname: "description", label: "Description" },
        { fieldname: "is_complete", label: "Complete", render: (r) => (r.is_complete ? "Yes" : "No") },
      ]}
      viewHref={(name) => `/desk/doctype/Onboarding Step/${encodeURIComponent(name)}`}
      emptyMessage="No onboarding steps found."
    />
  );
}
