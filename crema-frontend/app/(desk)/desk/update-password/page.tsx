import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Update Password | Crema",
    description: "Update your account password",
  };
}

import { UpdatePasswordPage } from "@/components/features/system";

export default function UpdatePasswordRoute() {
  return <UpdatePasswordPage />;
}

