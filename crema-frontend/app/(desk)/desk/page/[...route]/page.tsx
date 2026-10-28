import LegacyPage from "@/components/views/LegacyPage";

interface Props {
  params: Promise<{ route: string[] }>;
}

/** Desk Pages that Crema has not rebuilt natively (POS, setup wizard, app pages) — Frappe's own UI, framed */
export default async function LegacyPageRoute({ params }: Props) {
  const { route } = await params;
  return <LegacyPage route={route.join("/")} />;
}
