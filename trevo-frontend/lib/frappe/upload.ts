/**
 * File upload (Desk: frappe.ui.FileUploader → POST /api/method/upload_file) via the BFF proxy.
 * XHR so callers can show progress; the response is Frappe's { message: File } envelope.
 */
import { frappeErrorMessage, parseServerMessages } from "@/lib/frappe/errors";

export interface UploadResult {
  name: string;
  file_url: string;
  file_name: string;
  is_private?: number;
}

export interface UploadOptions {
  doctype?: string;
  docname?: string;
  fieldname?: string;
  folder?: string;
  is_private?: boolean;
  onProgress?: (percent: number) => void;
}

export function uploadFile(file: File, opts: UploadOptions = {}): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  if (opts.doctype) fd.append("doctype", opts.doctype);
  if (opts.docname) fd.append("docname", opts.docname);
  if (opts.fieldname) fd.append("fieldname", opts.fieldname);
  if (opts.folder) fd.append("folder", opts.folder);
  fd.append("is_private", opts.is_private === false ? "0" : "1");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/frappe/api/method/upload_file");
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(Math.round((e.loaded * 100) / e.total));
    xhr.onerror = () => reject(new Error("Upload failed: network error"));
    xhr.onload = () => {
      let env: { message?: UploadResult; exc_type?: string; _server_messages?: string } = {};
      try {
        env = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error page */
      }
      if (xhr.status >= 200 && xhr.status < 300 && env.message?.file_url) resolve(env.message);
      else reject(new Error(frappeErrorMessage(env, parseServerMessages(env._server_messages), xhr.status) || "Upload failed"));
    };
    xhr.send(fd);
  });
}

/** Display name for a stored file URL (/private/files/a%20b.pdf → a b.pdf) */
export function fileNameFromUrl(url: string): string {
  const last = url.split("?")[0].split("/").pop() ?? url;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

export const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|$)/i.test(url);
