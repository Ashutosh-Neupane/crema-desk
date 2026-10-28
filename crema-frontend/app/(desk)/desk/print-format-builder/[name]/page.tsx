import PrintFormatBuilderHost from "@/components/views/PrintFormatBuilderHost";

interface Props {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ ui?: string }>;
}

/** Print Format "Edit Format": Desk's builder full screen (docs/GAPS.md § 2.19 A) */
export default async function PrintFormatBuilderRoute({ params, searchParams }: Props) {
  const [{ name }, { ui }] = await Promise.all([params, searchParams]);
  return <PrintFormatBuilderHost name={decodeURIComponent(name)} classic={ui === "classic"} />;
}
