/**
 * File upload — delegates to frappe.client.upload via the BFF proxy.
 */
import { frappeClient } from "./client";

export interface UploadResult {
  file_url: string;
  file_name: string;
  name: string;
  url?: string;
}

export interface UploadOptions {
  doctype?: string;
  docname?: string;
  is_private?: boolean;
  onProgress?: (progress: number) => void;
}

export async function uploadFile(file: File, opts?: UploadOptions): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  if (opts?.doctype) formData.append("doctype", opts.doctype);
  if (opts?.docname) formData.append("docname", opts.docname);
  if (opts?.is_private !== undefined) formData.append("is_private", String(opts.is_private));

  const res = await frappeClient.post<{ data: UploadResult }>("/api/method/upload_file", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (progressEvent) => {
      if (opts?.onProgress && progressEvent.total) {
        opts.onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
      }
    },
  });
  return res.data.data;
}
