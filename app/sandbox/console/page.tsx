import { redirect } from "next/navigation";

/** /sandbox/try is the one canonical full-console page — kept as a redirect so the old URL still works. */
export default function SandboxConsolePage() {
  redirect("/sandbox/try");
}
