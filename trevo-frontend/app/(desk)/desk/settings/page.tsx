/**
 * Settings page — Server Component wrapper for metadata + client island.
 */
import type { Metadata } from "next";
import { SettingsClient } from "./SettingsClient";

export const metadata: Metadata = {
  title: "Settings | Trevo",
  description: "User settings and preferences",
};

export default function SettingsPage() {
  return <SettingsClient />;
}
