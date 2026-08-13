import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Module Onboarding | Trevo",
    description: "Setup wizard for installed modules",
  };
}

import { ModuleOnboardingWizard } from "@/components/features/onboarding/ModuleOnboardingWizard";

export default function ModuleOnboardingPage() {
  return <ModuleOnboardingWizard />;
}
