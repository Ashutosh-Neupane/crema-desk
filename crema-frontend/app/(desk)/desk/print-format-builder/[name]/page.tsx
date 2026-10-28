import PrintFormatBuilderHost from "@/components/views/PrintFormatBuilderHost";

interface Props {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ ui?: string }>;
}

/** Print Format "Edit Format": Crema's builder full screen; `?ui=desk` / `?ui=classic` frame Desk's (docs/GAPS.md § 2.19) */
export default async function PrintFormatBuilderRoute({ params, searchParams }: Props) {
  const [{ name }, { ui }] = await Promise.all([params, searchParams]);
  return <PrintFormatBuilderHost name={decodeURIComponent(name)} ui={ui === "classic" || ui === "desk" ? ui : "crema"} />;
}
