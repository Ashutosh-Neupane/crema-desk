export interface PreviewColumn {
  header_title: string;
  skip_import?: boolean;
  df?: { label?: string; fieldname?: string; reqd?: number };
  map_to_field?: string | null;
  warnings?: Array<{ message: string }>;
}
export interface Preview {
  columns: PreviewColumn[];
  data: unknown[][];
  warnings: Array<{ row?: number; col?: number; message: string; type?: string }>;
  total_number_of_rows: number;
}
export interface Status {
  status: string;
  total_records?: number;
  success?: number;
  failed?: number;
  processed_records?: number;
}
export interface LogRow {
  success: number;
  docname?: string;
  messages?: string;
  exception?: string | null;
  row_indexes?: string;
}

export const enc = encodeURIComponent;
export const TYPES = ["Insert New Records", "Update Existing Records", "Insert or Update Records"];
export const DONE = new Set(["Success", "Partial Success", "Error", "Timed Out"]);
export const strip = (s: string) => s.replace(/<[^>]+>/g, "");

/**
 * React keys from each item's own content; repeats (e.g. two columns with the same header) get an
 * occurrence suffix, so keys stay unique without falling back to the array position.
 */
export function contentKeys<T>(items: T[], base: (item: T) => string): string[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const b = base(item);
    const n = seen.get(b) ?? 0;
    seen.set(b, n + 1);
    return n ? `${b}#${n}` : b;
  });
}
