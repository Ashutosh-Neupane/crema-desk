import type { Metadata } from "next";
import { fetchWwwPage } from "@/lib/frappe/www";
import { getCookieHeader } from "@/lib/frappe/server";

interface WwwRouteProps {
  params: Promise<{ path: string[] }>;
}

export async function generateMetadata({ params }: WwwRouteProps): Promise<Metadata> {
  const { path } = await params;
  return { title: `/${path.join("/")}` };
}

/**
 * Catch-all renderer for backend website pages.
 * Fetches the Jinja-rendered HTML from Frappe (same response the backend
 * would serve at this path) and mounts it here, with asset/form URLs
 * rewritten to the backend origin.
 */
export default async function WwwCatchAllPage({ params }: WwwRouteProps) {
  const { path } = await params;
  const cookieHeader = await getCookieHeader();
  const result = await fetchWwwPage(path.join("/"), cookieHeader);

  return (
    <>
      {/* Backend stylesheets for this page (bootstrap / frappe.css / page css) */}
      {/* Frappe website pages are site-authored content rendered as-is, exactly like Frappe's own /www */}
      {/* react-doctor-disable-next-line dangerous-html-sink */}
      <div aria-hidden="true" dangerouslySetInnerHTML={{ __html: result.stylesHtml }} />
      {!result.ok && (
        <div className="border-b border-yellow-200 bg-yellow-50 px-4 py-1.5 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
          {result.error ?? `Backend responded with ${result.status}`}
        </div>
      )}
      {/* react-doctor-disable-next-line dangerous-html-sink */}
      <div className="frappe-www-body" dangerouslySetInnerHTML={{ __html: result.bodyHtml }} />
    </>
  );
}
