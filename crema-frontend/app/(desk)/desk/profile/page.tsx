import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Profile | Crema",
    description: "User profile and preferences",
  };
}

import { ProfilePage } from "@/components/features/system";

export default function ProfileRoute() {
  return <ProfilePage />;
}

