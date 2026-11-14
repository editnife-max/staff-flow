// Which code-built layout replaces an uploaded CV template. Kept apart from index.tsx so
// pages that only need the matching (e.g. invoices) don't load the PDF export libraries.
import type { CvTemplate } from "@/lib/docx-fill";

export type CvLayoutId = "normal" | "normal-classic" | "tadbeer" | "jawa" | "monaco" | "format-n";

/** The code layout that replaces an uploaded template's PDF output, matched by template name. */
export function layoutForTemplate(
  template: Pick<CvTemplate, "name"> | null | undefined,
): CvLayoutId | null {
  const name = (template?.name ?? "").toLowerCase();
  if (name.includes("tadbeer")) return "tadbeer";
  if (name.includes("jawa")) return "jawa";
  if (name.includes("monaco")) return "monaco";
  if (/format\s*n\b/.test(name)) return "format-n";
  if (/\bnormal\b/.test(name)) return "normal";
  return null;
}
