"use client";

/**
 * Data Import flow state (Desk: frappe/core/doctype/data_import/data_import.js):
 * create the Data Import doc → upload the file → get_preview_from_template → form_start_import →
 * poll get_import_status until done → get_import_logs.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { deskCall } from "@/lib/frappe/form";
import { DONE, type LogRow, type Preview, type Status } from "./shared";

const DI = "frappe.core.doctype.data_import.data_import";

async function uploadError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { exc_type?: string };
  return body.exc_type ? `Upload failed: ${body.exc_type}` : "Upload failed";
}

async function uploadFile(file: File, docname: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("doctype", "Data Import");
  fd.append("docname", docname);
  fd.append("fieldname", "import_file");
  fd.append("is_private", "1");
  const res = await fetch("/api/frappe/api/method/upload_file", { method: "POST", body: fd, credentials: "include" });
  if (!res.ok) throw new Error(await uploadError(res));
  const json = (await res.json().catch(() => ({}))) as { message?: { file_url?: string } };
  if (!json.message?.file_url) throw new Error("Upload failed");
  return json.message.file_url;
}

export function useDataImport(doctype: string, file: File | null, importType: string, submitAfter: boolean) {
  const [busy, setBusy] = useState<string | null>(null);
  const [di, setDi] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (poll.current) clearTimeout(poll.current);
    },
    []
  );

  const reset = () => {
    setDi(null);
    setPreview(null);
    setStatus(null);
    setLogs([]);
  };

  const loadPreview = async () => {
    if (!doctype || !file) return;
    setBusy("Uploading…");
    try {
      const { env } = await deskCall("frappe.client.insert", { doc: { doctype: "Data Import", reference_doctype: doctype, import_type: importType, submit_after_import: submitAfter ? 1 : 0 } });
      const name = (env.message as { name: string }).name;
      setDi(name);
      const url = await uploadFile(file, name);
      await deskCall("frappe.client.set_value", { doctype: "Data Import", name, fieldname: "import_file", value: url });
      setBusy("Reading file…");
      const p = await deskCall(`${DI}.get_preview_from_template`, { data_import: name, import_file: url });
      setPreview(p.env.message as Preview);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read the file", { duration: 10000 });
    } finally {
      setBusy(null);
    }
  };

  const track = async (name: string) => {
    try {
      const { env } = await deskCall(`${DI}.get_import_status`, { data_import_name: name });
      const s = env.message as Status;
      setStatus(s);
      if (DONE.has(s.status)) {
        const l = await deskCall(`${DI}.get_import_logs`, { data_import: name });
        setLogs((l.env.message as LogRow[]) ?? []);
        return;
      }
    } catch {
      /* keep polling */
    }
    poll.current = setTimeout(() => void track(name), 1500);
  };

  const start = async () => {
    if (!di) return;
    try {
      await deskCall(`${DI}.form_start_import`, { data_import: di });
      setStatus({ status: "Pending" });
      void track(di);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start import", { duration: 10000 });
    }
  };

  return { busy, di, preview, status, logs, reset, loadPreview, start };
}
