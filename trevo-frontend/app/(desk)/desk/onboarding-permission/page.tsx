import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Onboarding Permissions | Trevo",
    description: "Manage onboarding role permissions",
  };
}

import { SystemDoctypeList } from "@/components/features/system";

export default function OnboardingPermissionPage() {
  return (
    <SystemDoctypeList
      doctype="Onboarding Permission"
      title="Onboarding Permissions"
      description="Roles allowed to view onboarding steps."
      columns={[
        { fieldname: "name", label: "Name" },
        { fieldname: "role", label: "Role" },
        { fieldname: "parent", label: "Parent Step" },
      ]}
      viewHref={(name) => `/desk/doctype/Onboarding Permission/${encodeURIComponent(name)}`}
      emptyMessage="No onboarding permissions found."
    />
  );
}
