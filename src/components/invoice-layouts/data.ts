// Invoice templates: the data an invoice prints, and which templates a manager can pick.
//
// Each CV design (built-in layouts and the company's Custom CV templates) has a matching
// invoice template, so a company's invoices carry the same letterhead as its CVs.
import { layoutForTemplate, type CvLayoutId } from "@/components/cv-layouts/match";
import type { CustomCvConfig } from "@/components/custom-cv/config";

export interface InvoiceWorker {
  id: string;
  name: string;
  passport: string | null;
  travelDate: string | null;
  profession: string | null;
}

export interface InvoiceData {
  number: string;
  /** ISO dates (yyyy-mm-dd); empty when not set. */
  date: string;
  dueDate: string;
  periodFrom: string;
  periodTo: string;
  from: { company: string; address: string; phone: string; email: string };
  /** The sponsor company the workers were selected by. */
  company: string;
  billTo: string;
  payment: { name: string; account: string };
  terms: string;
  currency: string;
  workers: InvoiceWorker[];
  feeEach: number;
  subtotal: number;
  otherExpenses: number;
  total: number;
}

/** "standard" is the original Staff-Flow invoice; the rest mirror a CV layout. */
export type BuiltinInvoiceTemplate = "standard" | CvLayoutId;
export const CUSTOM_INVOICE_PREFIX = "custom:";

export interface InvoiceTemplateOption {
  /** A BuiltinInvoiceTemplate, or `custom:<custom CV template id>`. */
  id: string;
  label: string;
  group: "builtin" | "company" | "custom";
  /** Set for custom templates. */
  config?: CustomCvConfig;
}

const BUILTIN_LABELS: Record<BuiltinInvoiceTemplate, string> = {
  standard: "Staff-Flow (default)",
  normal: "Normal",
  "normal-classic": "Normal Classic (green)",
  tadbeer: "TADBEER",
  jawa: "JAWA",
  monaco: "Monaco",
  "format-n": "Tatweer (Format N)",
};

/** Layouts with no company letterhead, offered to everyone. */
const GENERIC: BuiltinInvoiceTemplate[] = ["standard", "normal", "normal-classic"];

/**
 * Invoice templates for a company: the generic ones, one per uploaded CV template that
 * has a code layout (TADBEER, JAWA…), and one per active Custom CV template.
 */
export function invoiceTemplateOptions(
  cvTemplates: Array<{ name: string }>,
  customTemplates: Array<{ id: string; name: string; isActive: boolean; config: CustomCvConfig }>,
): InvoiceTemplateOption[] {
  const branded = new Set<CvLayoutId>();
  for (const t of cvTemplates) {
    const layout = layoutForTemplate(t);
    if (layout && !GENERIC.includes(layout)) branded.add(layout);
  }
  return [
    ...GENERIC.map((id) => ({ id, label: BUILTIN_LABELS[id], group: "builtin" as const })),
    ...[...branded].map((id) => ({ id, label: BUILTIN_LABELS[id], group: "company" as const })),
    ...customTemplates
      .filter((t) => t.isActive)
      .map((t) => ({
        id: `${CUSTOM_INVOICE_PREFIX}${t.id}`,
        label: t.name,
        group: "custom" as const,
        config: t.config,
      })),
  ];
}

export function fmtInvoiceDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtMoney(n: number, currency = ""): string {
  const v = n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return currency ? `${v} ${currency}` : v;
}
