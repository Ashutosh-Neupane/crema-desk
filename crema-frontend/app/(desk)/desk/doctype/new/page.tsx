import { redirect } from "next/navigation";

/** New DocType follows Frappe's flow: DocType list → "Create New DocType" dialog → DocType form. */
export default function NewDoctypePage() {
  redirect("/desk/doctype?new=1");
}
