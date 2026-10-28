/**
 * Login page — Server Component for metadata, client island for the form.
 */
import type { Metadata } from "next";
import { LoginClient } from "./LoginClient";

export const metadata: Metadata = {
  title: "Login | Crema",
  description: "Sign in to your Crema workspace",
};

export default function LoginPage() {
  return <LoginClient />;
}
