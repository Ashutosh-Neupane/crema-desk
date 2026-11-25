/**
 * Login page — Server Component for metadata, client island for the form.
 * A visitor whose session is still live goes straight to the desk (a server
 * redirect, so the form never flashes before navigating away).
 */
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { frappeServerFetch } from "@/lib/frappe/server";
import { LoginClient } from "./LoginClient";

export const metadata: Metadata = {
  title: "Login | Crema",
  description: "Sign in to your Crema workspace",
};

/** True when the request's `sid` belongs to a logged-in (non-Guest) session. */
async function hasLiveSession(): Promise<boolean> {
  const jar = await cookies();
  const sid = jar.get("sid")?.value;
  if (!sid || sid === "Guest") return false;
  try {
    const { ok, data } = await frappeServerFetch<string>(jar.toString(), "api/method/frappe.auth.get_logged_user", {
      throwOnError: false,
    });
    return ok && typeof data === "string" && data !== "Guest";
  } catch {
    return false;
  }
}

export default async function LoginPage() {
  if (await hasLiveSession()) redirect("/desk");
  return <LoginClient />;
}
