import React, { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { Table2, Upload, AlertTriangle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { bulkImportCandidates } from "@/lib/candidates.functions";
import type { Status } from "./types";

const EXCEL_COLUMNS = [
  // NAMES & IDs
  { key: "first_name",           label: "First Name",                    required: true  },
  { key: "last_name",            label: "Last Name",                     required: true  },
  // PERSONAL
  { key: "gender",               label: "Gender",                        required: true  },
  { key: "dob",                  label: "Date of Birth (YYYY-MM-DD)",    required: false },
  { key: "religion",             label: "Religion",                      required: false },
  { key: "birth_place",          label: "Birth Place",                   required: false },
  { key: "living_town",          label: "Living Town",                   required: false },
  { key: "marital_status",       label: "Marital Status",                required: false },
  { key: "children",             label: "Children",                      required: false },
  { key: "education",            label: "Education",                     required: false },
  // PASSPORT
  { key: "passport_number",      label: "Passport Number",               required: true  },
  { key: "labour_id",            label: "Labour ID",                     required: false },
  { key: "passport_issue_date",  label: "Issue Date (YYYY-MM-DD)",       required: false },
  { key: "passport_expiry_date", label: "Expiry Date (YYYY-MM-DD)",      required: false },
  { key: "place_of_issue",       label: "Place of Issue",                required: false },
  // LANGUAGES & EXPERIENCE
  { key: "spoken_languages",     label: "Spoken Languages",              required: false },
  { key: "english_level",        label: "English Level",                 required: false },
  { key: "arabic_level",         label: "Arabic Level",                  required: false },
  { key: "experience",           label: "Work Experience",               required: false },
  { key: "experience_country",   label: "Experience Country",            required: false },
  { key: "experience_years",     label: "Years of Experience",           required: false },
  // PHYSICAL
  { key: "weight",               label: "Weight (kg)",                   required: false },
  { key: "height",               label: "Height (cm)",                   required: false },
  // STATUS
  { key: "passport_status",      label: "Passport Status",               required: false },
  { key: "medical_status",       label: "Medical Status",                required: false },
  { key: "coc_status",           label: "COC Status",                    required: false },
  { key: "musaned_status",       label: "Country",                       required: false },
  // NARRATIVE
  { key: "narrative",            label: "Narrative",                     required: false },
  { key: "narrative_phone",      label: "Narrative Phone",               required: false },
  // NOTES
  { key: "remark",               label: "Remark",                        required: false },
  { key: "notes",                label: "Notes",                         required: false },
  // PROCESSING
  { key: "contract_date",        label: "Contract Date (YYYY-MM-DD)",    required: false },
  { key: "medical_date",         label: "Medical Date (YYYY-MM-DD)",     required: false },
  { key: "tasheer_status",       label: "Tasheer Status",                required: false },
  { key: "tasheer_date",         label: "Tasheer Date (YYYY-MM-DD)",     required: false },
  { key: "wokala_status",        label: "Wokala Status",                 required: false },
  { key: "embassy_date",         label: "Embassy Date (YYYY-MM-DD)",     required: false },
  { key: "visa_status",          label: "Visa Status",                   required: false },
  { key: "insurance_status",     label: "Insurance Status",              required: false },
  { key: "lmis_status",          label: "LMIS Status",                   required: false },
  { key: "ticket_status",        label: "Ticket Status",                 required: false },
  { key: "ticket_date",          label: "Ticket Date (YYYY-MM-DD)",      required: false },
  { key: "arrival_city",         label: "Arrival City",                  required: false },
  { key: "processing_notes",     label: "Processing Notes",              required: false },
  { key: "emergency_contact",    label: "Emergency Contact",             required: false },
] as const;

type ExcelKey = (typeof EXCEL_COLUMNS)[number]["key"];

const LABEL_TO_KEY_EXACT = Object.fromEntries(
  EXCEL_COLUMNS.map(({ key, label }) => [label.toLowerCase(), key]),
) as Record<string, ExcelKey>;

function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const LABEL_TO_KEY_NORM = Object.fromEntries(
  EXCEL_COLUMNS.map(({ key, label }) => [normalizeHeader(label), key]),
) as Record<string, ExcelKey>;

const HEADER_ALIASES: Record<string, ExcelKey> = {
  firstname: "first_name", fname: "first_name", givenname: "first_name",
  lastname: "last_name", lname: "last_name", surname: "last_name", familyname: "last_name",
  dob: "dob", birthdate: "dob", bdate: "dob", dateofbirth: "dob",
  passportno: "passport_number", passportnumber: "passport_number", passportnum: "passport_number",
  passportexpiry: "passport_expiry_date", expirydate: "passport_expiry_date", expiry: "passport_expiry_date",
  passportissue: "passport_issue_date", issuedate: "passport_issue_date",
  placeofissue: "place_of_issue",
  labourid: "labour_id", laborid: "labour_id",
  passportstatus: "passport_status",
  medicalstatus: "medical_status", medical: "medical_status",
  cocstatus: "coc_status", coc: "coc_status",
  musanedstatus: "musaned_status", country: "musaned_status",
  livingtown: "living_town", town: "living_town",
  birthplace: "birth_place",
  maritalstatus: "marital_status", marital: "marital_status",
  englishlevel: "english_level", english: "english_level",
  arabiclevel: "arabic_level", arabic: "arabic_level",
  spokenlanguages: "spoken_languages", languages: "spoken_languages",
  workexperience: "experience",
  experiencecountry: "experience_country",
  yearsofexperience: "experience_years", experienceyears: "experience_years",
  weightkg: "weight",
  heightcm: "height",
  narrativephone: "narrative_phone", phone: "narrative_phone",
  contractdate: "contract_date",
  medicaldate: "medical_date",
  tasheer: "tasheer_status", tasheerStatus: "tasheer_status",
  tasheerdate: "tasheer_date",
  wokala: "wokala_status", wokalastatus: "wokala_status",
  embassydate: "embassy_date",
  visa: "visa_status", visastatus: "visa_status",
  insurance: "insurance_status", insurancestatus: "insurance_status",
  lmis: "lmis_status", lmisstatus: "lmis_status",
  ticket: "ticket_status", ticketstatus: "ticket_status",
  ticketdate: "ticket_date",
  arrivalcity: "arrival_city",
  processingnotes: "processing_notes", note: "processing_notes",
  emergencycontact: "emergency_contact",
};

function resolveHeader(header: string): ExcelKey | undefined {
  const lower = header.trim().toLowerCase();
  const norm = normalizeHeader(header);
  return LABEL_TO_KEY_EXACT[lower] ?? LABEL_TO_KEY_NORM[norm] ?? HEADER_ALIASES[norm];
}

const REQUIRED_KEYS = EXCEL_COLUMNS.filter((c) => c.required).map((c) => c.key as ExcelKey);
const DATE_KEYS = new Set<ExcelKey>([
  "dob", "passport_issue_date", "passport_expiry_date",
  "contract_date", "medical_date", "tasheer_date", "embassy_date", "ticket_date",
]);
const NUMBER_KEYS = new Set<ExcelKey>(["children", "weight", "height"]);

interface ParsedRow {
  full_name: string;
  [k: string]: unknown;
}

function formatDateValue(v: unknown): string | null {
  if (!v && v !== 0) return null;
  if (v instanceof Date) return v.toISOString().split("T")[0];
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s || null;
}

interface ParseResult { rows: ParsedRow[]; validationErrors: string[] }

function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

        const validationErrors: string[] = [];
        const rows: ParsedRow[] = raw
          .map((row, idx) => {
            const mapped: Record<string, unknown> = {};
            for (const [header, value] of Object.entries(row)) {
              const colKey = resolveHeader(header);
              if (!colKey) continue;
              const empty = value === "" || value == null;
              mapped[colKey] = DATE_KEYS.has(colKey)
                ? formatDateValue(empty ? null : value)
                : NUMBER_KEYS.has(colKey)
                  ? (empty ? null : Number(value))
                  : (empty ? null : String(value));
            }
            const first = (mapped.first_name as string | null) ?? "";
            const last  = (mapped.last_name  as string | null) ?? "";
            const full_name = [first, last].filter(Boolean).join(" ") || "";
            if (!full_name.trim()) return null;

            const missing = REQUIRED_KEYS.filter(
              (k) => k !== "first_name" && k !== "last_name" && !mapped[k],
            );
            if (missing.length > 0) {
              const labels = missing.map(
                (k) => EXCEL_COLUMNS.find((c) => c.key === k)?.label ?? k,
              );
              validationErrors.push(`Row ${idx + 2}: missing ${labels.join(", ")}`);
            }
            return { ...mapped, full_name } as ParsedRow;
          })
          .filter((r): r is ParsedRow => r !== null);

        resolve({ rows, validationErrors });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsArrayBuffer(file);
  });
}

const AVAILABLE_SAMPLE_KEYS = [
  "First Name", "Last Name", "Gender", "Date of Birth (YYYY-MM-DD)", "Religion", "Birth Place",
  "Living Town", "Marital Status", "Children", "Education", "Passport Number", "Labour ID",
  "Issue Date (YYYY-MM-DD)", "Expiry Date (YYYY-MM-DD)", "Place of Issue",
  "Spoken Languages", "English Level", "Arabic Level", "Work Experience", "Experience Country",
  "Years of Experience", "Weight (kg)", "Height (cm)", "Passport Status", "Medical Status",
  "COC Status", "Country", "Narrative", "Narrative Phone", "Remark", "Notes",
] as const;

const PROCESSING_SAMPLE_KEYS = [
  "First Name", "Last Name", "Gender", "Date of Birth (YYYY-MM-DD)", "Passport Number", "Labour ID",
  "Place of Issue", "Passport Status", "Medical Status", "Medical Date (YYYY-MM-DD)",
  "COC Status", "Country", "Narrative", "Narrative Phone",
  "Contract Date (YYYY-MM-DD)", "Tasheer Status", "Tasheer Date (YYYY-MM-DD)",
  "Wokala Status", "Embassy Date (YYYY-MM-DD)", "Visa Status",
  "Insurance Status", "LMIS Status", "Ticket Status", "Ticket Date (YYYY-MM-DD)",
  "Arrival City", "Processing Notes", "Emergency Contact", "Remark",
] as const;

const ARRIVED_SAMPLE_KEYS = [
  "First Name", "Last Name", "Gender", "Date of Birth (YYYY-MM-DD)", "Passport Number", "Labour ID",
  "Medical Status", "Country", "Contract Date (YYYY-MM-DD)", "Visa Status",
  "Ticket Date (YYYY-MM-DD)", "Arrival City", "Processing Notes", "Remark", "Notes",
] as const;

const RETURNED_SAMPLE_KEYS = [
  "First Name", "Last Name", "Gender", "Date of Birth (YYYY-MM-DD)", "Passport Number", "Labour ID",
  "Medical Status", "COC Status", "Country", "Remark", "Notes",
] as const;

const CANCELED_SAMPLE_KEYS = [
  "First Name", "Last Name", "Gender", "Date of Birth (YYYY-MM-DD)", "Passport Number", "Labour ID",
  "Medical Status", "COC Status", "Country", "Remark", "Notes",
] as const;

const STATUS_SAMPLE_KEYS: Record<Status, readonly string[]> = {
  available: AVAILABLE_SAMPLE_KEYS,
  processing: PROCESSING_SAMPLE_KEYS,
  arrived: ARRIVED_SAMPLE_KEYS,
  returned: RETURNED_SAMPLE_KEYS,
  canceled: CANCELED_SAMPLE_KEYS,
};

function makeSampleRow(keys: readonly string[], overrides: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, overrides[k] ?? ""]));
}

function downloadSampleExcel(status: Status) {
  const keys = STATUS_SAMPLE_KEYS[status];

  type SampleBase = { "First Name": string; "Last Name": string; "Gender": string; "Date of Birth (YYYY-MM-DD)": string; "Passport Number": string; "Labour ID": string };
  const bases: SampleBase[] = [
    { "First Name": "Abebe",    "Last Name": "Kebede",   "Gender": "Female", "Date of Birth (YYYY-MM-DD)": "1995-06-15", "Passport Number": "EP1234567", "Labour ID": "L-001" },
    { "First Name": "Tigist",   "Last Name": "Haile",    "Gender": "Female", "Date of Birth (YYYY-MM-DD)": "1997-03-22", "Passport Number": "EP2345678", "Labour ID": "L-002" },
    { "First Name": "Mekdes",   "Last Name": "Tadesse",  "Gender": "Female", "Date of Birth (YYYY-MM-DD)": "1993-11-08", "Passport Number": "EP3456789", "Labour ID": "L-003" },
    { "First Name": "Selam",    "Last Name": "Girma",    "Gender": "Female", "Date of Birth (YYYY-MM-DD)": "1999-05-30", "Passport Number": "EP4567890", "Labour ID": "L-004" },
    { "First Name": "Hiwot",    "Last Name": "Mulugeta", "Gender": "Female", "Date of Birth (YYYY-MM-DD)": "1991-08-14", "Passport Number": "EP5678901", "Labour ID": "L-005" },
  ];

  const statusExtra: Record<string, Record<string, unknown>[]> = {
    available: [
      { "Religion": "Muslim",    "Birth Place": "Addis Ababa", "Living Town": "Addis Ababa", "Marital Status": "Single",   "Children": 0, "Education": "High School", "Issue Date (YYYY-MM-DD)": "2022-01-10", "Expiry Date (YYYY-MM-DD)": "2027-01-09", "Place of Issue": "Addis Ababa", "Spoken Languages": "Good", "English Level": "Good",   "Arabic Level": "Basic", "Work Experience": "Yes", "Experience Country": "Saudi Arabia", "Years of Experience": "2", "Weight (kg)": 58, "Height (cm)": 162, "Passport Status": "Original", "Medical Status": "Fit",    "COC Status": "Done",   "Country": "",       "Narrative": "", "Narrative Phone": "", "Remark": "", "Notes": "" },
      { "Religion": "Christian", "Birth Place": "Bahir Dar",   "Living Town": "Bahir Dar",   "Marital Status": "Single",   "Children": 0, "Education": "Diploma",     "Issue Date (YYYY-MM-DD)": "2021-07-15", "Expiry Date (YYYY-MM-DD)": "2026-07-14", "Place of Issue": "Bahir Dar",   "Spoken Languages": "Fair", "English Level": "Fair",   "Arabic Level": "Poor",  "Work Experience": "No",  "Experience Country": "",             "Years of Experience": "",  "Weight (kg)": 55, "Height (cm)": 158, "Passport Status": "Original", "Medical Status": "Fit",    "COC Status": "No",     "Country": "",       "Narrative": "", "Narrative Phone": "", "Remark": "", "Notes": "" },
      { "Religion": "Muslim",    "Birth Place": "Dire Dawa",   "Living Town": "Dire Dawa",   "Marital Status": "Married",  "Children": 1, "Education": "Secondary",   "Issue Date (YYYY-MM-DD)": "2023-02-20", "Expiry Date (YYYY-MM-DD)": "2028-02-19", "Place of Issue": "Dire Dawa",   "Spoken Languages": "Good", "English Level": "Good",   "Arabic Level": "Fair",  "Work Experience": "Yes", "Experience Country": "Saudi Arabia", "Years of Experience": "3", "Weight (kg)": 60, "Height (cm)": 160, "Passport Status": "Original", "Medical Status": "Fit",    "COC Status": "Done",   "Country": "",       "Narrative": "", "Narrative Phone": "", "Remark": "", "Notes": "" },
      { "Religion": "Christian", "Birth Place": "Hawassa",     "Living Town": "Hawassa",     "Marital Status": "Single",   "Children": 0, "Education": "High School", "Issue Date (YYYY-MM-DD)": "2022-09-01", "Expiry Date (YYYY-MM-DD)": "2027-08-31", "Place of Issue": "Hawassa",     "Spoken Languages": "Fair", "English Level": "Fair",   "Arabic Level": "Poor",  "Work Experience": "No",  "Experience Country": "",             "Years of Experience": "",  "Weight (kg)": 52, "Height (cm)": 155, "Passport Status": "Original", "Medical Status": "Booked", "COC Status": "No",     "Country": "",       "Narrative": "", "Narrative Phone": "", "Remark": "", "Notes": "" },
      { "Religion": "Muslim",    "Birth Place": "Jimma",       "Living Town": "Addis Ababa", "Marital Status": "Divorced", "Children": 2, "Education": "Degree",      "Issue Date (YYYY-MM-DD)": "2020-04-18", "Expiry Date (YYYY-MM-DD)": "2025-04-17", "Place of Issue": "Addis Ababa", "Spoken Languages": "Good", "English Level": "Good",   "Arabic Level": "Good",  "Work Experience": "Yes", "Experience Country": "Kuwait",       "Years of Experience": "5", "Weight (kg)": 63, "Height (cm)": 164, "Passport Status": "Scan",     "Medical Status": "Fit",    "COC Status": "Done",   "Country": "Kuwait", "Narrative": "", "Narrative Phone": "", "Remark": "", "Notes": "" },
    ],
    processing: [
      { "Place of Issue": "Addis Ababa", "Passport Status": "Original", "Medical Status": "Fit",    "Medical Date (YYYY-MM-DD)": "2026-04-10", "COC Status": "Done",   "Country": "Saudi Arabia", "Narrative": "House maid", "Narrative Phone": "0911000001", "Contract Date (YYYY-MM-DD)": "2026-03-01", "Tasheer Status": "Done",    "Tasheer Date (YYYY-MM-DD)": "2026-03-15", "Wokala Status": "Paid",   "Embassy Date (YYYY-MM-DD)": "2026-04-01", "Visa Status": "Issued",            "Insurance Status": "Done", "LMIS Status": "Issued",  "Ticket Status": "Booked",  "Ticket Date (YYYY-MM-DD)": "2026-06-20", "Arrival City": "RIYADH",  "Processing Notes": "", "Emergency Contact": "0911000099", "Remark": "" },
      { "Place of Issue": "Bahir Dar",   "Passport Status": "Original", "Medical Status": "Fit",    "Medical Date (YYYY-MM-DD)": "2026-04-12", "COC Status": "Done",   "Country": "Kuwait",       "Narrative": "House maid", "Narrative Phone": "0911000002", "Contract Date (YYYY-MM-DD)": "2026-03-05", "Tasheer Status": "Done",    "Tasheer Date (YYYY-MM-DD)": "2026-03-20", "Wokala Status": "Paid",   "Embassy Date (YYYY-MM-DD)": "2026-04-05", "Visa Status": "Sent to Embassy",   "Insurance Status": "No",   "LMIS Status": "Pending", "Ticket Status": "No",      "Ticket Date (YYYY-MM-DD)": "",           "Arrival City": "",        "Processing Notes": "", "Emergency Contact": "0911000098", "Remark": "" },
      { "Place of Issue": "Dire Dawa",   "Passport Status": "Scan",     "Medical Status": "Booked", "Medical Date (YYYY-MM-DD)": "",           "COC Status": "Booked", "Country": "Saudi Arabia", "Narrative": "House maid", "Narrative Phone": "0911000003", "Contract Date (YYYY-MM-DD)": "2026-03-10", "Tasheer Status": "Booked",  "Tasheer Date (YYYY-MM-DD)": "",           "Wokala Status": "Unpaid", "Embassy Date (YYYY-MM-DD)": "",           "Visa Status": "Ready for embassy", "Insurance Status": "No",   "LMIS Status": "Draft",   "Ticket Status": "No",      "Ticket Date (YYYY-MM-DD)": "",           "Arrival City": "",        "Processing Notes": "", "Emergency Contact": "0911000097", "Remark": "" },
      { "Place of Issue": "Hawassa",     "Passport Status": "Original", "Medical Status": "Fit",    "Medical Date (YYYY-MM-DD)": "2026-05-01", "COC Status": "Done",   "Country": "UAE",          "Narrative": "House maid", "Narrative Phone": "0911000004", "Contract Date (YYYY-MM-DD)": "2026-02-20", "Tasheer Status": "No",      "Tasheer Date (YYYY-MM-DD)": "",           "Wokala Status": "Unpaid", "Embassy Date (YYYY-MM-DD)": "",           "Visa Status": "",                  "Insurance Status": "No",   "LMIS Status": "No COC",  "Ticket Status": "No",      "Ticket Date (YYYY-MM-DD)": "",           "Arrival City": "",        "Processing Notes": "", "Emergency Contact": "0911000096", "Remark": "" },
      { "Place of Issue": "Addis Ababa", "Passport Status": "Original", "Medical Status": "Fit",    "Medical Date (YYYY-MM-DD)": "2026-03-25", "COC Status": "Done",   "Country": "Saudi Arabia", "Narrative": "House maid", "Narrative Phone": "0911000005", "Contract Date (YYYY-MM-DD)": "2026-01-15", "Tasheer Status": "Ready",   "Tasheer Date (YYYY-MM-DD)": "2026-02-10", "Wokala Status": "Paid",   "Embassy Date (YYYY-MM-DD)": "2026-03-01", "Visa Status": "Issued",            "Insurance Status": "Done", "LMIS Status": "Issued",  "Ticket Status": "Ready",   "Ticket Date (YYYY-MM-DD)": "2026-06-15", "Arrival City": "JEDDAH",  "Processing Notes": "", "Emergency Contact": "0911000095", "Remark": "" },
    ],
    arrived: [
      { "Medical Status": "Fit",  "Country": "Saudi Arabia", "Contract Date (YYYY-MM-DD)": "2026-03-01", "Visa Status": "Arrived KSA", "Ticket Date (YYYY-MM-DD)": "2026-06-10", "Arrival City": "RIYADH",  "Processing Notes": "", "Remark": "", "Notes": "" },
      { "Medical Status": "Fit",  "Country": "Kuwait",       "Contract Date (YYYY-MM-DD)": "2026-03-05", "Visa Status": "Arrived KSA", "Ticket Date (YYYY-MM-DD)": "2026-06-12", "Arrival City": "JEDDAH",  "Processing Notes": "", "Remark": "", "Notes": "" },
      { "Medical Status": "Fit",  "Country": "UAE",          "Contract Date (YYYY-MM-DD)": "2026-02-20", "Visa Status": "Arrived KSA", "Ticket Date (YYYY-MM-DD)": "2026-05-30", "Arrival City": "DAMMAM",  "Processing Notes": "", "Remark": "", "Notes": "" },
      { "Medical Status": "Fit",  "Country": "Saudi Arabia", "Contract Date (YYYY-MM-DD)": "2026-01-10", "Visa Status": "Arrived KSA", "Ticket Date (YYYY-MM-DD)": "2026-04-20", "Arrival City": "RIYADH",  "Processing Notes": "", "Remark": "", "Notes": "" },
      { "Medical Status": "Fit",  "Country": "Saudi Arabia", "Contract Date (YYYY-MM-DD)": "2025-12-01", "Visa Status": "Arrived KSA", "Ticket Date (YYYY-MM-DD)": "2026-03-15", "Arrival City": "JEDDAH",  "Processing Notes": "", "Remark": "", "Notes": "" },
    ],
    returned: [
      { "Medical Status": "Fit",  "COC Status": "Done", "Country": "Saudi Arabia", "Remark": "Employer complaint", "Notes": "" },
      { "Medical Status": "Fit",  "COC Status": "Done", "Country": "Kuwait",       "Remark": "Personal reasons",   "Notes": "" },
      { "Medical Status": "Fit",  "COC Status": "No",   "Country": "UAE",          "Remark": "Contract ended",     "Notes": "" },
      { "Medical Status": "Unfit","COC Status": "No",   "Country": "Saudi Arabia", "Remark": "Health issue",       "Notes": "" },
      { "Medical Status": "Fit",  "COC Status": "Done", "Country": "Saudi Arabia", "Remark": "Runaway",            "Notes": "" },
    ],
    canceled: [
      { "Medical Status": "Unfit",   "COC Status": "No",   "Country": "",             "Remark": "Failed medical",      "Notes": "" },
      { "Medical Status": "Fit",     "COC Status": "No",   "Country": "Saudi Arabia", "Remark": "Withdrew application","Notes": "" },
      { "Medical Status": "Booked",  "COC Status": "No",   "Country": "",             "Remark": "Not reachable",       "Notes": "" },
      { "Medical Status": "Fit",     "COC Status": "Done", "Country": "Kuwait",       "Remark": "Visa canceled",       "Notes": "" },
      { "Medical Status": "Fit",     "COC Status": "No",   "Country": "",             "Remark": "Duplicate entry",     "Notes": "" },
    ],
  };

  const extras = statusExtra[status] ?? [];
  const sampleRows = bases.slice(0, extras.length).map((base, i) =>
    makeSampleRow(keys, { ...base, ...(extras[i] ?? {}) })
  );

  const usedCols = EXCEL_COLUMNS.filter((c) => keys.includes(c.label));
  const instructionsData = usedCols.map(({ label, required }) => ({
    "Column Header": label,
    "Required": required ? "YES ★" : "No",
  }));

  const ws1 = XLSX.utils.json_to_sheet(sampleRows);
  ws1["!cols"] = keys.map(() => ({ wch: 28 }));
  const ws2 = XLSX.utils.json_to_sheet(instructionsData);
  ws2["!cols"] = [{ wch: 36 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Candidates");
  XLSX.utils.book_append_sheet(wb, ws2, "Instructions");
  XLSX.writeFile(wb, `candidates_${status}_sample.xlsx`);
}

export function ImportExcelButton({ onImported, status, countryOptions }: { onImported: () => void; status: Status; countryOptions: string[] }) {
  const [revealed, setRevealed] = useState(false);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<string>(status);
  const [importCountry, setImportCountry] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const importFn = useServerFn(bulkImportCandidates);

  useEffect(() => { setImportStatus(status); }, [status]);

  const reset = () => { setRows([]); setParseError(null); setValidationErrors([]); setImportStatus(status); setImportCountry(""); };

  const handleFile = async (file: File) => {
    reset();
    try {
      const { rows: parsed, validationErrors: errs } = await parseExcelFile(file);
      if (parsed.length === 0) {
        setParseError("No valid rows found. Make sure the file uses the correct column headers (see sample).");
        return;
      }
      setRows(parsed);
      setValidationErrors(errs);
    } catch {
      setParseError("Failed to read file. Please upload a valid .xlsx or .xls file.");
    }
  };

  const handleImport = async () => {
    if (rows.length === 0 || validationErrors.length > 0) return;
    setLoading(true);
    try {
      const result = await importFn({ data: { rows: rows.map((r) => ({ ...r, status: importStatus as never, ...(importCountry ? { musaned_status: importCountry } : {}) })) as never[] } });
      toast.success(`Imported ${result.count} candidate${result.count !== 1 ? "s" : ""} successfully`);
      onImported();
      setOpen(false);
      reset();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant={revealed ? "secondary" : "ghost"}
        className="h-8 w-8 p-0 rounded-none"
        title={revealed ? "Hide Excel import" : "Show Excel import"}
        onClick={() => setRevealed((v) => !v)}
      >
        <Table2 className="h-4 w-4" />
      </Button>

      {revealed && (
        <Button
          size="sm"
          variant="outline"
          className="gap-2 text-xs h-8 rounded-none"
          onClick={() => { reset(); setOpen(true); }}
        >
          <Upload className="h-4 w-4" /> IMPORT EXCEL
        </Button>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!loading) setOpen(v); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Candidates from Excel</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
              className="border-2 border-dashed border-border rounded-none cursor-pointer hover:border-primary/60 transition-colors flex flex-col items-center justify-center gap-2 py-8 bg-muted/20 select-none"
            >
              <Upload className="h-7 w-7 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Click or drag &amp; drop an <strong>.xlsx</strong> / <strong>.xls</strong> file
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Import as status:</label>
                <Select value={importStatus} onValueChange={setImportStatus}>
                  <SelectTrigger className="h-8 text-xs rounded-none w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="arrived">Arrived</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Country:</label>
                <Select value={importCountry || "__none__"} onValueChange={(v) => setImportCountry(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs rounded-none w-40">
                    <SelectValue placeholder="— none —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— none —</SelectItem>
                    {countryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {parseError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-none">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {parseError}
              </div>
            )}

            {validationErrors.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {validationErrors.length} row{validationErrors.length !== 1 ? "s" : ""} missing required fields — fix and re-upload:
                </div>
                <ul className="text-xs text-destructive bg-destructive/10 rounded-none px-3 py-2 max-h-28 overflow-y-auto space-y-0.5 list-none">
                  {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}

            {rows.length > 0 && validationErrors.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {rows.length} candidate{rows.length !== 1 ? "s" : ""} ready to import — preview (first 5):
                </p>
                <div className="overflow-x-auto rounded-none border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">#</th>
                        <th className="px-3 py-2 text-left font-semibold">Full Name</th>
                        <th className="px-3 py-2 text-left font-semibold">Passport No.</th>
                        <th className="px-3 py-2 text-left font-semibold">Gender</th>
                        <th className="px-3 py-2 text-left font-semibold">Date of Birth</th>
                        <th className="px-3 py-2 text-left font-semibold">Expiry Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-1.5">{r.full_name}</td>
                          <td className="px-3 py-1.5">{String(r.passport_number ?? "—")}</td>
                          <td className="px-3 py-1.5">{String(r.gender ?? "—")}</td>
                          <td className="px-3 py-1.5">{String(r.dob ?? "—")}</td>
                          <td className="px-3 py-1.5">{String(r.passport_expiry_date ?? "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 5 && (
                  <p className="text-xs text-muted-foreground">…and {rows.length - 5} more</p>
                )}
              </div>
            )}

            {rows.length > 0 && validationErrors.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {rows.length} row{rows.length !== 1 ? "s" : ""} parsed — import blocked until required fields are filled.
              </p>
            )}
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-none gap-2 text-xs"
              onClick={() => downloadSampleExcel(importStatus as Status)}
              type="button"
            >
              <FileText className="h-4 w-4" /> Download Sample Excel
            </Button>
            <div className="flex gap-2 ml-auto">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-none text-xs"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="rounded-none gap-2 text-xs"
                onClick={handleImport}
                disabled={rows.length === 0 || validationErrors.length > 0 || loading}
              >
                {loading ? "Importing…" : `Import ${rows.length > 0 ? rows.length : ""} Candidate${rows.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
