import ImageView from "@/components/views/ImageView";
import { safeDecode } from "@/lib/utils/safeDecode";

interface Props {
  params: Promise<{ doctype: string }>;
}

/** Desk: /app/<doctype>/view/image */
export default async function ImagePage({ params }: Props) {
  const { doctype } = await params;
  const d = safeDecode(doctype);
  return <ImageView key={d} doctype={d} />;
}
