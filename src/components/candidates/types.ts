import type { Database } from "@/integrations/supabase/types";

export type Candidate = Database["public"]["Tables"]["candidates"]["Row"];
export type CandidateStatus = Database["public"]["Enums"]["candidate_status"];
export type MedicalStatus = Database["public"]["Enums"]["medical_status"];
export type PassportStatus = Database["public"]["Enums"]["passport_status"];
export type DocStatus = Database["public"]["Enums"]["doc_status"];
export type OfficeName = Database["public"]["Enums"]["office_name"];

export type ColumnKey =
  | "full_name" | "candidate_code" | "passport_number" | "labour_id"
  | "office" | "passport_status" | "coc_status" | "musaned_status"
  | "medical_status" | "medical_date" | "status"
  | "occupation" | "living_town" | "birth_place" | "country"
  | "gender" | "religion" | "marital_status" | "age"
  | "selected_by" | "cv_sent_to" | "cv_sent_date"
  | "narrative" | "notes" | "created_at";

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  width?: number;
  type: "text" | "number" | "date" | "select" | "readonly";
  options?: { value: string; label: string }[];
}

export const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "processing", label: "Processing" },
  { value: "arrived", label: "Arrived" },
  { value: "canceled", label: "Canceled" },
];
export const MEDICAL_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "fit", label: "Fit" },
  { value: "unfit", label: "Unfit" },
];
export const PASSPORT_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "submitted", label: "Submitted" },
  { value: "received", label: "Received" },
  { value: "expired", label: "Expired" },
];
export const DOC_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "rejected", label: "Rejected" },
];
export const OFFICE_OPTIONS = [
  { value: "saudi", label: "Saudi" },
  { value: "kuwait", label: "Kuwait" },
  { value: "uae", label: "UAE" },
  { value: "qatar", label: "Qatar" },
  { value: "bahrain", label: "Bahrain" },
  { value: "oman", label: "Oman" },
  { value: "other", label: "Other" },
];

export const COLUMNS: ColumnDef[] = [
  { key: "full_name", label: "Full Name", width: 200, type: "text" },
  { key: "candidate_code", label: "Code", width: 130, type: "readonly" },
  { key: "passport_number", label: "Passport #", width: 140, type: "text" },
  { key: "labour_id", label: "Labour ID", width: 130, type: "text" },
  { key: "office", label: "Office", width: 130, type: "select", options: OFFICE_OPTIONS },
  { key: "passport_status", label: "Passport", width: 130, type: "select", options: PASSPORT_OPTIONS },
  { key: "coc_status", label: "COC", width: 130, type: "select", options: DOC_OPTIONS },
  { key: "musaned_status", label: "Musaned", width: 130, type: "select", options: DOC_OPTIONS },
  { key: "medical_status", label: "Medical", width: 120, type: "select", options: MEDICAL_OPTIONS },
  { key: "medical_date", label: "Medical Date", width: 140, type: "date" },
  { key: "status", label: "Availability", width: 130, type: "select", options: STATUS_OPTIONS },
  { key: "occupation", label: "Occupation", width: 150, type: "text" },
  { key: "living_town", label: "Living Town", width: 140, type: "text" },
  { key: "birth_place", label: "Birth Place", width: 140, type: "text" },
  { key: "country", label: "Country", width: 130, type: "text" },
  { key: "gender", label: "Gender", width: 100, type: "text" },
  { key: "religion", label: "Religion", width: 120, type: "text" },
  { key: "marital_status", label: "Marital", width: 120, type: "text" },
  { key: "age", label: "Age", width: 80, type: "number" },
  { key: "selected_by", label: "Selected By", width: 150, type: "text" },
  { key: "cv_sent_to", label: "CV Sent To", width: 150, type: "text" },
  { key: "cv_sent_date", label: "CV Sent Date", width: 140, type: "date" },
  { key: "narrative", label: "Narrative", width: 220, type: "text" },
  { key: "notes", label: "Notes", width: 220, type: "text" },
  { key: "created_at", label: "Created", width: 140, type: "readonly" },
];

export const DEFAULT_VISIBLE: ColumnKey[] = [
  "full_name", "candidate_code", "passport_number", "labour_id",
  "office", "passport_status", "coc_status",
  "medical_status", "status", "notes",
];

export const STORAGE_KEY = "staff-flow.candidates.columns.v1";
