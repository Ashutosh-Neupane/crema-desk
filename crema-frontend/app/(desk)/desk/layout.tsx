/**
 * Desk layout — Server Component auth guard.
 *
 * IMPORTANT: This must ONLY read the sid cookie directly. Never add a
 * self-fetch to http://localhost:3000/api/auth/whoami here. A Server
 * Component calling its own Next.js route adds a full unnecessary HTTP
 * round-trip (DNS + socket + full middleware stack) before any HTML is sent.
 *
 * The client-side AuthProvider in lib/frappe/auth.tsx handles the boot
 * fetch after the shell hydrates.
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import CremaShell from "@/components/CremaShell";

export default async function DeskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieJar = await cookies();
  const sid = cookieJar.get("sid")?.value;

  // Fast cookie-only check — no HTTP calls
  if (!sid || sid === "Guest") {
    redirect("/login");
  }

  return <CremaShell>{children}</CremaShell>;
}
