import type { Database } from "@/integrations/supabase/types";

export type Status = "available" | "processing" | "arrived" | "canceled" | "returned";
export type Candidate = Database["public"]["Tables"]["candidates"]["Row"] & {
  created_by_name?: string | null;
};

export type ProcessingColDef =
  | { key: string; header: string; type: "text" | "date" | "copy" | "upload" }
  | { key: string; header: string; type: "select"; options: string[] }
  | { key: string; header: string; type: "select-dynamic" };

export type EditableField =
  | "notes" | "narrative" | "occupation" | "living_town" | "selected_by"
  | "medical_status" | "status" | "office" | "passport_status"
  | "musaned_status" | "coc_status"
  | "passport_number" | "labour_id"
  | "narrative_phone" | "contract_date" | "medical_date" | "medical_days"
  | "tasheer_status" | "tasheer_date" | "wokala_status" | "embassy_date"
  | "visa_status" | "insurance_status" | "unfilled_lmis" | "lmis_status"
  | "ticket_status" | "ticket_date" | "arrival_city" | "emergency_contact"
  | "processing_notes" | "remark" | "destination_country" | "cv_sent_to" | "passport_accepted"
  | "availability_type" | "coc_agency_name" | "coc_agency_phone" | "insurance_date"
  | "video_url" | "delete_reason" | "ticket_pdf_url" | "visa_pdf_url" | "qr_url"
  | "return_ticket_url" | "stamp_url";

export const MEDICAL_OPTIONS = ["Fit", "Booked", "Unfit", "No", "In progress", "Expired"];
export const medDaysAgo = (date: string) =>
  Math.floor((Date.now() - new Date(date + "T00:00:00").getTime()) / 86400000);
export const AVAILABILITY_OPTIONS: Status[] = ["available", "processing", "arrived", "returned", "canceled"];
export const COC_OPTIONS = ["Done", "No", "Booked", "Placed", "Yitazez", "Pending release"];
export const MUSANED_OPTIONS: string[] = [];
export const OFFICE_OPTIONS = ["Riyadh", "Jeddah", "Dammam", "Other"];
export const PASSPORT_OPTIONS = ["Original", "Scan"];
export const TASHEER_OPTIONS = ["No", "Booked", "Done", "Ready"];
export const WOKALA_OPTIONS = ["Paid", "Unpaid"];
export const VISA_OPTIONS = [
  "Ready for embassy", "Sent to Embassy", "Privately Sent", "Issued",
  "Visa canceled", "Arrived KSA", "Returned", "Waiting Replacement",
];
export const INSURANCE_OPTIONS = ["No", "Done"];
export const LMIS_OPTIONS = [
  "No COC", "Not tested", "Placed", "Imported", "Checked",
  "Verified", "Draft", "Pending", "Issued", "Rejected",
];
export const UNFILLED_LMIS_OPTIONS = ["INSU", "COC", "ID"];
export const TICKET_OPTIONS = ["No", "Ready", "New Order", "Booked", "Exchange", "Urgent", "Hold"];
export const ARRIVAL_CITY_OPTIONS = ["RIYADH", "JEDDAH", "DAMMAM", "JOUF", "HAIL", "ABHA", "OTHERS"];

export const OPTION_COLORS: Record<string, string> = {
  "Fit":                "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "Unfit":              "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  "In progress":        "bg-white text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700",
  "Expired":            "bg-white text-orange-700 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700",
  "No":                 "bg-white text-zinc-600 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-600",
  "Done":               "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "Booked":             "bg-white text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700",
  "Placed":             "bg-white text-violet-700 border border-violet-300 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-700",
  "Yitazez":            "bg-white text-orange-700 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700",
  "Pending release":    "bg-white text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700",
  "Ready":              "bg-white text-violet-700 border border-violet-300 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-700",
  "Paid":               "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "Unpaid":             "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  "Ready for embassy":  "bg-white text-sky-700 border border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-700",
  "Sent to Embassy":    "bg-white text-violet-700 border border-violet-300 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-700",
  "Privately Sent":     "bg-white text-cyan-700 border border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-700",
  "Issued":             "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "Visa canceled":      "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  "Arrived KSA":        "bg-white text-green-700 border border-green-300 dark:bg-green-950/40 dark:text-green-400 dark:border-green-700",
  "Returned":           "bg-white text-orange-700 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700",
  "Waiting Replacement":"bg-white text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700",
  "Pending":            "bg-white text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700",
  "No COC":             "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  "Not tested":         "bg-white text-zinc-600 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-600",
  "Imported":           "bg-white text-violet-700 border border-violet-300 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-700",
  "Checked":            "bg-white text-teal-700 border border-teal-300 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-700",
  "Verified":           "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "Draft":              "bg-white text-zinc-600 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-600",
  "Rejected":           "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  "New Order":          "bg-white text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700",
  "Exchange":           "bg-white text-orange-700 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700",
  "Urgent":             "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  "RIYADH":             "bg-white text-violet-700 border border-violet-300 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-700",
  "JEDDAH":             "bg-white text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700",
  "DAMMAM":             "bg-white text-cyan-700 border border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-700",
  "JOUF":               "bg-white text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700",
  "HAIL":               "bg-white text-orange-700 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700",
  "ABHA":               "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "OTHERS":             "bg-white text-zinc-600 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-600",
  "Submitted":          "bg-white text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700",
  "Received":           "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "available":          "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "processing":         "bg-white text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700",
  "arrived":            "bg-white text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700",
  "canceled":           "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  "returned":           "bg-white text-orange-700 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700",
  "private":            "bg-white text-purple-700 border border-purple-300 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-700",
  "unavailable":        "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  "Available":          "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "Private":            "bg-white text-purple-700 border border-purple-300 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-700",
  "Unavailable":        "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  "Riyadh":             "bg-white text-violet-700 border border-violet-300 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-700",
  "Jeddah":             "bg-white text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700",
  "Dammam":             "bg-white text-cyan-700 border border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-700",
  "Other":              "bg-white text-zinc-600 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-600",
  "Saudi":              "bg-white text-green-700 border border-green-300 dark:bg-green-950/40 dark:text-green-400 dark:border-green-700",
  "Kuwait":             "bg-white text-teal-700 border border-teal-300 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-700",
  "INSU":               "bg-white text-rose-700 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-700",
  "COC":                "bg-white text-orange-700 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700",
  "ID":                 "bg-white text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700",
  "18-25":              "bg-white text-sky-700 border border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-700",
  "26-35":              "bg-white text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700",
  "36-45":              "bg-white text-violet-700 border border-violet-300 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-700",
  "46-99":              "bg-white text-indigo-700 border border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-700",
  "Male":               "bg-white text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700",
  "Female":             "bg-white text-pink-700 border border-pink-300 dark:bg-pink-950/40 dark:text-pink-400 dark:border-pink-700",
  "Muslim":             "bg-white text-teal-700 border border-teal-300 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-700",
  "Non-muslim":         "bg-white text-slate-600 border border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-600",
  "Experienced":        "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "Non-Experienced":    "bg-white text-orange-700 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700",
  "Yes":                "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "None":               "bg-white text-zinc-600 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-600",
  "newest":             "bg-white text-sky-700 border border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-700",
  "oldest":             "bg-white text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700",
  "Not Selected":       "bg-white text-zinc-400 border border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-700",
  "Hold":               "bg-white text-rose-700 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-700",
  "":                   "bg-white text-zinc-400 border border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-700",
};

export const PROCESSING_COLS: ProcessingColDef[] = [
  { key: "passport_number",   header: "Passport No",       type: "copy" },
  { key: "labour_id",         header: "Labour ID",         type: "copy" },
  { key: "narrative",         header: "Narrative",         type: "text" },
  { key: "narrative_phone",   header: "Narrative Phone",   type: "text" },
  { key: "contract_date",     header: "Contract Date",     type: "date" },
  { key: "medical_status",    header: "Medical",           type: "select", options: MEDICAL_OPTIONS },
  { key: "medical_date",      header: "Medical Date",      type: "date" },
  { key: "coc_status",        header: "COC",               type: "select", options: COC_OPTIONS },
  { key: "tasheer_status",    header: "Tasheer",           type: "select", options: TASHEER_OPTIONS },
  { key: "tasheer_date",      header: "Tasheer Date",      type: "date" },
  { key: "wokala_status",     header: "Wokala",            type: "select", options: WOKALA_OPTIONS },
  { key: "embassy_date",      header: "Embassy Date",      type: "date" },
  { key: "visa_status",       header: "Visa Status",       type: "select", options: VISA_OPTIONS },
  { key: "insurance_status",  header: "Insurance",         type: "select", options: INSURANCE_OPTIONS },
  { key: "unfilled_lmis",     header: "LMIS file",         type: "select", options: UNFILLED_LMIS_OPTIONS },
  { key: "lmis_status",       header: "LMIS",              type: "select", options: LMIS_OPTIONS },
  { key: "ticket_status",     header: "Ticket",            type: "select", options: TICKET_OPTIONS },
  { key: "ticket_date",       header: "Ticket Date",       type: "date" },
  { key: "ticket_pdf_url",    header: "Ticket PDF",        type: "upload" },
  { key: "arrival_city",      header: "Arrival City",      type: "select", options: ARRIVAL_CITY_OPTIONS },
  { key: "processing_notes",  header: "Note",              type: "text" },
  { key: "emergency_contact", header: "Emergency Contact", type: "text" },
];

export const CANDIDATE_CARD_COLS = [
  "FULL NAME", "CANDIDATE CODE", "PASSPORT NUMBER", "LABOUR ID",
  "AGE", "VIDEO", "MARITAL STATUS", "BIRTH PLACE",
  "NARRATIVE PHONE", "NARRATIVE", "RELIGION",
  "CV SENT TO", "CV SENT DATE",
  "PASSPORT STATUS", "COC STATUS", "COUNTRY", "MEDICAL STATUS", "MEDICAL DATE",
  "EXPERIENCE", "NOTES", "AVAILABILITY", "SELECTED BY",
  "ADDED BY", "GENDER", "LIVING TOWN", "OFFICE", "CONTRACT DATE",
  "TICKET PDF",
] as const;

export const firstName = (s: string | null | undefined) =>
  (s ?? "").trim().split(/\s+/)[0] || "";

export const CV_REQ_KEY_MGR = "cv-page-requirements";

export function checkMeetsCvReq(c: Candidate, req: Record<string, string>): boolean {
  if (req.medical && req.medical !== "all" && c.medical_status !== req.medical) return false;
  if (req.coc && req.coc !== "all" && c.coc_status !== req.coc) return false;
  if (req.narrative && req.narrative !== "all" && c.narrative !== req.narrative) return false;
  if (req.experience && req.experience !== "all" && c.experience !== req.experience) return false;
  if (req.passport_scan === "Yes" && !c.passport_scan_url) return false;
  if (req.full_size_photo === "Yes" && !c.full_photo_url) return false;
  if (req.photo_cv === "Yes" && !c.photo_url) return false;
  return true;
}
