import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ActionDialog } from "@/components/action-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Search, FilePlus, FileText, Pencil, Trash2, FileSignature,
  SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight,
  ArrowUpDown, Users, User, BookOpen, Stethoscope, Briefcase, FileCheck,
  Globe, Send, Activity, ClipboardPaste, Upload, ImageIcon, AlertTriangle, Table2, Loader2, Plus,
  ScanSearch,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, calcAge } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  upsertCandidate, deleteCandidate, updateCandidateField,
  bulkDeleteCandidates, bulkUpdateStatus, bulkAssignStaff, bulkUpdateField,
  bulkImportCandidates, nextCandidateCode, searchCandidates, checkWafidMedical,
  getCandidates,
} from "@/lib/candidates.functions";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { UserCheck, X, Download, Play, Undo2, Lock } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import * as XLSX from "xlsx";

type Status = "available" | "processing" | "arrived" | "canceled" | "returned";
type Candidate = Database["public"]["Tables"]["candidates"]["Row"];

export const Route = createFileRoute("/_authenticated/staff/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Staff-Flow" }] }),
  component: StaffCandidatesPage,
});

const TABS: { key: Status; label: string }[] = [
  { key: "available", label: "Available" },
  { key: "processing", label: "Processing" },
  { key: "arrived", label: "Arrived" },
  { key: "returned", label: "Returned" },
  { key: "canceled", label: "Canceled" },
];

const MEDICAL_OPTIONS = ["Fit", "Booked", "Unfit", "No", "In progress", "Expired"];
const medDaysAgo = (date: string) =>
  Math.floor((Date.now() - new Date(date + "T00:00:00").getTime()) / 86400000);
const AVAILABILITY_OPTIONS: Status[] = ["available", "processing", "arrived", "returned", "canceled"];
const COC_OPTIONS = ["Done", "No", "Booked", "Placed", "Yitazez", "Pending release"];
const MUSANED_OPTIONS: string[] = [];
const OFFICE_OPTIONS = ["Riyadh", "Jeddah", "Dammam", "Other"];
const PASSPORT_OPTIONS = ["Original", "Scan"];
const TASHEER_OPTIONS = ["No", "Booked", "Done", "Ready"];
const WOKALA_OPTIONS = ["Paid", "Unpaid"];
const VISA_OPTIONS = [
  "Ready for embassy", "Sent to Embassy", "Privately Sent", "Issued",
  "Visa canceled", "Arrived KSA", "Returned", "Waiting Replacement",
];
const INSURANCE_OPTIONS = ["No", "Done"];
const LMIS_OPTIONS = [
  "No COC", "Not tested", "Placed", "Imported", "Checked",
  "Verified", "Draft", "Pending", "Issued", "Rejected",
];
const UNFILLED_LMIS_OPTIONS = ["INSU", "COC", "ID"];
const TICKET_OPTIONS = ["No", "Ready", "New Order", "Booked", "Exchange", "Urgent", "Hold"];
const ARRIVAL_CITY_OPTIONS = ["RIYADH", "JEDDAH", "DAMMAM", "JOUF", "HAIL", "ABHA", "OTHERS"];
const BULK_FIELD_DEFS = [
  { key: "medical_status",   label: "Medical",      processingOnly: false },
  { key: "musaned_status",   label: "Country",      processingOnly: false },
  { key: "office",           label: "Office",       processingOnly: false },
  { key: "tasheer_status",   label: "Tasheer",      processingOnly: true },
  { key: "wokala_status",    label: "Wokala",       processingOnly: true },
  { key: "visa_status",      label: "Visa",         processingOnly: true },
  { key: "insurance_status", label: "Insurance",    processingOnly: true },
  { key: "unfilled_lmis",    label: "LMIS file",    processingOnly: true },
  { key: "lmis_status",      label: "LMIS",         processingOnly: true },
  { key: "ticket_status",    label: "Ticket",       processingOnly: true },
  { key: "arrival_city",     label: "Arrival City", processingOnly: true },
];

const BULK_FIELD_OPTIONS: Partial<Record<string, string[]>> = {
  tasheer_status:   TASHEER_OPTIONS,
  wokala_status:    WOKALA_OPTIONS,
  visa_status:      VISA_OPTIONS,
  insurance_status: INSURANCE_OPTIONS,
  unfilled_lmis:    UNFILLED_LMIS_OPTIONS,
  lmis_status:      LMIS_OPTIONS,
  ticket_status:    TICKET_OPTIONS,
  arrival_city:     ARRIVAL_CITY_OPTIONS,
};

const SKILLS_LIST = [
  "Cooking", "Cleaning", "Childcare", "Eldercare", "Ironing",
  "Driving", "Gardening", "Sewing", "Babysitting", "Pet Care", "Nursing",
];

const OPTION_COLORS: Record<string, string> = {
  // Medical
  "Fit":               "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "Unfit":             "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  "In progress":       "bg-white text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700",
  "Expired":           "bg-white text-orange-700 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700",
  "No":                "bg-white text-zinc-600 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-600",
  // COC / shared
  "Done":              "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "Booked":            "bg-white text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700",
  "Placed":            "bg-white text-violet-700 border border-violet-300 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-700",
  "Yitazez":           "bg-white text-orange-700 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700",
  "Pending release":   "bg-white text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700",
  // Tasheer
  "Ready":             "bg-white text-violet-700 border border-violet-300 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-700",
  // Wokala
  "Paid":              "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "Unpaid":            "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  // Visa
  "Ready for embassy": "bg-white text-sky-700 border border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-700",
  "Sent to Embassy":   "bg-white text-violet-700 border border-violet-300 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-700",
  "Privately Sent":    "bg-white text-cyan-700 border border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-700",
  "Issued":            "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "Visa canceled":     "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  "Arrived KSA":       "bg-white text-green-700 border border-green-300 dark:bg-green-950/40 dark:text-green-400 dark:border-green-700",
  "Returned":          "bg-white text-orange-700 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700",
  "Waiting Replacement":"bg-white text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700",
  // Insurance
  "Pending":           "bg-white text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700",
  // LMIS
  "No COC":            "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  "Not tested":        "bg-white text-zinc-600 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-600",
  "Imported":          "bg-white text-violet-700 border border-violet-300 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-700",
  "Checked":           "bg-white text-teal-700 border border-teal-300 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-700",
  "Verified":          "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "Draft":             "bg-white text-zinc-600 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-600",
  "Rejected":          "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  // Ticket
  "New Order":         "bg-white text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700",
  "Exchange":          "bg-white text-orange-700 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700",
  "Urgent":            "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  // Arrival city
  "RIYADH":            "bg-white text-violet-700 border border-violet-300 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-700",
  "JEDDAH":            "bg-white text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700",
  "DAMMAM":            "bg-white text-cyan-700 border border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-700",
  "JOUF":              "bg-white text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700",
  "HAIL":              "bg-white text-orange-700 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700",
  "ABHA":              "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "OTHERS":            "bg-white text-zinc-600 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-600",
  // Passport
  "Submitted":         "bg-white text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700",
  "Received":          "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  // Availability/status
  "available":         "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "processing":        "bg-white text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700",
  "arrived":           "bg-white text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700",
  "canceled":          "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  "returned":          "bg-white text-orange-700 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700",
  "private":           "bg-white text-purple-700 border border-purple-300 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-700",
  "unavailable":       "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  "Available":         "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "Private":           "bg-white text-purple-700 border border-purple-300 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-700",
  "Unavailable":       "bg-white text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-700",
  // Office
  "Riyadh":            "bg-white text-violet-700 border border-violet-300 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-700",
  "Jeddah":            "bg-white text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700",
  "Dammam":            "bg-white text-cyan-700 border border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-700",
  "Other":             "bg-white text-zinc-600 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-600",
  // Musaned
  "Saudi":             "bg-white text-green-700 border border-green-300 dark:bg-green-950/40 dark:text-green-400 dark:border-green-700",
  "Kuwait":            "bg-white text-teal-700 border border-teal-300 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-700",
  // LMIS file
  "INSU":              "bg-white text-rose-700 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-700",
  "COC":               "bg-white text-orange-700 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700",
  "ID":                "bg-white text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700",
  // Age ranges
  "18-25":             "bg-white text-sky-700 border border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-700",
  "26-35":             "bg-white text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700",
  "36-45":             "bg-white text-violet-700 border border-violet-300 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-700",
  "46-99":             "bg-white text-indigo-700 border border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-700",
  // Gender
  "Male":              "bg-white text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700",
  "Female":            "bg-white text-pink-700 border border-pink-300 dark:bg-pink-950/40 dark:text-pink-400 dark:border-pink-700",
  // Religion
  "Muslim":            "bg-white text-teal-700 border border-teal-300 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-700",
  "Non-muslim":        "bg-white text-slate-600 border border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-600",
  // Experience / Languages
  "Experienced":       "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "Non-Experienced":   "bg-white text-orange-700 border border-orange-300 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-700",
  "Yes":               "bg-white text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700",
  "None":              "bg-white text-zinc-600 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-600",
  // Sort
  "newest":            "bg-white text-sky-700 border border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-700",
  "oldest":            "bg-white text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700",
  "Not Selected":      "bg-white text-zinc-400 border border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-700",
  "Hold":              "bg-white text-rose-700 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-700",
  "":                  "bg-zinc-400 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500",
};

type ProcessingColDef =
  | { key: string; header: string; type: "text" | "date" | "copy" | "upload" }
  | { key: string; header: string; type: "select"; options: string[] }
  | { key: string; header: string; type: "select-dynamic" };

const PROCESSING_COLS: ProcessingColDef[] = [
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
  { key: "unfilled_lmis",     header: "LMIS file",     type: "select", options: UNFILLED_LMIS_OPTIONS },
  { key: "lmis_status",       header: "LMIS",              type: "select", options: LMIS_OPTIONS },
  { key: "ticket_status",     header: "Ticket",            type: "select", options: TICKET_OPTIONS },
  { key: "ticket_date",       header: "Ticket Date",       type: "date" },
  { key: "ticket_pdf_url",    header: "Ticket PDF",        type: "upload" },
  { key: "arrival_city",      header: "Arrival City",      type: "select", options: ARRIVAL_CITY_OPTIONS },
  { key: "processing_notes",  header: "Note",              type: "text" },
  { key: "emergency_contact", header: "Emergency Contact", type: "text" },
];

const CANDIDATE_CARD_COLS = [
  "FULL NAME", "CANDIDATE CODE", "PASSPORT NUMBER", "LABOUR ID",
  "AGE", "VIDEO", "MARITAL STATUS", "BIRTH PLACE",
  "NARRATIVE PHONE", "NARRATIVE", "RELIGION",
  "CV SENT TO", "CV SENT DATE",
  "PASSPORT STATUS", "COC STATUS", "COUNTRY", "MEDICAL STATUS", "MEDICAL DATE",
  "EXPERIENCE", "NOTES", "AVAILABILITY", "SELECTED BY",
  "GENDER", "LIVING TOWN", "OFFICE",
  "TICKET PDF",
] as const;

const initialForm = {
  // Names
  first_name: "",
  last_name: "",
  // Photos
  photo_url: "",
  full_photo_url: "",
  passport_scan_url: "",
  // Codes
  serial_number: "",
  candidate_code: "",
  // Personal
  gender: "",
  dob: "",
  religion: "",
  birth_place: "",
  living_town: "",
  marital_status: "",
  children: "" as string | number,
  education: "",
  occupation: "House Maid",
  country: "Ethiopian",
  // Passport
  passport_number: "",
  labour_id: "",
  passport_issue_date: "",
  passport_expiry_date: "",
  place_of_issue: "ADDIS ABABA",
  // Languages
  spoken_languages: "",
  english_level: "",
  arabic_level: "",
  // Experience & physical
  experience: "",
  experience_country: "",
  experience_years: "",
  weight: "" as string | number,
  height: "" as string | number,
  // Status
  passport_status: "",
  medical_status: "",
  coc_status: "",
  coc_agency_name: "",
  coc_agency_phone: "",
  musaned_status: "",
  status: "available" as Status,
  office: "",
  selected_by: "",
  // Narrative
  narrative: "",
  narrative_phone: "",
  // Skills (comma-separated)
  skills: "",
  // Notes
  remark: "",
  notes: "",
  video_url: "",
  availability_type: "Available",
};

const initialFilters = {
  sort: "newest",
  education: [] as string[],
  age: [] as string[],
  marital: [] as string[],
  gender: [] as string[],
  religion: [] as string[],
  medical: [] as string[],
  narrative: [] as string[],
  experience: [] as string[],
  coc: [] as string[],
  musaned: [] as string[],
  cv_sent_to: [] as string[],
  selected_by: [] as string[],
  availability: [] as string[],
  private_filter: [] as string[],
  video: [] as string[],
};

function parsePasteData(text: string): Partial<typeof initialForm> {
  const LABEL_MAP: Record<string, string | string[]> = {
    // EPRO / alternating-line labels
    "surname": "last_name",
    "given names": "first_name",
    "given name": "first_name",
    "date of birth": "dob",
    "gender": "gender",
    "marital status": "marital_status",
    "religion": "religion",
    "job": "occupation",
    "education level": "education",
    "skills": "skills",
    "id number": "labour_id",
    "mobile number": "narrative_phone",
    "phone": "narrative_phone",
    "languages": "spoken_languages",
    "number of children": "children",
    "work experience": "experience",
    "passport number": "passport_number",
    "passport issue place": "place_of_issue",
    "passport issue date": "passport_issue_date",
    "passport expiry date": "passport_expiry_date",
    "city": ["birth_place", "living_town"],
    // colon-format labels
    "first name": "first_name", "firstname": "first_name",
    "last name": "last_name", "lastname": "last_name",
    "serial number": "serial_number", "serial no": "serial_number", "serial": "serial_number",
    "candidate code": "candidate_code",
    "dob": "dob", "birth date": "dob",
    "birth place": "birth_place", "birthplace": "birth_place", "place of birth": "birth_place",
    "living town": "living_town", "place of residence": "living_town",
    "marital": "marital_status",
    "children": "children",
    "education": "education",
    "occupation": "occupation",
    "passport no": "passport_number",
    "labour id": "labour_id", "labour": "labour_id",
    "issue date": "passport_issue_date",
    "expiry date": "passport_expiry_date", "expire date": "passport_expiry_date",
    "place of issue": "place_of_issue",
    "spoken languages": "spoken_languages",
    "english level": "english_level", "english": "english_level",
    "arabic level": "arabic_level", "arabic": "arabic_level",
    "experience": "experience",
    "weight": "weight", "weight (kg)": "weight",
    "height": "height", "height (cm)": "height",
    "narrative": "narrative",
    "relative name": "narrative",
    "narrative phone": "narrative_phone",
    "relative phone": "narrative_phone",
    "remark": "remark",
    "notes": "notes",
  };

  const SKIP_VALUES = new Set(["n/a", "-", "preview", "na"]);
  const result: Record<string, string> = {};
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Detect format: if enough lines contain "key: value" use colon mode
  const colonLines = lines.filter((l) => /^[^:]+:[^:]+/.test(l)).length;

  if (colonLines > lines.length / 3) {
    // "Key: Value" per line
    for (const line of lines) {
      const idx = line.indexOf(":");
      if (idx < 1) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const val = line.slice(idx + 1).trim();
      const field = LABEL_MAP[key];
      if (field && val && !SKIP_VALUES.has(val.toLowerCase())) {
        const targets = Array.isArray(field) ? field : [field];
        for (const t of targets) result[t] = val;
      }
    }
  } else {
    // Alternating label / value lines (EPRO-style)
    for (let i = 0; i < lines.length - 1; i++) {
      const key = lines[i].toLowerCase();
      const field = LABEL_MAP[key];
      if (field) {
        const val = lines[i + 1].trim();
        i++;
        if (val && !LABEL_MAP[val.toLowerCase()] && !SKIP_VALUES.has(val.toLowerCase())) {
          const targets = Array.isArray(field) ? field : [field];
          for (const t of targets) result[t] = val;
        }
      }
    }
  }

  if (result.religion) {
    const r = result.religion.toLowerCase().trim();
    result.religion = (r === "muslim" || r === "islam" || r === "moslem") ? "Muslim" : "Non-muslim";
  }

  return result as Partial<typeof initialForm>;
}


function StaffCandidatesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const upsert          = useServerFn(upsertCandidate);
  const remove          = useServerFn(deleteCandidate);
  const bulkDel         = useServerFn(bulkDeleteCandidates);
  const bulkStatus      = useServerFn(bulkUpdateStatus);
  const bulkAssign      = useServerFn(bulkAssignStaff);
  const bulkField       = useServerFn(bulkUpdateField);
  const getNextCode     = useServerFn(nextCandidateCode);
  const fetchCandidates = useServerFn(getCandidates);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSelection = () => setSelected(new Set());
  const [actionCandidates, setActionCandidates] = useState<Candidate[]>([]);

  const [tab, setTab] = useState<Status>("available");
  const [passport, setPassport] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const activeCount = Object.entries(filters).filter(([k, v]) =>
    k !== "sort" && (Array.isArray(v) ? v.length > 0 : v && v !== "all")
  ).length;
  useEffect(() => { setFilters(initialFilters); setPassport(""); }, [tab]);

  // Global deep search
  const doSearch = useServerFn(searchCandidates);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalQ, setGlobalQ] = useState("");
  const [globalResults, setGlobalResults] = useState<Awaited<ReturnType<typeof searchCandidates>>>([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  const [globalViewCandidate, setGlobalViewCandidate] = useState<Candidate | null>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setGlobalSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (!globalSearchOpen) { setGlobalQ(""); setGlobalResults([]); return; }
    if (globalQ.length < 2) { setGlobalResults([]); return; }
    const t = setTimeout(async () => {
      setGlobalSearching(true);
      try { setGlobalResults(await doSearch({ data: { q: globalQ } })); }
      catch { /* ignore */ }
      finally { setGlobalSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [globalQ, globalSearchOpen]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [form, setForm] = useState(initialForm);
  const [processingEdit, setProcessingEdit] = useState<Candidate | null>(null);
  const [cocPlacedPending, setCocPlacedPending] = useState<{ id: string } | null>(null);
  const [cocPlacedName, setCocPlacedName] = useState("");
  const [cocPlacedPhone, setCocPlacedPhone] = useState("");
  const [lmisNeededId, setLmisNeededId] = useState<string | null>(null);
  const [lmisNeededSel, setLmisNeededSel] = useState<string[]>([]);

  const { data: candidates = [] } = useQuery({
    queryKey: ["staff-candidates", user?.id],
    enabled: !!user,
    queryFn: () => fetchCandidates({}) as Promise<Candidate[]>,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["team-staff", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id,name").eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const { data: agencyOptions = [] } = useQuery({
    queryKey: ["agencies-offices-names"],
    queryFn: async () => {
      const { data } = await supabase.from("assignment_offices").select("name").order("name");
      return (data ?? []).map((o) => o.name).filter(Boolean);
    },
  });

  const { data: assignCountries = [] } = useQuery({
    queryKey: ["assignment-countries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("assignment_countries").select("*").order("name");
      if (error) throw error;
      return data as Database["public"]["Tables"]["assignment_countries"]["Row"][];
    },
  });

  const { data: assignOffices = [] } = useQuery({
    queryKey: ["assignment-offices", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("assignment_offices").select("*").order("name");
      if (error) throw error;
      return data as Database["public"]["Tables"]["assignment_offices"]["Row"][];
    },
  });

  const { data: foreignAgencies = [] } = useQuery({
    queryKey: ["foreign-agencies-detail", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("foreign_agencies").select("name, country, contact_phone").order("name");
      if (error) throw error;
      return data as { name: string; country: string; contact_phone: string | null }[];
    },
  });

  const countryMeta = useMemo(
    () => assignCountries.map((c) => ({ name: c.name, flag: c.flag })),
    [assignCountries],
  );

  const officesByCountry = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const o of assignOffices) {
      const country = assignCountries.find((c) => c.id === o.country_id);
      if (country) {
        if (!map[country.name]) map[country.name] = [];
        map[country.name].push(o.name);
      }
    }
    return map;
  }, [assignCountries, assignOffices]);

  const agencyPhones = useMemo<Record<string, string>>(
    () => Object.fromEntries(foreignAgencies.map((a) => [a.name, a.contact_phone ?? ""])),
    [foreignAgencies],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { available: 0, processing: 0, arrived: 0, returned: 0, canceled: 0 };
    candidates.forEach((x) => { c[x.status] = (c[x.status] ?? 0) + 1; });
    return c;
  }, [candidates]);

  const updateField = useServerFn(updateCandidateField);
  const fieldMut = useMutation({
    mutationFn: async (input: { id: string; field: string; value: string | null }) =>
      updateField({ data: input as never }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["staff-candidates", user?.id] });
      const previous = qc.getQueryData<Candidate[]>(["staff-candidates", user?.id]);
      qc.setQueryData<Candidate[]>(["staff-candidates", user?.id], (old) =>
        old?.map((c) => {
          if (c.id !== input.id) return c;
          const updated = { ...c, [input.field]: input.value };
          if (input.field === "selected_by" && input.value && c.status === "available") {
            updated.status = "processing";
            if (!c.contract_date) updated.contract_date = new Date().toISOString().split("T")[0];
          }
          return updated;
        }) ?? []
      );
      return { previous };
    },
    onError: (e: Error, _, ctx) => {
      if (ctx?.previous) qc.setQueryData(["staff-candidates", user?.id], ctx.previous);
      toast.error(e.message);
    },
  });

  const resolveSelectedBy = useCallback((sel: string): { destination_country?: string; office?: string } => {
    const matchedOffice = assignOffices.find((o) => o.name === sel);
    if (matchedOffice) {
      const country = assignCountries.find((c) => c.id === matchedOffice.country_id);
      if (country) return { destination_country: country.name, office: sel };
    }
    const matchedAgency = foreignAgencies.find((a) => a.name === sel);
    if (matchedAgency) {
      const offices = officesByCountry[matchedAgency.country] ?? [];
      return {
        destination_country: matchedAgency.country,
        office: offices.length === 1 ? offices[0] : undefined,
      };
    }
    return {};
  }, [assignOffices, assignCountries, foreignAgencies, officesByCountry]);

  const handleUpdateField = useCallback((id: string, field: string, value: string | null) => {
    const target = candidates.find((c) => c.id === id);
    if (target?.visa_status === "Waiting Replacement" && field !== "visa_status" && field !== "delete_reason") {
      toast.error("Candidate is locked — Visa Status is Waiting Replacement");
      return;
    }
    fieldMut.mutate({ id, field, value });
    // When contract_date is first set, prompt for LMIS files needed
    if (field === "contract_date" && value) {
      const c = qc.getQueryData<Candidate[]>(["staff-candidates", user?.id])?.find((c) => c.id === id);
      if (c && !c.unfilled_lmis) { setLmisNeededId(id); setLmisNeededSel([]); }
    }
    if (field === "selected_by" && value) {
      const current = qc.getQueryData<Candidate[]>(["staff-candidates", user?.id])?.find((c) => c.id === id);
      if (current && !current.contract_date && !current.unfilled_lmis) { setLmisNeededId(id); setLmisNeededSel([]); }
      const fill = resolveSelectedBy(value);
      if (fill.destination_country && !current?.destination_country)
        fieldMut.mutate({ id, field: "destination_country", value: fill.destination_country });
      if (fill.office && !current?.office)
        fieldMut.mutate({ id, field: "office", value: fill.office });
    }
    if (field === "medical_status" && value !== "Fit" && value !== "Expired") {
      const current = qc.getQueryData<Candidate[]>(["staff-candidates", user?.id])?.find((c) => c.id === id);
      if (current?.medical_status === "Fit" || !value) fieldMut.mutate({ id, field: "medical_date", value: null });
    }
    if (field === "visa_status" && value === "Arrived KSA")
      fieldMut.mutate({ id, field: "status", value: "arrived" });
    if (field === "tasheer_status" && !value)
      fieldMut.mutate({ id, field: "tasheer_date", value: null });
    // Tasheer Done + Wokala Paid → Visa "Ready for embassy"
    if (field === "tasheer_status" && value === "Done") {
      const c = qc.getQueryData<Candidate[]>(["staff-candidates", user?.id])?.find((c) => c.id === id);
      if (c?.wokala_status === "Paid")
        fieldMut.mutate({ id, field: "visa_status", value: "Ready for embassy" });
    }
    if (field === "wokala_status" && value === "Paid") {
      const c = qc.getQueryData<Candidate[]>(["staff-candidates", user?.id])?.find((c) => c.id === id);
      if (c?.tasheer_status === "Done")
        fieldMut.mutate({ id, field: "visa_status", value: "Ready for embassy" });
    }
    // LMIS Issued + Visa Issued → Ticket Ready; either undone → clear Ticket
    if (field === "lmis_status") {
      const c = qc.getQueryData<Candidate[]>(["staff-candidates", user?.id])?.find((c) => c.id === id);
      if (value === "Issued" && c?.visa_status === "Issued")
        fieldMut.mutate({ id, field: "ticket_status", value: "Ready" });
      else if (value !== "Issued" && c?.ticket_status === "Ready")
        fieldMut.mutate({ id, field: "ticket_status", value: null });
    }
    if (field === "visa_status") {
      const c = qc.getQueryData<Candidate[]>(["staff-candidates", user?.id])?.find((c) => c.id === id);
      if (value === "Issued" && c?.lmis_status === "Issued")
        fieldMut.mutate({ id, field: "ticket_status", value: "Ready" });
      else if (value !== "Issued" && c?.ticket_status === "Ready")
        fieldMut.mutate({ id, field: "ticket_status", value: null });
    }
    if (field === "ticket_status" && value === "No")
      fieldMut.mutate({ id, field: "ticket_date", value: null });
  }, [fieldMut, resolveSelectedBy, qc, user?.id]);

  const handleCocAwareUpdate = useCallback((id: string, field: string, value: string | null) => {
    if (field === "coc_status" && value === "Placed") {
      setCocPlacedPending({ id });
      setCocPlacedName("");
      setCocPlacedPhone("");
      return;
    }
    handleUpdateField(id, field, value);
  }, [handleUpdateField]);

  const opts = useMemo(() => {
    const uniq = (k: keyof Candidate) =>
      Array.from(new Set(candidates.map((c) => (c[k] as string | null) ?? "").filter(Boolean))).sort();
    return {
      education: uniq("education"),
      marital: uniq("marital_status"),
      gender: uniq("gender"),
      religion: uniq("religion"),
      narrative: uniq("narrative"),
      experience: Array.from(new Set(candidates.map((c) => c.experience === "None" ? "No" : (c.experience ?? "")).filter(Boolean))).sort(),
      cv_sent_to: uniq("cv_sent_to"),
      coc: uniq("coc_status"),
      musaned: uniq("musaned_status"),
      availability: uniq("status"),
    };
  }, [candidates]);

  const passportDuplicate = useMemo(() => {
    const num = form.passport_number?.trim().toUpperCase();
    if (!num) return null;
    return candidates.find(
      (c) => c.passport_number?.trim().toUpperCase() === num && c.id !== editing?.id
    ) ?? null;
  }, [form.passport_number, candidates, editing]);

  const filtered = useMemo(() => {
    let list = candidates.filter((c) => c.status === tab);
    if (tab === "processing") {
      return [...list].sort((a, b) => {
        const ad = a.contract_date ?? "";
        const bd = b.contract_date ?? "";
        const byCd = bd.localeCompare(ad);
        if (byCd !== 0) return byCd;
        const byCreated = b.created_at.localeCompare(a.created_at);
        return byCreated !== 0 ? byCreated : a.id.localeCompare(b.id);
      });
    }
    if (passport) {
      const q = passport.toLowerCase();
      
      list = list.filter((c) =>
        (c.full_name ?? "").toLowerCase().includes(q) ||
        (c.labour_id ?? "").toLowerCase().includes(q) ||
        (c.passport_number ?? "").toLowerCase().includes(q) ||
        (c.candidate_code ?? "").toLowerCase().includes(q),
      );
    }
    if (filters.education.length > 0) list = list.filter((c) => filters.education.includes(c.education ?? ""));
    if (filters.marital.length > 0) list = list.filter((c) => filters.marital.includes(c.marital_status ?? ""));
    if (filters.gender.length > 0) list = list.filter((c) => filters.gender.includes(c.gender ?? ""));
    if (filters.religion.length > 0) list = list.filter((c) => filters.religion.includes(c.religion ?? ""));
    if (filters.medical.length > 0) list = list.filter((c) => filters.medical.includes(c.medical_status ?? ""));
    if (filters.narrative.length > 0) list = list.filter((c) => filters.narrative.includes(c.narrative ?? ""));
    if (filters.experience.length > 0) list = list.filter((c) => filters.experience.includes(c.experience === "None" ? "No" : (c.experience ?? "")));
    if (filters.coc.length > 0) list = list.filter((c) => filters.coc.includes(c.coc_status ?? ""));
    if (filters.musaned.length > 0) list = list.filter((c) => filters.musaned.includes(c.musaned_status ?? ""));
    if (filters.cv_sent_to.length > 0) list = list.filter((c) => filters.cv_sent_to.includes(c.cv_sent_to ?? ""));
    if (filters.selected_by.length > 0) list = list.filter((c) => filters.selected_by.includes(c.selected_by ?? ""));
    if (filters.availability.length > 0) list = list.filter((c) => filters.availability.includes(c.status ?? ""));
    if (tab === "available" && filters.private_filter.length > 0) {
      list = list.filter((c) => filters.private_filter.includes((c.availability_type ?? "available").toLowerCase()));
    }
    if (tab === "available" && filters.video.length > 0) {
      list = list.filter((c) => {
        const hasVideo = !!(c.video_url && (c.video_url as string).trim() !== "");
        if (filters.video.includes("yes") && hasVideo) return true;
        if (filters.video.includes("no") && !hasVideo) return true;
        return false;
      });
    }
    if (filters.age.length > 0) {
      list = list.filter((c) => {
        const age = calcAge(c.dob) ?? c.age;
        if (age == null) return false;
        return filters.age.some((range) => {
          const [min, max] = range.split("-").map(Number);
          return age >= min && age <= max;
        });
      });
    }
    list = [...list].sort((a, b) => {
      const cmp = filters.sort === "newest"
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at);
      return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
    });
    return list;
  }, [candidates, tab, passport, filters]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const fullName = [form.first_name, form.last_name].filter(Boolean).join(" ").trim() || "Unknown";
      const payload = {
        ...form,
        full_name: fullName,
        dob: form.dob || null,
        photo_url: form.photo_url || null,
        full_photo_url: form.full_photo_url || null,
        passport_scan_url: form.passport_scan_url || null,
        video_url: form.video_url || null,
        passport_issue_date: form.passport_issue_date || null,
        passport_expiry_date: form.passport_expiry_date || null,
        children: form.children === "" ? null : Number(form.children),
        weight: form.weight === "" ? null : Number(form.weight),
        height: form.height === "" ? null : Number(form.height),
      };
      return upsert({ data: { id: editing?.id, data: payload } });
    },
    onSuccess: () => {
      toast.success(editing ? "Candidate updated" : "Candidate added");
      qc.invalidateQueries({ queryKey: ["staff-candidates"] });
      setOpen(false); setEditing(null); setForm(initialForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["staff-candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: async () => bulkStatus({ data: { ids: Array.from(selected), status: "canceled" } }),
    onSuccess: (r) => {
      toast.success(`Moved ${r.count} candidate(s) to Canceled`);
      qc.invalidateQueries({ queryKey: ["staff-candidates"] });
      clearSelection();
      setTab("canceled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkStatusMut = useMutation({
    mutationFn: async (status: Status) => {
      const ids = Array.from(selected);
      const r = await bulkStatus({ data: { ids, status } });
      if (status === "processing")
        await bulkField({ data: { ids, field: "visa_status", value: null } });
      return r;
    },
    onSuccess: (r, status) => {
      toast.success(`Updated ${r.count} candidate(s)`);
      qc.invalidateQueries({ queryKey: ["staff-candidates"] });
      setTab(status);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkAssignMut = useMutation({
    mutationFn: async (staffId: string | null) =>
      bulkAssign({ data: { ids: Array.from(selected), staff_id: staffId } }),
    onSuccess: (r) => {
      toast.success(`Assigned ${r.count} candidate(s)`);
      qc.invalidateQueries({ queryKey: ["staff-candidates"] });
      clearSelection();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const BULK_FIELD_TO_FILTER: Record<string, string> = {
    medical_status: "medical",
    musaned_status: "musaned",
  };

  const bulkFieldMut = useMutation({
    onMutate: ({ field }: { field: string; value: string | null }) => {
      const prevs = Array.from(selected).map((id) => {
        const c = candidates.find((c) => c.id === id);
        return { id, value: (c ? (c[field as keyof Candidate] as string | null) : null) ?? null };
      });
      return { field, prevs };
    },
    mutationFn: ({ field, value }: { field: string; value: string | null }) => {
      const lockedIds = new Set(candidates.filter((c) => c.visa_status === "Waiting Replacement").map((c) => c.id));
      const ids = Array.from(selected).filter((id) => !lockedIds.has(id));
      if (ids.length === 0) { toast.error("All selected candidates are locked (Waiting Replacement)"); return Promise.reject(); }
      if (ids.length < selected.size) toast.warning(`${selected.size - ids.length} locked candidate(s) skipped`);
      return bulkField({ data: { ids, field: field as any, value } });
    },
    onSuccess: (r, { field, value }, context) => {
      if (context) setLastBulkOp(context);
      toast.success(`Updated ${r.count} candidate(s)`);
      qc.invalidateQueries({ queryKey: ["staff-candidates"] });
      if (field === "coc_status" && value === "Done")
        bulkField({ data: { ids: Array.from(selected), field: "lmis_status", value: "Placed" } });
      const fk = BULK_FIELD_TO_FILTER[field];
      if (fk && tab !== "available") {
        const isMulti = ["medical", "musaned"].includes(fk);
        setFilters((prev) => ({ ...prev, [fk]: isMulti ? [value] : value }));
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [ticketDateOpen, setTicketDateOpen] = useState(false);
  const [ticketDate, setTicketDate] = useState("");
  const [bulkNarrativeOpen, setBulkNarrativeOpen] = useState(false);
  const [bulkNarrativeText, setBulkNarrativeText] = useState("");
  const [bulkNarrativePhone, setBulkNarrativePhone] = useState("");
  const [lastBulkOp, setLastBulkOp] = useState<{ field: string; prevs: Array<{ id: string; value: string | null }> } | null>(null);

  const undoBulkMut = useMutation({
    mutationFn: async () => {
      if (!lastBulkOp) return;
      const groups = new Map<string | null, string[]>();
      for (const { id, value } of lastBulkOp.prevs) {
        if (!groups.has(value)) groups.set(value, []);
        groups.get(value)!.push(id);
      }
      await Promise.all(
        Array.from(groups, ([value, ids]) =>
          bulkField({ data: { ids, field: lastBulkOp.field as any, value } })
        )
      );
    },
    onSuccess: () => {
      toast.success("Undone");
      setLastBulkOp(null);
      qc.invalidateQueries({ queryKey: ["staff-candidates"] });
    },
    onError: () => toast.error("Undo failed"),
  });

  const ticketBookedMut = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      await bulkField({ data: { ids, field: "ticket_status", value: "Booked" } });
      if (ticketDate) await bulkField({ data: { ids, field: "ticket_date", value: ticketDate } });
    },
    onSuccess: () => {
      toast.success(`Updated ${selected.size} candidate(s)`);
      qc.invalidateQueries({ queryKey: ["staff-candidates"] });
      setTicketDateOpen(false);
      setTicketDate("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [visaReturnedOpen, setVisaReturnedOpen] = useState(false);
  const [visaReturnedReason, setVisaReturnedReason] = useState("");

  const visaReturnedMut = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      await bulkField({ data: { ids, field: "visa_status", value: "Returned" } });
      await bulkField({ data: { ids, field: "remark", value: visaReturnedReason.trim() } });
    },
    onSuccess: () => {
      toast.success(`Updated ${selected.size} candidate(s)`);
      qc.invalidateQueries({ queryKey: ["staff-candidates"] });
      setVisaReturnedOpen(false);
      setVisaReturnedReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [tasheerDoneOpen, setTasheerDoneOpen] = useState(false);
  const [tasheerDoneStep, setTasheerDoneStep] = useState<"ask" | "reason">("ask");
  const [tasheerDoneReason, setTasheerDoneReason] = useState("");

  const tasheerDoneMut = useMutation({
    mutationFn: async (passportAccepted: boolean) => {
      const ids = Array.from(selected);
      if (passportAccepted) {
        await bulkField({ data: { ids, field: "tasheer_status", value: "Done" } });
        await bulkField({ data: { ids, field: "passport_accepted", value: "true" } });
        await bulkField({ data: { ids, field: "wokala_status", value: "Unpaid" } });
        await bulkField({ data: { ids, field: "visa_status", value: "Ready for embassy" } });
      } else {
        await bulkField({ data: { ids, field: "tasheer_status", value: "Ready" } });
        await bulkField({ data: { ids, field: "passport_accepted", value: "false" } });
        await bulkField({ data: { ids, field: "wokala_status", value: "Unpaid" } });
      }
    },
    onSuccess: () => {
      toast.success(`Updated ${selected.size} candidate(s)`);
      qc.invalidateQueries({ queryKey: ["staff-candidates"] });
      setTasheerDoneOpen(false);
      setTasheerDoneStep("ask");
      setTasheerDoneReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [tasheerDateOpen, setTasheerDateOpen] = useState(false);
  const [tasheerDate, setTasheerDate] = useState("");

  const tasheerBookedMut = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      await bulkField({ data: { ids, field: "tasheer_status", value: "Booked" } });
      if (tasheerDate) await bulkField({ data: { ids, field: "tasheer_date", value: tasheerDate } });
    },
    onSuccess: () => {
      toast.success(`Updated ${selected.size} candidate(s)`);
      qc.invalidateQueries({ queryKey: ["staff-candidates"] });
      setTasheerDateOpen(false);
      setTasheerDate("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = async () => {
    setEditing(null);
    setForm({ ...initialForm, status: tab, candidate_code: "" });
    setOpen(true);
    try {
      const { code } = await getNextCode({});
      setForm((prev) => ({ ...prev, candidate_code: code }));
    } catch {
      // Server will auto-assign on save; leave field empty
    }
  };
  const openEdit = (c: Candidate) => {
    setEditing(c);
    setForm({
      first_name: c.first_name ?? "",
      last_name: c.last_name ?? "",
      photo_url: c.photo_url ?? "",
      full_photo_url: (c as any).full_photo_url ?? "",
      passport_scan_url: c.passport_scan_url ?? "",
      serial_number: c.serial_number ?? "",
      candidate_code: c.candidate_code ?? "",
      gender: c.gender ?? "",
      dob: c.dob ?? "",
      religion: c.religion ?? "",
      birth_place: c.birth_place ?? "",
      living_town: c.living_town ?? "",
      marital_status: c.marital_status ?? "",
      children: c.children ?? "",
      education: c.education ?? "",
      occupation: c.occupation ?? "House Maid",
      country: c.country ?? "Ethiopian",
      passport_number: c.passport_number ?? "",
      labour_id: c.labour_id ?? "",
      passport_issue_date: c.passport_issue_date ?? "",
      passport_expiry_date: c.passport_expiry_date ?? "",
      place_of_issue: c.place_of_issue ?? "ADDIS ABABA",
      spoken_languages: c.spoken_languages ?? "",
      english_level: c.english_level ?? "",
      arabic_level: c.arabic_level ?? "",
      experience: c.experience ?? "",
      experience_country: c.experience_country ?? "",
      experience_years: c.experience_years ?? "",
      weight: c.weight ?? "",
      height: c.height ?? "",
      passport_status: c.passport_status ?? "",
      medical_status: c.medical_status ?? "",
      coc_status: c.coc_status ?? "",
      coc_agency_name: (c as any).coc_agency_name ?? "",
      coc_agency_phone: (c as any).coc_agency_phone ?? "",
      musaned_status: c.musaned_status ?? "",
      status: (c.status as Status) ?? "available",
      availability_type: (() => { const v = c.availability_type ?? "Available"; return v.charAt(0).toUpperCase() + v.slice(1); })(),
      office: c.office ?? "",
      selected_by: c.selected_by ?? "",
      narrative: c.narrative ?? "",
      narrative_phone: c.narrative_phone ?? "",
      skills: c.skills ?? "",
      remark: c.remark ?? "",
      notes: c.notes ?? "",
      video_url: c.video_url ?? "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6 mx-[79.6px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Candidates</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="gap-2 text-xs h-8 rounded-none"
            disabled={selected.size === 0}
            onClick={() => {
              const sel = Array.from(selected)
                .map((id) => candidates.find((c) => c.id === id))
                .filter((c): c is Candidate => c != null);
              if (sel.length > 0) setActionCandidates(sel);
            }}
          >
            <FileSignature className="h-4 w-4" />
            Action{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
          <ImportExcelButton
            onImported={() => qc.invalidateQueries({ queryKey: ["staff-candidates"] })}
            status={tab}
            countryOptions={countryMeta.map((c) => c.name)}
          />
          {tab === "available" && (
            <Button size="sm" className="gap-2 text-xs h-8 rounded-none" onClick={openCreate}>
              <FilePlus className="h-4 w-4" /> ADD NEW CANDIDATE
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-8 rounded-none"
            onClick={() => setGlobalSearchOpen(true)}
          >
            <ScanSearch className="h-3.5 w-3.5" />
            Search
            <kbd className="ml-1 text-[10px] bg-muted px-1 py-0.5 rounded font-mono">⌘K</kbd>
          </Button>
        </div>
      </div>

      {/* Global deep-search dialog */}
      <Dialog open={globalSearchOpen} onOpenChange={(o) => { setGlobalSearchOpen(o); if (!o) { setGlobalQ(""); setGlobalResults([]); } }}>
        <DialogContent
          className="p-0 max-w-lg overflow-hidden [&>button:last-child]:hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false} className="rounded-lg">
            <CommandInput
              placeholder="Search name, passport, code, labour ID…"
              value={globalQ}
              onValueChange={setGlobalQ}
              autoFocus
            />
            <CommandList className="max-h-80">
              {globalQ.length >= 2 && !globalSearching && globalResults.length === 0 && (
                <CommandEmpty>No candidates found.</CommandEmpty>
              )}
              {globalSearching && (
                <div className="py-6 flex justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {globalResults.length > 0 && (
                <CommandGroup heading={`${globalResults.length} result${globalResults.length !== 1 ? "s" : ""}`}>
                  {globalResults.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={r.id}
                      onSelect={async () => {
                        setGlobalSearchOpen(false);
                        let toView: Candidate | null = candidates.find((c) => c.id === r.id) ?? null;
                        if (!toView) {
                          const { data } = await supabase.from("candidates").select("*").eq("id", r.id).single();
                          if (data) toView = data as Candidate;
                        }
                        if (toView) {
                          setTab(toView.status as Status);
                          setGlobalViewCandidate(toView);
                        }
                      }}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        {r.photo_url && <AvatarImage src={r.photo_url} />}
                        <AvatarFallback className="text-[10px]">
                          {(r.full_name ?? "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[r.candidate_code, r.occupation, r.country].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <StatusBadge status={r.status as Status} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Filters — hidden on Processing tab */}
      {tab !== "processing" && <>
        <Card className="rounded-none">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <span className="rounded-none bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                {activeCount}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-5">
            <FilterSelect value={filters.sort} onChange={(v) => setFilters({ ...filters, sort: v })}
              icon={ArrowUpDown}
              options={[{ value: "newest", label: "Date (Newest)" }, { value: "oldest", label: "Date (Oldest)" }]} />
            <MultiFilterSelect placeholder="Age" values={filters.age} icon={Users}
              onChange={(v) => setFilters({ ...filters, age: v })}
              options={[{ value: "18-25", label: "18-25" }, { value: "26-35", label: "26-35" }, { value: "36-45", label: "36-45" }, { value: "46-99", label: "46+" }]} />
            <MultiFilterSelect placeholder="Gender" values={filters.gender} icon={User}
              onChange={(v) => setFilters({ ...filters, gender: v })}
              options={[{ value: "", label: "Not Selected" }, { value: "Male", label: "Male" }, { value: "Female", label: "Female" }]} />
            <MultiFilterSelect placeholder="Religion" values={filters.religion} icon={BookOpen}
              onChange={(v) => setFilters({ ...filters, religion: v })}
              options={[{ value: "", label: "Not Selected" }, { value: "Muslim", label: "Muslim" }, { value: "Non-muslim", label: "Non-muslim" }]} />
            <MultiFilterSelect placeholder="Medical" values={filters.medical} icon={Stethoscope}
              onChange={(v) => setFilters({ ...filters, medical: v })}
              options={[{ value: "", label: "Not Selected" }, ...MEDICAL_OPTIONS.map((o) => ({ value: o, label: o }))]} />
            <MultiFilterSelect placeholder="Narrative" values={filters.narrative} icon={FileText}
              onChange={(v) => setFilters({ ...filters, narrative: v })}
              options={[{ value: "", label: "Not Selected" }, ...opts.narrative.map((o) => ({ value: o, label: o }))]} />
            <MultiFilterSelect placeholder="Experience" values={filters.experience} icon={Briefcase}
              onChange={(v) => setFilters({ ...filters, experience: v })}
              options={[{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }]} />
            <MultiFilterSelect placeholder="COC" values={filters.coc} icon={FileCheck}
              onChange={(v) => setFilters({ ...filters, coc: v })}
              options={[{ value: "", label: "Not Selected" }, ...["Done","No","Booked","Placed","Yitazez","Pending Release"].map((o) => ({ value: o, label: o }))]} />
            <MultiFilterSelect placeholder="Country" values={filters.musaned} icon={Globe}
              onChange={(v) => setFilters({ ...filters, musaned: v })}
              options={[{ value: "", label: "Not Selected" }, ...assignCountries.map((c) => ({ value: c.name, label: c.name }))]} />
            <MultiFilterSelect placeholder="CV Sent To" values={filters.cv_sent_to} icon={Send}
              onChange={(v) => setFilters({ ...filters, cv_sent_to: v })}
              options={[{ value: "", label: "Not Selected" }, ...agencyOptions.map((o) => ({ value: o, label: o }))]} />
            {tab === "available" ? (
              <>
                <MultiFilterSelect placeholder="Availability" values={filters.private_filter} icon={Activity}
                  onChange={(v) => setFilters({ ...filters, private_filter: v })}
                  options={[
                    { value: "available", label: "Available" },
                    { value: "private", label: "Private" },
                    { value: "unavailable", label: "Unavailable" },
                  ]} />
                <MultiFilterSelect placeholder="Video" values={filters.video} icon={Play}
                  onChange={(v) => setFilters({ ...filters, video: v })}
                  options={[
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                  ]} />
              </>
            ) : (
              <MultiFilterSelect placeholder="Availability" values={filters.availability} icon={Activity}
                onChange={(v) => setFilters({ ...filters, availability: v })}
                options={(["available", "processing", "arrived", "returned", "canceled"] as const)
                  .filter((s) => opts.availability.includes(s))
                  .map((o) => ({ value: o, label: o.charAt(0).toUpperCase() + o.slice(1) }))} />
            )}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-7 text-xs rounded-none w-52"
                placeholder="Name, Labour ID, Passport…"
                value={passport}
                onChange={(e) => setPassport(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{filtered.length}</span> candidate{filtered.length !== 1 ? "s" : ""} found</span>
            <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs font-bold text-black"
              onClick={() => { setFilters(initialFilters); setPassport(""); }}
              disabled={activeCount === 0 && !passport}>
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>
      </>}

      {/* Status tabs */}
      <Card className="rounded-none">
        <CardContent className="p-4">
          <div className="flex items-center gap-8 border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); clearSelection(); }}
                className={cn(
                  "pb-2 text-[16px] font-medium transition-colors",
                  tab === t.key
                    ? "text-primary border-b-2 border-primary -mb-px"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {visaReturnedOpen && (
        <Card className="border-rose-400/60 bg-white/60 dark:bg-rose-900/20">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-rose-800 dark:text-rose-300">
              Visa Returned — {selected.size} candidate{selected.size !== 1 ? "s" : ""}
            </span>
            <Input
              placeholder="Enter reason…"
              className="h-8 w-[260px]"
              value={visaReturnedReason}
              onChange={(e) => setVisaReturnedReason(e.target.value)}
            />
            <Button size="sm" disabled={visaReturnedMut.isPending || !visaReturnedReason.trim()} onClick={() => visaReturnedMut.mutate()}>
              {visaReturnedMut.isPending ? "Updating…" : "Apply"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setVisaReturnedOpen(false); setVisaReturnedReason(""); }}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {ticketDateOpen && (
        <Card className="border-violet-400/60 bg-white/60 dark:bg-violet-900/20">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-violet-800 dark:text-violet-300">
              Ticket Booked — {selected.size} candidate{selected.size !== 1 ? "s" : ""}
            </span>
            <Input type="date" className="h-8 w-[160px]" value={ticketDate} onChange={(e) => setTicketDate(e.target.value)} />
            <Button size="sm" disabled={ticketBookedMut.isPending || !ticketDate} onClick={() => ticketBookedMut.mutate()}>
              {ticketBookedMut.isPending ? "Updating…" : "Apply"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setTicketDateOpen(false); setTicketDate(""); }}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {tasheerDateOpen && (
        <Card className="border-amber-400/60 bg-white/60 dark:bg-amber-900/20">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Tasheer Booked — {selected.size} candidate{selected.size !== 1 ? "s" : ""}
            </span>
            <Input
              type="date"
              className="h-8 w-[160px]"
              value={tasheerDate}
              onChange={(e) => setTasheerDate(e.target.value)}
            />
            <Button size="sm" disabled={tasheerBookedMut.isPending || !tasheerDate} onClick={() => tasheerBookedMut.mutate()}>
              {tasheerBookedMut.isPending ? "Updating…" : "Apply"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setTasheerDateOpen(false); setTasheerDate(""); }}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {bulkNarrativeOpen && (
        <Card className="border-blue-400/60 bg-white/60 dark:bg-blue-900/20">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">
              Narrative — {selected.size} candidate{selected.size !== 1 ? "s" : ""}
            </span>
            <Input
              placeholder="Narrative text…"
              className="h-8 w-[220px]"
              value={bulkNarrativeText}
              onChange={(e) => setBulkNarrativeText(e.target.value)}
              list="bulk-narrative-suggestions"
            />
            <datalist id="bulk-narrative-suggestions">
              {opts.narrative.map((n) => <option key={n} value={n} />)}
            </datalist>
            <Input
              placeholder="Narrative phone…"
              className="h-8 w-[160px]"
              value={bulkNarrativePhone}
              onChange={(e) => setBulkNarrativePhone(e.target.value)}
            />
            <Button
              size="sm"
              disabled={bulkFieldMut.isPending || !bulkNarrativeText.trim()}
              onClick={async () => {
                await bulkFieldMut.mutateAsync({ field: "narrative", value: bulkNarrativeText.trim() });
                if (bulkNarrativePhone.trim())
                  await bulkFieldMut.mutateAsync({ field: "narrative_phone", value: bulkNarrativePhone.trim() });
                setBulkNarrativeOpen(false);
                setBulkNarrativeText("");
                setBulkNarrativePhone("");
              }}
            >
              {bulkFieldMut.isPending ? "Updating…" : "Apply"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setBulkNarrativeOpen(false); setBulkNarrativeText(""); setBulkNarrativePhone(""); }}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Bulk actions */}
      {(selected.size > 0 || !!lastBulkOp) && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            {selected.size > 0 && <span className="text-sm font-semibold pl-1">{selected.size} selected</span>}
            <div className="ml-auto flex flex-wrap items-center gap-2">
            {selected.size > 0 && (<>
              <Select onValueChange={(v) => bulkStatusMut.mutate(v as Status)}>
                <SelectTrigger className="h-9 w-[150px]">
                  <SelectValue placeholder="Status…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="arrived">Arrived</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>

              {BULK_FIELD_DEFS.filter((fd) => {
                if ((fd as any).availableOnly) return tab === "available";
                return fd.processingOnly === (tab === "processing");
              }).map((fd) => {
                const staticOpts = BULK_FIELD_OPTIONS[fd.key]
                  ?? (fd.key === "musaned_status" ? countryMeta.map((c) => c.name) : undefined)
                  ?? (fd.key === "cv_sent_to" ? agencyOptions : undefined);
                const opts = staticOpts ?? Array.from(new Set(
                  filtered.map((c) => (c[fd.key as keyof Candidate] as string | null) ?? "").filter(Boolean)
                )).sort();
                if (opts.length === 0) return null;
                return (
                  <Select key={fd.key} onValueChange={(v) => {
                    if (v === "__clear__") {
                      bulkFieldMut.mutateAsync({ field: fd.key, value: null })
                        .then(() => { if (fd.key === "visa_status") bulkFieldMut.mutate({ field: "embassy_date", value: null }); });
                      return;
                    }
                    if (fd.key === "ticket_status" && v === "Booked") { setTicketDateOpen(true); }
                    else if (fd.key === "tasheer_status" && v === "Booked") { setTasheerDateOpen(true); }
                    else if (fd.key === "tasheer_status" && v === "Done") {
                      setTasheerDoneOpen(true); setTasheerDoneStep("ask"); setTasheerDoneReason("");
                    }
                    else if (fd.key === "visa_status" && v === "Returned") {
                      const blocked = candidates.filter((c) => selected.has(c.id) && (c.status !== "processing" || c.tasheer_status !== "Done" || (c.wokala_status !== "Paid" && c.passport_accepted !== true))).length;
                      if (blocked > 0) { toast.error(`${blocked} candidate(s) must be Processing with Tasheer = Done and either Passport Accepted or Wokala = Paid`); }
                      else { setVisaReturnedOpen(true); setVisaReturnedReason(""); }
                    }
                    else if (fd.key === "visa_status" && v === "Ready for embassy") {
                      const blocked = candidates.filter((c) => selected.has(c.id) && (c.status !== "processing" || c.tasheer_status !== "Done" || (c.wokala_status !== "Paid" && c.passport_accepted !== true)));
                      if (blocked.length > 0) { toast.error(`${blocked.length} candidate(s) must be Processing with Tasheer = Done and either Passport Accepted or Wokala = Paid`); }
                      else { bulkFieldMut.mutate({ field: fd.key, value: v }); }
                    }
                    else if (fd.key === "visa_status" && v === "Sent to Embassy") {
                      const today = new Date().toISOString().split("T")[0];
                      bulkFieldMut.mutateAsync({ field: "visa_status", value: v })
                        .then(() => bulkFieldMut.mutate({ field: "embassy_date", value: today }));
                    }
                    else { bulkFieldMut.mutate({ field: fd.key, value: v }); }
                  }}>
                    <SelectTrigger className="h-9 w-[120px]">
                      <SelectValue placeholder={fd.label} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__clear__" className="text-muted-foreground">-</SelectItem>
                      {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                );
              })}

              <Button
                size="sm" variant="outline" className="gap-1"
                onClick={() => { setBulkNarrativeOpen(true); setBulkNarrativeText(""); setBulkNarrativePhone(""); }}
              >
                Narrative
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1"
                disabled={bulkDeleteMut.isPending}
                onClick={() => {
                  if (confirm(`Delete ${selected.size} candidate(s)? This cannot be undone.`))
                    bulkDeleteMut.mutate();
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
              <Button size="sm" variant="ghost" className="gap-1" onClick={clearSelection}>
                <X className="h-4 w-4" /> Clear
              </Button>
            </>)}
            {lastBulkOp && (
              <Button size="sm" variant="outline" className="gap-1" disabled={undoBulkMut.isPending} onClick={() => undoBulkMut.mutate()}>
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </Button>
            )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Candidate cards / Processing table */}
      {tab === "processing" ? (
        <ProcessingTable
          candidates={filtered}
          selected={selected}
          onToggleSelect={toggleSelect}
          onAction={(c) => setActionCandidates([c])}
          onUpdateField={(id, field, value) => {
            fieldMut.mutate({ id, field, value });
            if (field === "coc_status" && value === "Done")
              fieldMut.mutate({ id, field: "lmis_status", value: "Placed" });
            if (field === "medical_status" && value === "Fit")
              fieldMut.mutate({ id, field: "lmis_status", value: "Not tested" });
            if (field === "medical_status" && value !== "Fit" && value !== "Expired") {
              const c = qc.getQueryData<Candidate[]>(["staff-candidates", user?.id])?.find((c) => c.id === id);
              if (c?.medical_status === "Fit" || !value) fieldMut.mutate({ id, field: "medical_date", value: null });
            }
            if (field === "visa_status" && value === "Arrived KSA")
              fieldMut.mutate({ id, field: "status", value: "arrived" });
            if (field === "tasheer_status" && (value === "No" || !value)) {
              fieldMut.mutate({ id, field: "wokala_status", value: null });
              fieldMut.mutate({ id, field: "tasheer_date", value: null });
              fieldMut.mutate({ id, field: "visa_status", value: null });
              fieldMut.mutate({ id, field: "embassy_date", value: null });
            }
            // Tasheer Done + Wokala Paid → Visa "Ready for embassy"
            if (field === "tasheer_status" && value === "Done") {
              const c = qc.getQueryData<Candidate[]>(["staff-candidates", user?.id])?.find((c) => c.id === id);
              if (c?.wokala_status === "Paid")
                fieldMut.mutate({ id, field: "visa_status", value: "Ready for embassy" });
            }
            if (field === "wokala_status" && value === "Paid") {
              const c = qc.getQueryData<Candidate[]>(["staff-candidates", user?.id])?.find((c) => c.id === id);
              if (c?.tasheer_status === "Done")
                fieldMut.mutate({ id, field: "visa_status", value: "Ready for embassy" });
            }
            // LMIS Issued + Visa Issued → Ticket Ready; either undone → clear Ticket
            if (field === "lmis_status") {
              const c = qc.getQueryData<Candidate[]>(["staff-candidates", user?.id])?.find((c) => c.id === id);
              if (value === "Issued" && c?.visa_status === "Issued")
                fieldMut.mutate({ id, field: "ticket_status", value: "Ready" });
              else if (value !== "Issued" && c?.ticket_status === "Ready")
                fieldMut.mutate({ id, field: "ticket_status", value: null });
            }
            if (field === "visa_status") {
              const c = qc.getQueryData<Candidate[]>(["staff-candidates", user?.id])?.find((c) => c.id === id);
              if (value === "Issued" && c?.lmis_status === "Issued")
                fieldMut.mutate({ id, field: "ticket_status", value: "Ready" });
              else if (value !== "Issued" && c?.ticket_status === "Ready")
                fieldMut.mutate({ id, field: "ticket_status", value: null });
            }
          }}
          onEdit={(c) => setProcessingEdit(c)}
          cancelMode
          onDelete={(id) => fieldMut.mutate({ id, field: "status", value: "canceled" })}
          countryMeta={countryMeta}
          officesByCountry={officesByCountry}
          agencyPhones={agencyPhones}
          agencyOptions={agencyOptions}
        />
      ) : (
        <CandidateCardList
          candidates={filtered}
          selected={selected}
          onToggleSelect={toggleSelect}
          onAction={(c) => setActionCandidates([c])}
          onEdit={openEdit}
          compact={tab === "arrived" || tab === "returned"}
          onDelete={(id) => fieldMut.mutate({ id, field: "status", value: "canceled" })}
          onUpdateField={handleCocAwareUpdate}
          onReturn={tab === "arrived" ? (id) => fieldMut.mutate({ id, field: "status", value: "returned" }) : undefined}
          onUndo={
            (tab === "arrived" || tab === "returned" || tab === "canceled")
              ? (id, c) => {
                  const prev =
                    tab === "arrived" ? "processing" :
                    tab === "returned" ? "arrived" :
                    (c as any).visa_status ? "processing" : "available";
                  fieldMut.mutate({ id, field: "status", value: prev });
                }
              : undefined
          }
          countryMeta={countryMeta}
          officesByCountry={officesByCountry}
          agencyOptions={agencyOptions}
          agencyPhones={agencyPhones}
          narrativeSuggestions={opts.narrative}
        />
      )}

      {cocPlacedPending && (
        <Dialog open onOpenChange={(o) => { if (!o) setCocPlacedPending(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>COC Placed — Agency Details</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Enter the agency name and phone number for this placement.</p>
            <div className="space-y-3 py-2">
              <Input
                placeholder="Agency Name"
                value={cocPlacedName}
                onChange={(e) => setCocPlacedName(e.target.value)}
                className="rounded-none h-9"
              />
              <Input
                placeholder="Phone Number"
                value={cocPlacedPhone}
                onChange={(e) => setCocPlacedPhone(e.target.value)}
                className="rounded-none h-9"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCocPlacedPending(null)}>Cancel</Button>
              <Button
                disabled={!cocPlacedName.trim() || !cocPlacedPhone.trim()}
                onClick={() => {
                  const { id } = cocPlacedPending;
                  handleUpdateField(id, "coc_status", "Placed");
                  handleUpdateField(id, "coc_agency_name", cocPlacedName.trim());
                  handleUpdateField(id, "coc_agency_phone", cocPlacedPhone.trim());
                  setCocPlacedPending(null);
                }}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle>{editing ? "Edit candidate" : "Add new candidate"}</DialogTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-7 rounded-none"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    const parsed = parsePasteData(text);
                    if (Object.keys(parsed).length === 0) {
                      toast.info("No matching data found in clipboard");
                      return;
                    }
                    setForm((f) => ({ ...f, ...parsed }));
                  } catch {
                    toast.error("Clipboard access denied");
                  }
                }}
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                Paste Data
              </Button>
            </div>
          </DialogHeader>

          <div className="max-h-[62vh] overflow-y-auto pr-2 space-y-5">
            {/* Photos */}
            <div className="grid grid-cols-3 gap-3">
              <PhotoUpload
                label="Photo"
                value={form.photo_url}
                onChange={(url) => setForm((f) => ({ ...f, photo_url: url }))}
              />
              <PhotoUpload
                label="Full Size Photo"
                value={form.full_photo_url}
                onChange={(url) => setForm((f) => ({ ...f, full_photo_url: url }))}
              />
              <PhotoUpload
                label="Passport Scan"
                value={form.passport_scan_url}
                onChange={(url) => setForm((f) => ({ ...f, passport_scan_url: url }))}
                accept="image/*,application/pdf"
              />
            </div>

            {/* Names & IDs */}
            <FormSection title="Names & IDs" required>
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name *" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} />
                <Field label="Last Name *" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} />
                <Field label="Candidate Code" placeholder="Auto-generated" value={form.candidate_code} onChange={(v) => setForm({ ...form, candidate_code: v })} />
              </div>
            </FormSection>

            {/* Personal */}
            <FormSection title="Personal" required>
              <div className="grid grid-cols-2 gap-3">
                <FormSelect label="Gender *" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} options={["Male", "Female"]} />
                <Field label="Date of Birth *" type="date" value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} />
                <FormSelect label="Religion *" value={form.religion} onChange={(v) => setForm({ ...form, religion: v })} options={["Muslim", "Non-muslim"]} />
                <Field label="Birth Place *" value={form.birth_place} onChange={(v) => setForm({ ...form, birth_place: v })} />
                <Field label="Living Town *" value={form.living_town} onChange={(v) => setForm({ ...form, living_town: v })} />
                <FormSelect label="Marital Status *" value={form.marital_status} onChange={(v) => setForm({ ...form, marital_status: v })} options={["Single", "Married", "Divorced", "Widowed"]} />
                <Field label="Children" type="number" value={String(form.children)} onChange={(v) => setForm({ ...form, children: v })} />
                <FormSelect label="Education *" value={form.education} onChange={(v) => setForm({ ...form, education: v })} options={["Illiterate", "Primary", "Secondary", "High School", "Diploma", "Degree", "Master's", "PhD"]} />
              </div>
            </FormSection>

            {/* Passport */}
            <FormSection title="Passport" required>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Field label="Passport Number *" value={form.passport_number} onChange={(v) => setForm({ ...form, passport_number: v })} />
                  {passportDuplicate && (
                    <p className="text-[11px] text-destructive font-medium flex items-center gap-1">
                      ⚠ Duplicate — {passportDuplicate.full_name}{passportDuplicate.candidate_code ? ` (${passportDuplicate.candidate_code})` : ""} is already registered with this passport number
                    </p>
                  )}
                </div>
                <Field label="Labour ID *" value={form.labour_id} onChange={(v) => setForm({ ...form, labour_id: v.toUpperCase() })} placeholder="EF/EM + 8 chars" maxLength={10} />
                <Field label="Issue Date *" type="date" value={form.passport_issue_date} onChange={(v) => setForm({ ...form, passport_issue_date: v })} />
                <Field label="Expiry Date *" type="date" value={form.passport_expiry_date} onChange={(v) => setForm({ ...form, passport_expiry_date: v })} />
                <div className="col-span-2">
                  <Field label="Place of Issue" value={form.place_of_issue} onChange={(v) => setForm({ ...form, place_of_issue: v })} />
                </div>
              </div>
            </FormSection>

            {/* Languages & Experience */}
            <FormSection title="Languages & Experience">
              <div className="grid grid-cols-2 gap-3">
                <FormSelect label="Spoken Languages" value={form.spoken_languages} onChange={(v) => setForm({ ...form, spoken_languages: v })} options={["Poor", "Little", "Fair", "Good"]} />
                <FormSelect label="English Level" value={form.english_level} onChange={(v) => setForm({ ...form, english_level: v })} options={["Poor", "Little", "Fair", "Good"]} />
                <FormSelect label="Arabic Level" value={form.arabic_level} onChange={(v) => setForm({ ...form, arabic_level: v })} options={["Poor", "Little", "Fair", "Good"]} />
                <FormSelect label="Work Experience *" value={form.experience} onChange={(v) => setForm({ ...form, experience: v, experience_country: v !== "Yes" ? "" : form.experience_country, experience_years: v !== "Yes" ? "" : form.experience_years })} options={["Yes", "No"]} />
              </div>
              {form.experience === "Yes" && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <FormSelect label="Experience Country" value={form.experience_country} onChange={(v) => setForm({ ...form, experience_country: v })} options={assignCountries.map((c) => c.name)} />
                  <Field label="Years of Experience" value={form.experience_years} onChange={(v) => setForm({ ...form, experience_years: v })} type="number" />
                </div>
              )}
            </FormSection>

            {/* Physical */}
            <FormSection title="Physical">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Weight (kg)" type="number" value={String(form.weight)} onChange={(v) => setForm({ ...form, weight: v })} />
                <Field label="Height (cm)" type="number" value={String(form.height)} onChange={(v) => setForm({ ...form, height: v })} />
              </div>
            </FormSection>

            {/* Skills */}
            <FormSection title="Skills">
              {(() => {
                const skillSet = new Set((form.skills ?? "").split(",").map((s) => s.trim()).filter(Boolean));
                return (
                  <div className="flex flex-wrap gap-2">
                    {SKILLS_LIST.map((skill) => {
                      const checked = skillSet.has(skill);
                      return (
                        <label
                          key={skill}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-none border cursor-pointer text-xs transition-colors",
                            checked ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const s = new Set(skillSet);
                              v ? s.add(skill) : s.delete(skill);
                              setForm({ ...form, skills: Array.from(s).join(", ") });
                            }}
                          />
                          {skill}
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </FormSection>

            {/* Status */}
            <FormSection title="Status">
              <div className="grid grid-cols-2 gap-3">
                <FormSelect label="Passport Status *" value={form.passport_status} onChange={(v) => setForm({ ...form, passport_status: v })} options={PASSPORT_OPTIONS} />
                <FormSelect label="Medical Status *" value={form.medical_status} onChange={(v) => setForm({ ...form, medical_status: v })} options={MEDICAL_OPTIONS} />
                <div>
                  <FormSelect label="COC Status *" value={form.coc_status} onChange={(v) => setForm({ ...form, coc_status: v })} options={COC_OPTIONS} />
                  {form.coc_status === "Placed" && (
                    <div className="mt-2 space-y-1.5">
                      <Input
                        placeholder="Agency Name"
                        value={form.coc_agency_name}
                        onChange={(e) => setForm({ ...form, coc_agency_name: e.target.value })}
                        className="rounded-none h-8 text-xs"
                      />
                      <Input
                        placeholder="Phone Number"
                        value={form.coc_agency_phone}
                        onChange={(e) => setForm({ ...form, coc_agency_phone: e.target.value })}
                        className="rounded-none h-8 text-xs"
                      />
                    </div>
                  )}
                </div>
                <FormSelect label="Country *" value={form.musaned_status} onChange={(v) => setForm({ ...form, musaned_status: v })} options={assignCountries.map((c) => c.name)} />
                <FormSelect label="Availability" value={form.availability_type} onChange={(v) => setForm({ ...form, availability_type: v })} options={["Available", "Private", "Unavailable"]} />
              </div>
            </FormSection>

            {/* Narrative */}
            <FormSection title="Narrative">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Narrative" value={form.narrative} onChange={(v) => setForm({ ...form, narrative: v })} suggestions={opts.narrative} />
                <Field label="Narrative Phone" value={form.narrative_phone} onChange={(v) => setForm({ ...form, narrative_phone: v })} />
              </div>
            </FormSection>

            {/* Notes */}
            <FormSection title="Notes">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Remark</Label>
                  <Textarea rows={2} value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} className="rounded-none text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-none text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Video URL</Label>
                  <input
                    type="url"
                    value={form.video_url}
                    onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                    placeholder="https://…"
                    className="w-full rounded-none border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            </FormSection>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!form.first_name?.trim() && !form.last_name?.trim()) {
                  toast.error("First Name or Last Name is required"); return;
                }
                if (!form.gender || !form.dob || !form.religion) {
                  toast.error("Gender, Date of Birth and Religion are required"); return;
                }
                if (!form.birth_place?.trim() || !form.living_town?.trim()) {
                  toast.error("Birth Place and Living Town are required"); return;
                }
                if (!form.marital_status || !form.education) {
                  toast.error("Marital Status and Education are required"); return;
                }
                if (!form.passport_number?.trim() || !form.passport_expiry_date) {
                  toast.error("Passport Number and Expiry Date are required"); return;
                }
                if (!form.labour_id?.trim() || !form.passport_issue_date) {
                  toast.error("Labour ID and Issue Date are required"); return;
                }
                if (!/^(EF|EM)[A-Z0-9]{8}$/i.test(form.labour_id.trim())) {
                  toast.error("Labour ID must be 10 characters starting with EF or EM followed by 8 characters"); return;
                }
                if (!form.experience) {
                  toast.error("Work Experience is required"); return;
                }
                if (!form.passport_status || !form.medical_status || !form.coc_status || !form.musaned_status) {
                  toast.error("Passport Status, Medical Status, COC Status and Country are required"); return;
                }
                if (passportDuplicate) {
                  toast.error(`Duplicate passport number — ${passportDuplicate.full_name}${passportDuplicate.candidate_code ? ` (${passportDuplicate.candidate_code})` : ""} is already registered with this passport number`);
                  return;
                }
                saveMut.mutate();
              }}
              disabled={saveMut.isPending}
            >
              {saveMut.isPending ? "Saving..." : editing ? "Save changes" : "Add candidate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {processingEdit && (
        <ProcessingEditDialog
          candidate={processingEdit}
          onClose={() => setProcessingEdit(null)}
          onUpdateField={(field, value) => handleUpdateField(processingEdit.id, field, value)}
          agencyOptions={agencyOptions}
          countryOptions={countryMeta.map((c) => c.name)}
          officesByCountry={officesByCountry}
          narrativeSuggestions={opts.narrative}
        />
      )}
      {actionCandidates.length > 0 && (
        <ActionDialog candidates={actionCandidates} onClose={() => setActionCandidates([])} />
      )}

      {/* LMIS files needed prompt */}
      {lmisNeededId && (
        <Dialog open onOpenChange={(o) => { if (!o) setLmisNeededId(null); }}>
          <DialogContent className="max-w-sm rounded-none">
            <DialogHeader>
              <DialogTitle>LMIS Files Required?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Which LMIS files are needed for this candidate?</p>
            <div className="flex flex-col gap-2 pt-1">
              {UNFILLED_LMIS_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={lmisNeededSel.includes(opt)}
                    onChange={(e) =>
                      setLmisNeededSel((prev) =>
                        e.target.checked ? [...prev, opt] : prev.filter((x) => x !== opt)
                      )
                    }
                  />
                  <span className="text-sm font-medium">{opt}</span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setLmisNeededId(null)}>Skip</Button>
              <Button
                onClick={() => {
                  if (lmisNeededSel.length > 0)
                    fieldMut.mutate({ id: lmisNeededId, field: "unfilled_lmis", value: lmisNeededSel.join(", ") });
                  setLmisNeededId(null);
                }}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Tasheer Done — embassy readiness dialog */}
      <Dialog open={tasheerDoneOpen} onOpenChange={(o) => { if (!o) { setTasheerDoneOpen(false); setTasheerDoneStep("ask"); setTasheerDoneReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Passport Accepted?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tasheer is Done for <strong>{selected.size}</strong> candidate{selected.size !== 1 ? "s" : ""}.
            Is the passport accepted?
          </p>
          <DialogFooter className="flex gap-2 sm:justify-start">
            <Button disabled={tasheerDoneMut.isPending} onClick={() => tasheerDoneMut.mutate(true)}>
              {tasheerDoneMut.isPending ? "Updating…" : "Yes — Accepted"}
            </Button>
            <Button variant="outline" disabled={tasheerDoneMut.isPending} onClick={() => tasheerDoneMut.mutate(false)}>
              {tasheerDoneMut.isPending ? "Updating…" : "No — Not Accepted"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Global search — candidate detail viewer */}
      <CandidateDetailDialog
        candidate={globalViewCandidate}
        onClose={() => setGlobalViewCandidate(null)}
        agencyPhones={agencyPhones}
      />

    </div>
  );
}

function ProcessingEditDialog({
  candidate, onClose, onUpdateField, agencyOptions, countryOptions, officesByCountry, narrativeSuggestions,
}: {
  candidate: Candidate;
  onClose: () => void;
  onUpdateField: (field: string, value: string | null) => void;
  agencyOptions: string[];
  countryOptions: string[];
  officesByCountry: Record<string, string[]>;
  narrativeSuggestions?: string[];
}) {
  const init = {
    passport_number:   candidate.passport_number   ?? "",
    labour_id:         candidate.labour_id         ?? "",
    narrative:         candidate.narrative         ?? "",
    narrative_phone:   candidate.narrative_phone   ?? "",
    contract_date:     candidate.contract_date     ?? "",
    medical_status:    candidate.medical_status    ?? "",
    medical_date:      candidate.medical_date      ?? "",
    medical_days:      (candidate as any).medical_days      ?? "",
    coc_status:        candidate.coc_status        ?? "",
    tasheer_status:    candidate.tasheer_status    ?? "",
    tasheer_date:      candidate.tasheer_date      ?? "",
    wokala_status:     candidate.wokala_status     ?? "",
    embassy_date:      (candidate as any).embassy_date      ?? "",
    visa_status:       candidate.visa_status       ?? "",
    insurance_status:  candidate.insurance_status  ?? "",
    unfilled_lmis:     candidate.unfilled_lmis     ?? "",
    lmis_status:       candidate.lmis_status       ?? "",
    ticket_status:     candidate.ticket_status     ?? "",
    ticket_date:       candidate.ticket_date       ?? "",
    arrival_city:      candidate.arrival_city      ?? "",
    processing_notes:  (candidate as any).processing_notes  ?? "",
    emergency_contact: (candidate as any).emergency_contact ?? "",
    destination_country: candidate.destination_country ?? "",
    office:            candidate.office            ?? "",
  };
  const [form, setForm] = useState(init);
  const set = (k: keyof typeof init) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function handleSave() {
    const saved = { ...form };
    if (saved.medical_status === "Fit") {
      const dateToCheck = saved.medical_date || init.medical_date;
      if (dateToCheck && medDaysAgo(dateToCheck) >= 90) {
        saved.medical_status = "Expired";
        toast.error("Medical date is over 90 days ago — status set to Expired");
      }
    }
    for (const key of Object.keys(init) as (keyof typeof init)[]) {
      if (saved[key] !== init[key]) onUpdateField(key, saved[key] || null);
    }
    onClose();
  }

  const ProcSelect = ({ label, k, options }: { label: string; k: keyof typeof init; options: string[] }) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select value={form[k]} onChange={(e) => set(k)(e.target.value)}
        className="w-full rounded-none border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  const ProcInput = ({ label, k, type = "text", suggestions }: { label: string; k: keyof typeof init; type?: string; suggestions?: string[] }) => {
    const hasSugg = (suggestions?.length ?? 0) > 0;
    const listId = `proc-input-${k}-list`;
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <Input type={type} value={form[k]} onChange={(e) => set(k)(e.target.value)}
          className="rounded-none h-8 text-sm" list={hasSugg ? listId : undefined} />
        {hasSugg && <datalist id={listId}>{suggestions!.map((s) => <option key={s} value={s} />)}</datalist>}
      </div>
    );
  };

  const isLocked = candidate.visa_status === "Waiting Replacement";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Edit Processing — {candidate.full_name}</DialogTitle>
        </DialogHeader>
        {isLocked && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-none bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300 text-sm">
            🔒 This candidate is locked — Visa Status is <strong>Waiting Replacement</strong>.
          </div>
        )}
        <div className={cn("max-h-[65vh] overflow-y-auto pr-1 space-y-4", isLocked && "pointer-events-none opacity-50")}>
          <div className="grid grid-cols-2 gap-3">
            <ProcInput label="Passport No" k="passport_number" />
            <ProcInput label="Labour ID" k="labour_id" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ProcInput label="Narrative" k="narrative" suggestions={narrativeSuggestions} />
            <ProcInput label="Narrative Phone" k="narrative_phone" />
            <ProcInput label="Contract Date" k="contract_date" type="date" />
            <ProcInput label="Emergency Contact" k="emergency_contact" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ProcSelect label="Medical Status" k="medical_status" options={MEDICAL_OPTIONS} />
            <ProcInput label="Medical Date" k="medical_date" type="date" />
            <ProcInput label="Medical Days" k="medical_days" />
            <ProcSelect label="COC Status" k="coc_status" options={COC_OPTIONS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ProcSelect label="Tasheer" k="tasheer_status" options={TASHEER_OPTIONS} />
            <ProcInput label="Tasheer Date" k="tasheer_date" type="date" />
            <ProcSelect label="Wokala" k="wokala_status" options={WOKALA_OPTIONS} />
            <ProcInput label="Embassy Date" k="embassy_date" type="date" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ProcSelect label="Visa Status" k="visa_status" options={VISA_OPTIONS} />
            <ProcSelect label="Insurance" k="insurance_status" options={INSURANCE_OPTIONS} />
            <ProcSelect label="LMIS file" k="unfilled_lmis" options={UNFILLED_LMIS_OPTIONS} />
            <ProcSelect label="LMIS" k="lmis_status" options={LMIS_OPTIONS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ProcSelect label="Ticket" k="ticket_status" options={TICKET_OPTIONS} />
            <ProcInput label="Ticket Date" k="ticket_date" type="date" />
            <ProcSelect label="Arrival City" k="arrival_city" options={ARRIVAL_CITY_OPTIONS} />
            <ProcInput label="Processing Note" k="processing_notes" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">TICKET FILES</label>
            <div className="grid grid-cols-3 gap-3">
              <LmisDocSection
                label="Ticket PDF"
                url={(candidate as any).ticket_pdf_url ?? ""}
                onUpload={async (f) => {
                  const ext = f.name.split(".").pop() ?? "pdf";
                  const path = `ticket-pdfs/${candidate.id}/ticket_${Date.now()}.${ext}`;
                  const { error } = await supabase.storage.from("candidate-files").upload(path, f, { upsert: true });
                  if (error) throw error;
                  const { data } = supabase.storage.from("candidate-files").getPublicUrl(path);
                  onUpdateField("ticket_pdf_url", data.publicUrl);
                }}
                onRemove={() => onUpdateField("ticket_pdf_url", null)}
              />
              <LmisDocSection
                label="QR"
                url={(candidate as any).qr_url ?? ""}
                onUpload={async (f) => {
                  const ext = f.name.split(".").pop() ?? "pdf";
                  const path = `ticket-pdfs/${candidate.id}/qr_${Date.now()}.${ext}`;
                  const { error } = await supabase.storage.from("candidate-files").upload(path, f, { upsert: true });
                  if (error) throw error;
                  const { data } = supabase.storage.from("candidate-files").getPublicUrl(path);
                  onUpdateField("qr_url", data.publicUrl);
                }}
                onRemove={() => onUpdateField("qr_url", null)}
              />
              <LmisDocSection
                label="Visa"
                url={(candidate as any).visa_pdf_url ?? ""}
                onUpload={async (f) => {
                  const ext = f.name.split(".").pop() ?? "pdf";
                  const path = `ticket-pdfs/${candidate.id}/visa_${Date.now()}.${ext}`;
                  const { error } = await supabase.storage.from("candidate-files").upload(path, f, { upsert: true });
                  if (error) throw error;
                  const { data } = supabase.storage.from("candidate-files").getPublicUrl(path);
                  onUpdateField("visa_pdf_url", data.publicUrl);
                }}
                onRemove={() => onUpdateField("visa_pdf_url", null)}
              />
            </div>
          </div>
          {countryOptions.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <ProcSelect label="Country" k="destination_country" options={countryOptions} />
              <ProcSelect label="Office" k="office" options={officesByCountry[form.destination_country] ?? []} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isLocked}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type EditableField =
  | "notes" | "narrative" | "occupation" | "living_town" | "selected_by"
  | "medical_status" | "status" | "office" | "passport_status"
  | "musaned_status" | "coc_status"
  | "passport_number" | "labour_id"
  | "narrative_phone" | "contract_date" | "medical_date" | "medical_days"
  | "tasheer_status" | "tasheer_date" | "wokala_status" | "embassy_date"
  | "visa_status" | "insurance_status" | "unfilled_lmis" | "lmis_status"
  | "ticket_status" | "ticket_date" | "arrival_city" | "emergency_contact"
  | "processing_notes" | "remark" | "cv_sent_to" | "coc_agency_name" | "coc_agency_phone" | "insurance_date"
  | "availability_type" | "video_url" | "ticket_pdf_url" | "visa_pdf_url" | "qr_url"
  | "return_ticket_url" | "stamp_url";

function CandidateCardList({
  candidates, selected, onToggleSelect, onAction, onEdit, onDelete, onUpdateField, cancelMode, onReturn, onUndo,
  countryMeta, officesByCountry, agencyOptions, agencyPhones, compact, narrativeSuggestions,
}: {
  candidates: Candidate[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onAction: (c: Candidate) => void;
  onEdit: (c: Candidate) => void;
  onDelete: (id: string) => void;
  onUpdateField: (id: string, field: string, value: string | null) => void;
  cancelMode?: boolean;
  compact?: boolean;
  onReturn?: (id: string) => void;
  onUndo?: (id: string, c: Candidate) => void;
  countryMeta: Array<{ name: string; flag: string }>;
  officesByCountry: Record<string, string[]>;
  agencyOptions: string[];
  agencyPhones: Record<string, string>;
  narrativeSuggestions?: string[];
}) {
  const [viewingPhotos, setViewingPhotos] = useState<Candidate | null>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    try {
      const s = sessionStorage.getItem("stf-hidden-cols-avail");
      if (s) return new Set(JSON.parse(s));
    } catch {}
    return new Set(["GENDER", "LIVING TOWN", "OFFICE", "TICKET PDF"]);
  });
  useEffect(() => {
    sessionStorage.setItem("stf-hidden-cols-avail", JSON.stringify(Array.from(hiddenCols)));
  }, [hiddenCols]);
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showColPicker) return;
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node))
        setShowColPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColPicker]);
  const [activeCountryTab, setActiveCountryTab] = useState("all");
  const [activeOfficeTab, setActiveOfficeTab] = useState("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    const mirror = mirrorRef.current;
    if (!el) return;
    const sync = () => {
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
      if (fadeRef.current) fadeRef.current.style.opacity = (!atEnd && el.scrollWidth > el.clientWidth) ? "1" : "0";
      if (mirror) mirror.scrollLeft = el.scrollLeft;
    };
    const syncWidth = () => {
      if (mirror) {
        const inner = mirror.firstElementChild as HTMLElement;
        if (inner) inner.style.width = el.scrollWidth + "px";
      }
    };
    const onMirrorScroll = () => { if (mirror) el.scrollLeft = mirror.scrollLeft; };
    sync(); syncWidth();
    const raf = requestAnimationFrame(() => { sync(); syncWidth(); });
    el.addEventListener("scroll", sync, { passive: true });
    if (mirror) mirror.addEventListener("scroll", onMirrorScroll, { passive: true });
    const ro = new ResizeObserver(() => { sync(); syncWidth(); });
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => { cancelAnimationFrame(raf); el.removeEventListener("scroll", sync); mirror?.removeEventListener("scroll", onMirrorScroll); ro.disconnect(); };
  }, []);
  const countryOptions = useMemo(() => countryMeta.map((c) => c.name), [countryMeta]);

  useEffect(() => {
    for (const c of candidates) {
      if (c.medical_status === "Fit" && c.medical_date && medDaysAgo(c.medical_date) >= 90) {
        onUpdateField(c.id, "medical_status", "Expired");
      }
    }
  }, [candidates]);

  const matchesCountry = (c: Candidate, country: string) =>
    c.destination_country === country || c.musaned_status === country;

  const filtered = useMemo(() => {
    let list = candidates;
    if (activeCountryTab !== "all") list = list.filter((c) => matchesCountry(c, activeCountryTab));
    if (activeOfficeTab !== "all") list = list.filter((c) => c.office === activeOfficeTab);
    return list;
  }, [candidates, activeCountryTab, activeOfficeTab]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  useEffect(() => { setPage(1); }, [filtered.length, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const allSel = paginated.length > 0 && paginated.every((c) => selected.has(c.id));
  const someSel = !allSel && paginated.some((c) => selected.has(c.id));
  const visibleCols = (CANDIDATE_CARD_COLS as readonly string[]).filter((l) => {
    if (l === "TICKET PDF") return !!compact;
    if (hiddenCols.has(l)) return false;
    return true;
  });

  return (
    <div className="space-y-2">
      {countryMeta.length > 0 && (
        <Card className="rounded-none">
          <CardContent className="px-3 py-2">
            <div className="flex items-center gap-1 flex-wrap">
              <button type="button"
                onClick={() => { setActiveCountryTab("all"); setActiveOfficeTab("all"); }}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-none border transition-colors",
                  activeCountryTab === "all"
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40")}>
                All ({candidates.length})
              </button>
              {countryMeta.map((c) => {
                const count = candidates.filter((cand) => matchesCountry(cand, c.name)).length;
                return (
                  <button key={c.name} type="button"
                    onClick={() => { setActiveCountryTab(activeCountryTab === c.name ? "all" : c.name); setActiveOfficeTab("all"); }}
                    className={cn("px-3 py-1.5 text-xs font-medium rounded-none border transition-colors flex items-center gap-1.5",
                      activeCountryTab === c.name
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40")}>
                    <span>{c.flag}</span>{c.name}<span className="opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      {activeCountryTab !== "all" && (officesByCountry[activeCountryTab] ?? []).length > 0 && (
        <Card className="rounded-none">
          <CardContent className="px-3 py-2">
            <div className="flex items-center gap-1 flex-wrap">
              <button type="button" onClick={() => setActiveOfficeTab("all")}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-none border transition-colors",
                  activeOfficeTab === "all"
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40")}>
                All offices
              </button>
              {(officesByCountry[activeCountryTab] ?? []).map((office) => {
                const count = candidates.filter((c) => matchesCountry(c, activeCountryTab) && c.office === office).length;
                return (
                  <button key={office} type="button"
                    onClick={() => setActiveOfficeTab(activeOfficeTab === office ? "all" : office)}
                    className={cn("px-3 py-1.5 text-xs font-medium rounded-none border transition-colors flex items-center gap-1.5",
                      activeOfficeTab === office
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40")}>
                    {office}<span className="opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={allSel ? true : someSel ? "indeterminate" : false}
              onCheckedChange={(v) =>
                paginated.forEach((c) => { if (!!v !== selected.has(c.id)) onToggleSelect(c.id); })
              }
            />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>
          <div className="flex items-center gap-1">
            {hiddenCols.size > 0 && (
              <Button
                size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground"
                onClick={() => setHiddenCols(new Set())}
              >
                <RotateCcw className="h-3 w-3" /> Reset columns
              </Button>
            )}
            <div className="relative" ref={colPickerRef}>
              <Button
                size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                onClick={() => setShowColPicker((v) => !v)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Columns
                {hiddenCols.size > 0 && (
                  <span className="ml-1 rounded-none bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                    {hiddenCols.size} hidden
                  </span>
                )}
              </Button>
              {showColPicker && (
                <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-none shadow-xl p-3 w-[340px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Columns</span>
                    <button type="button" onClick={() => setHiddenCols(new Set())}
                      className="text-[11px] text-primary hover:underline disabled:opacity-40"
                      disabled={hiddenCols.size === 0}>
                      Reset
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {CANDIDATE_CARD_COLS.filter((l) => l !== "TICKET PDF" || compact).map((label) => (
                      <label key={label} className="flex items-center gap-1.5 text-xs cursor-pointer py-1 hover:text-primary">
                        <Checkbox
                          checked={!hiddenCols.has(label)}
                          onCheckedChange={(v) =>
                            setHiddenCols((prev) => { const n = new Set(prev); v ? n.delete(label) : n.add(label); return n; })
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">No candidates here yet.</CardContent></Card>
      ) : (
        <div className="relative">
          <div ref={scrollRef} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-2 min-w-max">
              {paginated.map((c) => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  selected={selected.has(c.id)}
                  visibleCols={visibleCols}
                  cancelMode={cancelMode}
                  compact={compact}
                  onToggleSelect={() => onToggleSelect(c.id)}
                  onViewPhotos={() => setViewingPhotos(c)}
                  onAction={() => onAction(c)}
                  onEdit={() => onEdit(c)}
                  onDelete={() => onDelete(c.id)}
                  onUpdateField={(field, value) => onUpdateField(c.id, field, value)}
                  onReturn={onReturn ? () => onReturn(c.id) : undefined}
                  onUndo={onUndo ? () => onUndo(c.id, c) : undefined}
                  agencyOptions={agencyOptions}
                  agencyPhones={agencyPhones}
                  countryOptions={countryOptions}
                  narrativeSuggestions={narrativeSuggestions}
                />
              ))}
            </div>
          </div>
          <div ref={fadeRef} aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent opacity-0 transition-opacity duration-200" />
        </div>
      )}
      <CandidatePhotosDialog candidate={viewingPhotos} onClose={() => setViewingPhotos(null)} />
      {filtered.length > 0 && (
        <div className="sticky bottom-0 z-10 bg-background shadow-[0_-1px_3px_rgba(0,0,0,0.06)]">
          <div ref={mirrorRef} className="w-full" style={{ overflowX: "scroll", overflowY: "hidden", height: 16 }}><div style={{ height: 1 }} /></div>
          <div className="flex items-center justify-between px-4 py-2 flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-none" disabled={page === 1}
              onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .map((n, i, arr) => (
                <React.Fragment key={n}>
                  {i > 0 && n - arr[i - 1] > 1 && <span className="text-xs text-muted-foreground px-0.5">…</span>}
                  <Button size="sm" variant={page === n ? "default" : "outline"}
                    className="h-7 w-7 p-0 rounded-none text-xs"
                    onClick={() => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                    {n}
                  </Button>
                </React.Fragment>
              ))}
            <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-none" disabled={page === totalPages}
              onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            {[5, 10, 50, 100, 500].map((s) => (
              <Button key={s} size="sm" variant={pageSize === s ? "default" : "outline"}
                className="h-7 px-2 rounded-none text-xs"
                onClick={() => { setPageSize(s); setPage(1); }}>
                {s}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
            </span>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs font-bold text-black"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <ChevronUp className="h-3.5 w-3.5" /> Back to top
            </Button>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoCell({ url, onSave, candidateName }: { url: string | null; onSave: (v: string | null) => void; candidateName: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(url ?? "");
  const [dlLoading, setDlLoading] = useState(false);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onSave(draft.trim() || null); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(url ?? ""); setEditing(false); }
        }}
        placeholder="Paste video URL…"
        className="rounded-none border border-primary bg-background px-1 py-0.5 text-[12px] outline-none w-[80px]"
      />
    );
  }

  if (url) {
    const fileName = `${candidateName}.mp4`;
    const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
    const downloadUrl = gdMatch
      ? `https://drive.google.com/uc?export=download&id=${gdMatch[1]}`
      : url;

    const handleDownload = async () => {
      if (gdMatch) {
        window.open(downloadUrl, "_blank");
        return;
      }
      if (dlLoading) return;
      setDlLoading(true);
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      } catch {
        window.open(url, "_blank");
      } finally {
        setDlLoading(false);
      }
    };
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => window.open(url, "_blank")}
            className="flex items-center gap-0.5 text-[11px] text-primary hover:underline font-medium">
            <Play className="h-3 w-3 fill-current" /> Play
          </button>
          <button type="button" onClick={handleDownload} disabled={dlLoading}
            className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50">
            {dlLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          </button>
        </div>
        <button type="button" onClick={() => { setDraft(url); setEditing(true); }}
          className="text-[10px] text-muted-foreground hover:underline text-left">
          Change
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)}
      className="text-[11px] text-muted-foreground hover:text-foreground rounded-none px-1 -mx-1 py-0.5 hover:bg-muted/60 hover:ring-1 hover:ring-border block">
      Add URL
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-[13px] text-foreground">{value || "—"}</span>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">{title}</h3>
      <div className="grid grid-cols-3 gap-x-6 gap-y-3">{children}</div>
    </div>
  );
}

function CandidateDetailDialog({ candidate, onClose, agencyPhones = {} }: { candidate: Candidate | null; onClose: () => void; agencyPhones?: Record<string, string> }) {
  if (!candidate) return null;
  const statusStyles: Record<Status, string> = {
    available: "bg-emerald-400 text-emerald-800",
    processing: "bg-amber-400 text-amber-800",
    arrived: "bg-blue-400 text-blue-800",
    canceled: "bg-red-400 text-red-800",
    returned: "bg-orange-400 text-orange-800",
  };
  const statusKey = (candidate.status as Status) ?? "available";
  return (
    <Dialog open={!!candidate} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{candidate.full_name}</span>
            {candidate.candidate_code && (
              <span className="text-xs font-mono font-normal text-muted-foreground">{candidate.candidate_code}</span>
            )}
            <span className={cn("ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-none capitalize", statusStyles[statusKey])}>
              {statusKey}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-5">
          {(candidate.photo_url || (candidate as any).full_photo_url || candidate.passport_scan_url) && (
            <div className="flex gap-3">
              {candidate.photo_url && (
                <div className="flex flex-col items-center gap-1">
                  <img src={candidate.photo_url} alt="Photo" className="h-24 w-20 object-cover border border-border" />
                  <span className="text-[10px] text-muted-foreground">Photo</span>
                </div>
              )}
              {(candidate as any).full_photo_url && (
                <div className="flex flex-col items-center gap-1">
                  <img src={(candidate as any).full_photo_url} alt="Full Photo" className="h-24 w-20 object-cover border border-border" />
                  <span className="text-[10px] text-muted-foreground">Full Photo</span>
                </div>
              )}
              {candidate.passport_scan_url && (
                <div className="flex flex-col items-center gap-1">
                  <img src={candidate.passport_scan_url} alt="Passport" className="h-24 w-20 object-cover border border-border" />
                  <span className="text-[10px] text-muted-foreground">Passport Scan</span>
                </div>
              )}
            </div>
          )}
          <DetailSection title="Personal">
            <InfoRow label="Full Name" value={candidate.full_name} />
            <InfoRow label="First Name" value={candidate.first_name} />
            <InfoRow label="Last Name" value={candidate.last_name} />
            <InfoRow label="Date of Birth" value={candidate.dob} />
            <InfoRow label="Age" value={calcAge(candidate.dob) ?? candidate.age} />
            <InfoRow label="Gender" value={candidate.gender} />
            <InfoRow label="Religion" value={candidate.religion} />
            <InfoRow label="Marital Status" value={candidate.marital_status} />
            <InfoRow label="Children" value={candidate.children} />
            <InfoRow label="Birth Place" value={candidate.birth_place} />
            <InfoRow label="Living Town" value={candidate.living_town} />
            <InfoRow label="Country" value={candidate.country} />
            <InfoRow label="Occupation" value={candidate.occupation} />
            <InfoRow label="Education" value={candidate.education} />
            <InfoRow label="Experience" value={candidate.experience === "None" ? "No" : candidate.experience} />
          </DetailSection>
          <DetailSection title="Passport">
            <InfoRow label="Passport Number" value={candidate.passport_number} />
            <InfoRow label="Passport Status" value={candidate.passport_status} />
            <InfoRow label="Issue Date" value={candidate.passport_issue_date} />
            <InfoRow label="Expiry Date" value={candidate.passport_expiry_date} />
            <InfoRow label="Place of Issue" value={candidate.place_of_issue} />
            <InfoRow label="Labour ID" value={candidate.labour_id} />
          </DetailSection>
          <DetailSection title="Languages & Physical">
            <InfoRow label="Spoken Languages" value={candidate.spoken_languages} />
            <InfoRow label="English Level" value={candidate.english_level} />
            <InfoRow label="Arabic Level" value={candidate.arabic_level} />
            <InfoRow label="Weight (kg)" value={candidate.weight} />
            <InfoRow label="Height (cm)" value={candidate.height} />
          </DetailSection>
          <DetailSection title="Status">
            <InfoRow label="Medical Status" value={candidate.medical_status} />
            <InfoRow label="Medical Date" value={candidate.medical_date} />
            <InfoRow label="COC Status" value={candidate.coc_status} />
            <InfoRow label="Country" value={candidate.musaned_status} />
            <InfoRow label="Passport Status" value={candidate.passport_status} />
            <InfoRow label="Office" value={candidate.office} />
            <InfoRow label="Selected By" value={candidate.selected_by} />
            <InfoRow label="Contract Date" value={candidate.contract_date} />
            <InfoRow label="CV Sent To" value={candidate.cv_sent_to} />
            <InfoRow label="CV Sent Date" value={candidate.cv_sent_date} />
            <InfoRow label="Narrative" value={candidate.narrative} />
            <InfoRow label="Narrative Phone" value={candidate.narrative_phone} />
          </DetailSection>
          <DetailSection title="Logistics & Processing">
            <InfoRow label="Tasheer Status" value={candidate.tasheer_status} />
            <InfoRow label="Tasheer Date" value={candidate.tasheer_date} />
            <InfoRow label="Wokala Status" value={candidate.wokala_status} />
            <InfoRow label="Visa Status" value={candidate.visa_status} />
            <InfoRow label="Ticket Status" value={candidate.ticket_status} />
            <InfoRow label="Ticket Date" value={candidate.ticket_date} />
            <InfoRow label="Arrival City" value={candidate.arrival_city} />
            <InfoRow label="LMIS Status" value={candidate.lmis_status} />
            <InfoRow label="Insurance" value={candidate.insurance_status} />
          </DetailSection>
          {(candidate.skills || candidate.notes || candidate.remark) && (
            <DetailSection title="Other">
              {candidate.skills && <div className="col-span-3"><InfoRow label="Skills" value={candidate.skills} /></div>}
              {candidate.notes && <div className="col-span-3"><InfoRow label="Notes" value={candidate.notes} /></div>}
              {candidate.remark && <div className="col-span-3"><InfoRow label="Remark" value={candidate.remark} /></div>}
            </DetailSection>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {candidate.video_url && (
            <Button variant="outline" className="gap-1.5" onClick={() => {
              const url = candidate.video_url!;
              const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
              window.open(gdMatch ? `https://drive.google.com/uc?export=download&id=${gdMatch[1]}` : url, "_blank");
            }}>
              <Play className="h-4 w-4" /> Video
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CandidateCard({
  candidate, selected, visibleCols, onToggleSelect, onViewPhotos, onAction, onEdit, onDelete, onUpdateField, cancelMode, onReturn, onUndo, agencyOptions, agencyPhones, countryOptions, compact, narrativeSuggestions,
}: {
  candidate: Candidate;
  selected: boolean;
  visibleCols: readonly string[];
  cancelMode?: boolean;
  compact?: boolean;
  onToggleSelect: () => void;
  onViewPhotos: () => void;
  onAction: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateField: (field: EditableField, value: string | null) => void;
  onReturn?: () => void;
  onUndo?: () => void;
  agencyOptions: string[];
  agencyPhones: Record<string, string>;
  countryOptions: string[];
  narrativeSuggestions?: string[];
}) {
  const qcCard = useQueryClient();
  const checkWafidFn = useServerFn(checkWafidMedical);
  const [wafidChecking, setWafidChecking] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [deleteRequestOpen, setDeleteRequestOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [medDateOpen, setMedDateOpen] = useState(false);
  const [pendingMedDate, setPendingMedDate] = useState("");
  const [cocEditOpen, setCocEditOpen] = useState(false);
  const [cocEditName, setCocEditName] = useState("");
  const [cocEditPhone, setCocEditPhone] = useState("");
  const [ticketFilesOpen, setTicketFilesOpen] = useState(false);
  const statusKey = (["available","processing","arrived","canceled","returned"].includes(candidate.status ?? "")
    ? candidate.status : "available") as Status;

  type FieldDef =
    | { label: string; value: string; bold?: boolean; copy?: boolean }
    | { label: string; value: string; edit: "text"; field: EditableField; long?: boolean }
    | { label: string; value: string; edit: "date"; field: EditableField; display?: string; showDays?: boolean }
    | { label: string; value: string; edit: "select"; field: EditableField; options: string[] };

  const allFields: FieldDef[] = [
    { label: "FULL NAME", value: candidate.full_name, bold: true },
    { label: "CANDIDATE CODE", value: candidate.candidate_code ?? "—" },
    { label: "GENDER", value: candidate.gender ?? "—" },
    { label: "AGE", value: String(calcAge(candidate.dob) ?? candidate.age ?? "—") },
    { label: "RELIGION", value: candidate.religion ?? "—" },
    { label: "MARITAL STATUS", value: candidate.marital_status ?? "—" },
    { label: "BIRTH PLACE", value: candidate.birth_place ?? "—" },
    { label: "LIVING TOWN", value: candidate.living_town ?? "", edit: "text", field: "living_town" },
    { label: "PASSPORT NUMBER", value: candidate.passport_number ?? "—", copy: true },
    { label: "LABOUR ID", value: candidate.labour_id ?? "—", copy: true },
    { label: "OFFICE", value: candidate.office ?? "", edit: "select", field: "office", options: OFFICE_OPTIONS },
    { label: "PASSPORT STATUS", value: candidate.passport_status ?? "", edit: "select", field: "passport_status", options: PASSPORT_OPTIONS },
    { label: "COC STATUS", value: candidate.coc_status ?? "", edit: "select", field: "coc_status", options: COC_OPTIONS },
    { label: "COUNTRY", value: candidate.musaned_status ?? "", edit: "select", field: "musaned_status", options: countryOptions },
    { label: "MEDICAL STATUS", value: candidate.medical_status ?? "", edit: "select", field: "medical_status", options: MEDICAL_OPTIONS },
    { label: "MEDICAL DATE", value: candidate.medical_date ?? "", edit: "date", field: "medical_date", display: candidate.medical_date && candidate.medical_status === "Fit" ? `${Math.max(1, Math.floor((Date.now() - new Date(candidate.medical_date + "T00:00:00").getTime()) / 86400000))} days ago` : undefined },
    { label: "EXPERIENCE", value: (candidate.experience === "None" ? "No" : candidate.experience) ?? "—" },
    ...(candidate.experience === "Yes" ? [
      { label: "EXPERIENCE COUNTRY", value: candidate.experience_country ?? "—" },
      { label: "EXPERIENCE YEARS", value: candidate.experience_years ?? "—" },
    ] : []),
    { label: "AVAILABILITY", value: (() => { const v = candidate.availability_type ?? "available"; return v.charAt(0).toUpperCase() + v.slice(1); })(), edit: "select", field: "availability_type", options: ["Available", "Private", "Unavailable"] },

    { label: "SELECTED BY", value: candidate.selected_by ?? "", edit: "select", field: "selected_by", options: agencyOptions },
    { label: "CONTRACT DATE", value: candidate.contract_date ? (() => { const d = new Date(candidate.contract_date + "T00:00:00"); const days = Math.floor((Date.now() - d.getTime()) / 86_400_000); return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) + ` (${days} day${days !== 1 ? "s" : ""})`; })() : "" },
    { label: "CV SENT TO", value: agencyOptions.includes(candidate.cv_sent_to ?? "") ? candidate.cv_sent_to ?? "" : "" },
    { label: "CV SENT DATE", value: agencyOptions.includes(candidate.cv_sent_to ?? "") && candidate.cv_sent_date ? new Date(candidate.cv_sent_date).toLocaleDateString() : "—" },
    { label: "NARRATIVE", value: candidate.narrative ?? "", edit: "text", field: "narrative", long: true },
    { label: "NARRATIVE PHONE", value: candidate.narrative_phone ?? "", edit: "text", field: "narrative_phone" },
    { label: "NOTES", value: candidate.notes ?? "", edit: "text", field: "notes", long: true },
  ];

  return (
    <>
      <div
        className={cn("border border-border shadow-sm rounded-sm transition-colors", selected && "ring-1 ring-primary/50")}
        style={{ background: selected ? "var(--selected-bg)" : "var(--card)" }}
      >
        {/* Status badge + checkbox — sticky left */}
        <div className="sticky left-0 z-10 w-fit flex items-center gap-2 px-4 pt-2.5 pb-1" style={{ background: selected ? "var(--selected-bg)" : "var(--card)" }}>
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Select candidate" disabled={candidate.visa_status === "Waiting Replacement"} />
          <StatusBadge status={candidate.status ?? "available"} />
          {candidate.availability_type?.toLowerCase() === "private" && (
            <span className="inline-flex items-center rounded-sm bg-purple-400 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-[10px] font-semibold px-1.5 py-0.5 leading-none">
              Private
            </span>
          )}
          {candidate.availability_type?.toLowerCase() === "unavailable" && (
            <span className="inline-flex items-center rounded-sm bg-red-400 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px] font-semibold px-1.5 py-0.5 leading-none">
              Unavailable
            </span>
          )}
          {candidate.medical_status && (
            <span className={cn(
              "inline-flex items-center gap-0.5 rounded-sm text-[10px] font-semibold px-1.5 py-0.5 leading-none",
              candidate.medical_status === "Fit"         && "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
              candidate.medical_status === "Unfit"       && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
              candidate.medical_status === "Expired"     && "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
              candidate.medical_status === "Booked"      && "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
              candidate.medical_status === "In progress" && "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
              candidate.medical_status === "No"          && "bg-muted text-muted-foreground",
            )}>
              <Stethoscope className="h-2.5 w-2.5" />
              {candidate.medical_status}
            </span>
          )}
        </div>
        {/* Main content row */}
        <div className="flex items-center pb-3 pt-1">
          {/* Sticky left: photo + full name */}
          <div className="sticky left-0 z-10 shrink-0 self-stretch flex items-center gap-4 pl-4 pr-3" style={{ background: selected ? "var(--selected-bg)" : "var(--card)" }}>
            <button type="button" onClick={onViewPhotos} className="shrink-0">
              <Avatar className={cn("hover:ring-2 hover:ring-primary transition-all", compact ? "h-10 w-10" : "h-14 w-14")}>
                {candidate.photo_url && <AvatarImage src={candidate.photo_url} alt={candidate.full_name} />}
                <AvatarFallback className="text-[11px]">{candidate.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </button>
            <div className="shrink-0 w-[110px]">
              <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1 whitespace-nowrap">FULL NAME</div>
              <span className={cn("text-sm font-semibold break-words", compact ? "line-clamp-1" : "line-clamp-2")}>{candidate.full_name || "—"}</span>
            </div>
          </div>
          {/* Field columns (FULL NAME rendered in sticky section above) */}
          <div className={cn("flex-1 flex items-start gap-2", candidate.visa_status === "Waiting Replacement" && "pointer-events-none opacity-60")}>
            {visibleCols.map((colLabel) => {
              if (colLabel === "FULL NAME") return null;
              if (colLabel === "VIDEO") {
                return (
                  <div key="VIDEO" className="shrink-0 w-[110px]">
                    <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1 whitespace-nowrap">VIDEO</div>
                    <VideoCell url={candidate.video_url ?? null} onSave={(v) => onUpdateField("video_url", v)} candidateName={candidate.full_name} />
                  </div>
                );
              }
              if (colLabel === "TICKET PDF") {
                const ca = candidate as any;
                const isReturned = candidate.status === "returned";
                const ticketItems: React.ReactNode[] = [];
                if (ca.ticket_pdf_url) ticketItems.push(
                  <div key="ticket" className="flex items-center gap-1">
                    <button type="button" onClick={() => setTicketFilesOpen(true)} className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 hover:underline shrink-0">PDF</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.ticket_pdf_url); }} className="text-blue-700 dark:text-blue-400 hover:opacity-70"><Download className="h-3 w-3" /></button>
                  </div>
                );
                if (ca.qr_url) ticketItems.push(
                  <div key="qr" className="flex items-center gap-1">
                    <button type="button" onClick={() => setTicketFilesOpen(true)} className="text-[10px] font-semibold text-green-700 dark:text-green-400 hover:underline shrink-0">QR</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.qr_url); }} className="text-green-700 dark:text-green-400 hover:opacity-70"><Download className="h-3 w-3" /></button>
                  </div>
                );
                if (ca.visa_pdf_url) ticketItems.push(
                  <div key="visa" className="flex items-center gap-1">
                    <button type="button" onClick={() => setTicketFilesOpen(true)} className="text-[10px] font-semibold text-purple-700 dark:text-purple-400 hover:underline shrink-0">VISA</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.visa_pdf_url); }} className="text-purple-700 dark:text-purple-400 hover:opacity-70"><Download className="h-3 w-3" /></button>
                  </div>
                );
                if (isReturned && ca.return_ticket_url) ticketItems.push(
                  <div key="return" className="flex items-center gap-1">
                    <button type="button" onClick={() => setTicketFilesOpen(true)} className="text-[10px] font-semibold text-orange-700 dark:text-orange-400 hover:underline shrink-0">RTN</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.return_ticket_url); }} className="text-orange-700 dark:text-orange-400 hover:opacity-70"><Download className="h-3 w-3" /></button>
                  </div>
                );
                if (isReturned && ca.stamp_url) ticketItems.push(
                  <div key="stamp" className="flex items-center gap-1">
                    <button type="button" onClick={() => setTicketFilesOpen(true)} className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 hover:underline shrink-0">STAMP</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.stamp_url); }} className="text-rose-700 dark:text-rose-400 hover:opacity-70"><Download className="h-3 w-3" /></button>
                  </div>
                );
                return (
                  <div key="TICKET PDF" className="shrink-0">
                    <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1 whitespace-nowrap">TICKET FILES</div>
                    <div className="flex flex-col gap-0.5">
                      {ticketItems.length > 0
                        ? ticketItems
                        : <button type="button" onClick={() => setTicketFilesOpen(true)} className="text-muted-foreground text-sm">—</button>}
                    </div>
                  </div>
                );
              }
              const f = allFields.find((f) => f.label === colLabel);
              if (!f) return null;
              return (
                <div key={colLabel} className="shrink-0 w-[110px]">
                  <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1">{colLabel}</div>
                  <div className="text-sm text-foreground break-words">
                    {"edit" in f && f.edit === "text" ? (
                      <InlineText value={f.value} onSave={(v) => onUpdateField(f.field, v)} suggestions={f.field === "narrative" ? narrativeSuggestions : undefined} />
                    ) : "edit" in f && f.edit === "date" ? (
                      <InlineDate value={f.value} display={f.display} showDays={"showDays" in f ? f.showDays : undefined} onSave={(v) => onUpdateField(f.field, v)} />
                    ) : "edit" in f && f.edit === "select" ? (
                      colLabel === "COC STATUS" && f.value === "Placed" ? (
                        <div className="flex items-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <InlineSelect value={f.value} options={f.options} onSave={(v) => onUpdateField(f.field, v)} />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="rounded-none text-xs p-2 space-y-0.5">
                                <div className="font-semibold">{(candidate as any).coc_agency_name || "—"}</div>
                                <div>{(candidate as any).coc_agency_phone || "No phone"}</div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setCocEditName((candidate as any).coc_agency_name ?? ""); setCocEditPhone((candidate as any).coc_agency_phone ?? ""); setCocEditOpen(true); }}>
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      ) : colLabel === "MEDICAL STATUS" ? (
                        <div className="flex items-center gap-1 min-w-0">
                          <InlineSelect value={f.value} options={f.options} onSave={(v) => {
                            if (v === "Fit" && !candidate.medical_date) {
                              setPendingMedDate(""); setMedDateOpen(true);
                            } else if (v === "Fit" && candidate.medical_date && medDaysAgo(candidate.medical_date) >= 90) {
                              toast.error("Medical date is over 90 days ago — status set to Expired");
                              onUpdateField(f.field, "Expired");
                            } else {
                              onUpdateField(f.field, v);
                            }
                          }} />
                          {candidate.passport_number && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    disabled={wafidChecking}
                                    className="shrink-0 text-muted-foreground hover:text-teal-600 disabled:opacity-40 transition-colors"
                                    onClick={async () => {
                                      setWafidChecking(true);
                                      const tid = toast.loading("Connecting to wafid.com…");
                                      try {
                                        const res = await checkWafidFn({ data: { candidateId: candidate.id } });
                                        if (res.status) {
                                          toast.success(`wafid.com · ${res.message}`, { id: tid });
                                          qcCard.invalidateQueries({ queryKey: ["staff-candidates"] });
                                        } else {
                                          toast.info(`wafid.com · ${res.message}`, { id: tid });
                                        }
                                      } catch (e) {
                                        toast.error(`wafid.com · ${String(e)}`, { id: tid });
                                      } finally {
                                        setWafidChecking(false);
                                      }
                                    }}
                                  >
                                    {wafidChecking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="rounded-none text-xs p-2">
                                  {wafidChecking ? "Connecting to wafid.com…" : "Check on wafid.com"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      ) : colLabel === "CV SENT TO" && (() => {
                          const ra = (candidate as any).reserved_at;
                          return ra && (Date.now() - new Date(ra).getTime()) < 3 * 86_400_000;
                        })() ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium cursor-default">
                                <Lock className="h-3 w-3" />
                                Reserved — {3 - Math.floor((Date.now() - new Date((candidate as any).reserved_at).getTime()) / 86_400_000)}d left
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="rounded-none text-xs p-2">
                              Reserved by <strong>{(candidate as any).reserved_by ?? "agency"}</strong>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <InlineSelect value={f.value} options={f.options} onSave={(v) => onUpdateField(f.field, v)} />
                      )
                    ) : "copy" in f && f.copy && f.value && f.value !== "—" ? (
                      <button
                        type="button"
                        title="Click to copy"
                        onClick={() => { navigator.clipboard.writeText(f.value); toast.success("Copied!"); }}
                        className={cn("text-left break-words hover:text-primary hover:underline cursor-copy transition-colors", compact ? "line-clamp-1" : "line-clamp-2")}
                      >
                        {f.value}
                      </button>
                    ) : (
                      <span className={cn("break-words", compact ? "line-clamp-1" : "line-clamp-2")}>{f.value || "—"}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Actions — sticky right */}
          <div className="sticky right-0 z-10 self-stretch shrink-0 flex flex-col justify-center items-center gap-1.5 px-4 border-l border-border" style={{ background: selected ? "var(--selected-bg)" : "var(--card)" }}>
            <Button size="sm" onClick={() => setViewing(true)} className="w-full px-5 h-8 rounded text-xs font-semibold tracking-wide">
              VIEW
            </Button>
            {candidate.visa_status === "Waiting Replacement" ? (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">🔒 Locked</span>
            ) : (
              <button onClick={onEdit} className="text-xs text-primary hover:underline">Edit</button>
            )}
            {onReturn && (
              <button onClick={() => setReturnOpen(true)} className="text-xs text-orange-600 hover:underline">Return</button>
            )}
            {onUndo && (
              <button onClick={onUndo} className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
                <Undo2 className="h-3 w-3" /> Undo
              </button>
            )}
            <button
              onClick={() => setDeleteRequestOpen(true)}
              className="text-xs text-destructive hover:underline"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
      {deleteRequestOpen && (
        <CancelReasonDialog
          onConfirm={(reason) => { onUpdateField("notes", reason); onDelete(); setDeleteRequestOpen(false); }}
          onClose={() => setDeleteRequestOpen(false)}
        />
      )}
      {returnOpen && onReturn && (
        <ReturnReasonDialog
          onConfirm={(reason) => { onUpdateField("notes", reason); onReturn(); setReturnOpen(false); }}
          onClose={() => setReturnOpen(false)}
        />
      )}
      {medDateOpen && (
        <Dialog open onOpenChange={(o) => { if (!o) setMedDateOpen(false); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Medical Date Required</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Please enter the <strong>Medical Date</strong> before setting Medical Status to <strong>"Fit"</strong>.
            </p>
            <div className="py-2">
              <Input type="date" value={pendingMedDate} onChange={(e) => setPendingMedDate(e.target.value)} className="rounded-none h-9" />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setMedDateOpen(false)}>Cancel</Button>
              <Button disabled={!pendingMedDate} onClick={() => {
                if (!pendingMedDate) return;
                const status = medDaysAgo(pendingMedDate) >= 90 ? "Expired" : "Fit";
                if (status === "Expired") toast.error("Medical date is over 90 days ago — status set to Expired");
                onUpdateField("medical_date", pendingMedDate);
                onUpdateField("medical_status", status);
                setMedDateOpen(false);
              }}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {cocEditOpen && (
        <Dialog open onOpenChange={(o) => { if (!o) setCocEditOpen(false); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Edit COC Agency Details</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <Input placeholder="Agency Name" value={cocEditName} onChange={(e) => setCocEditName(e.target.value)} className="rounded-none h-9" />
              <Input placeholder="Phone Number" value={cocEditPhone} onChange={(e) => setCocEditPhone(e.target.value)} className="rounded-none h-9" />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCocEditOpen(false)}>Cancel</Button>
              <Button disabled={!cocEditName.trim() || !cocEditPhone.trim()} onClick={() => { onUpdateField("coc_agency_name", cocEditName.trim()); onUpdateField("coc_agency_phone", cocEditPhone.trim()); setCocEditOpen(false); }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <CandidateDetailDialog
        candidate={viewing ? candidate : null}
        onClose={() => setViewing(false)}
        agencyPhones={agencyPhones}
      />
      {ticketFilesOpen && (
        <TicketFilesDialog
          candidate={candidate}
          onUpdateField={(field, value) => onUpdateField(field as EditableField, value)}
          onClose={() => setTicketFilesOpen(false)}
          showReturnFiles={candidate.status === "returned"}
        />
      )}
    </>
  );
}

const INITIAL_PROC_FILTERS = {
  sort:             "newest",
  narrative:        [] as string[],
  medical_status:   [] as string[],
  coc_status:       [] as string[],
  tasheer_status:   [] as string[],
  wokala_status:    [] as string[],
  visa_status:      [] as string[],
  insurance_status: [] as string[],
  unfilled_lmis:    [] as string[],
  lmis_status:      [] as string[],
  ticket_status:    [] as string[],
  arrival_city:     [] as string[],
  selected_by:      [] as string[],
};

function ProcessingTable({
  candidates, selected, onToggleSelect, onAction, onUpdateField, onEdit, onDelete, cancelMode,
  countryMeta, officesByCountry, agencyPhones, agencyOptions,
}: {
  candidates: Candidate[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onAction: (c: Candidate) => void;
  onUpdateField: (id: string, field: string, value: string | null) => void;
  onEdit: (c: Candidate) => void;
  onDelete: (id: string) => void;
  cancelMode?: boolean;
  countryMeta: Array<{ name: string; flag: string }>;
  officesByCountry: Record<string, string[]>;
  agencyPhones: Record<string, string>;
  agencyOptions: string[];
}) {
  const [viewingPhotos, setViewingPhotos] = useState<Candidate | null>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    try {
      const s = sessionStorage.getItem("stf-hidden-cols-proc");
      if (s) return new Set(JSON.parse(s));
    } catch {}
    return new Set(["destination_country", "office"]);
  });
  useEffect(() => {
    sessionStorage.setItem("stf-hidden-cols-proc", JSON.stringify(Array.from(hiddenCols)));
  }, [hiddenCols]);
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showColPicker) return;
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node))
        setShowColPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColPicker]);
  const [search, setSearch] = useState("");
  const [procFilters, setProcFilters] = useState(INITIAL_PROC_FILTERS);
  const [activeCountryTab, setActiveCountryTab] = useState("all");
  const [activeOfficeTab, setActiveOfficeTab] = useState("all");
  const f = procFilters;
  const scrollRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    const mirror = mirrorRef.current;
    if (!el) return;
    const sync = () => {
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
      if (fadeRef.current) fadeRef.current.style.opacity = (!atEnd && el.scrollWidth > el.clientWidth) ? "1" : "0";
      if (mirror) mirror.scrollLeft = el.scrollLeft;
    };
    const syncWidth = () => {
      if (mirror) {
        const inner = mirror.firstElementChild as HTMLElement;
        if (inner) inner.style.width = el.scrollWidth + "px";
      }
    };
    const onMirrorScroll = () => { if (mirror) el.scrollLeft = mirror.scrollLeft; };
    sync(); syncWidth();
    const raf = requestAnimationFrame(() => { sync(); syncWidth(); });
    el.addEventListener("scroll", sync, { passive: true });
    if (mirror) mirror.addEventListener("scroll", onMirrorScroll, { passive: true });
    const ro = new ResizeObserver(() => { sync(); syncWidth(); });
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => { cancelAnimationFrame(raf); el.removeEventListener("scroll", sync); mirror?.removeEventListener("scroll", onMirrorScroll); ro.disconnect(); };
  }, []);
  const allCols = useMemo((): ProcessingColDef[] => {
    const countryNames = countryMeta.map((c) => c.name);
    return [
      ...(countryNames.length > 0 ? [
        { key: "destination_country", header: "Country", type: "select" as const, options: countryNames },
        { key: "office", header: "Office", type: "select-dynamic" as const },
      ] : []),
      ...PROCESSING_COLS,
    ];
  }, [countryMeta]);

  const activeCount = Object.entries(procFilters).filter(([k, v]) =>
    k !== "sort" && (Array.isArray(v) ? v.length > 0 : v !== "all")
  ).length;

  const narrativeOpts = useMemo(() =>
    Array.from(new Set(candidates.map((c) => (c.narrative as string | null) ?? "").filter(Boolean))).sort(),
  [candidates]);

  const matchesCountry = (c: Candidate, country: string) =>
    c.destination_country === country || c.musaned_status === country;

  const filteredCandidates = useMemo(() => {
    let list = candidates;
    if (activeCountryTab !== "all") list = list.filter((c) => matchesCountry(c, activeCountryTab));
    if (activeOfficeTab !== "all") list = list.filter((c) => c.office === activeOfficeTab);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.full_name.toLowerCase().includes(q) ||
        (c.passport_number ?? "").toLowerCase().includes(q) ||
        (c.serial_number ?? "").toLowerCase().includes(q)
      );
    }
    if (f.narrative.length > 0)        list = list.filter((c) => f.narrative.includes(c.narrative ?? ""));
    if (f.medical_status.length > 0)   list = list.filter((c) => f.medical_status.includes(c.medical_status ?? ""));
    if (f.coc_status.length > 0)       list = list.filter((c) => f.coc_status.includes(c.coc_status ?? ""));
    if (f.tasheer_status.length > 0)   list = list.filter((c) => f.tasheer_status.includes(c.tasheer_status ?? ""));
    if (f.wokala_status.length > 0)    list = list.filter((c) => f.wokala_status.includes(c.wokala_status ?? ""));
    if (f.visa_status.length > 0)      list = list.filter((c) => f.visa_status.includes(c.visa_status ?? ""));
    if (f.insurance_status.length > 0) list = list.filter((c) => f.insurance_status.includes(c.insurance_status ?? ""));
    if (f.unfilled_lmis.length > 0)    list = list.filter((c) => f.unfilled_lmis.includes(c.unfilled_lmis ?? ""));
    if (f.lmis_status.length > 0)      list = list.filter((c) => f.lmis_status.includes(c.lmis_status ?? ""));
    if (f.ticket_status.length > 0)    list = list.filter((c) => f.ticket_status.includes(c.ticket_status ?? ""));
    if (f.arrival_city.length > 0)     list = list.filter((c) => f.arrival_city.includes(c.arrival_city ?? ""));
    if (f.selected_by.length > 0)      list = list.filter((c) => f.selected_by.includes(c.selected_by ?? ""));
    return [...list].sort((a, b) => {
      const ad = a.contract_date ?? "";
      const bd = b.contract_date ?? "";
      const byCd = f.sort === "oldest" ? ad.localeCompare(bd) : bd.localeCompare(ad);
      if (byCd !== 0) return byCd;
      const byCreated = f.sort === "oldest"
        ? a.created_at.localeCompare(b.created_at)
        : b.created_at.localeCompare(a.created_at);
      return byCreated !== 0 ? byCreated : a.id.localeCompare(b.id);
    });
  }, [candidates, search, f.sort, f.narrative, f.medical_status, f.coc_status, f.tasheer_status, f.wokala_status,
      f.visa_status, f.insurance_status, f.unfilled_lmis, f.lmis_status,
      f.ticket_status, f.arrival_city, f.selected_by, activeCountryTab, activeOfficeTab]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  useEffect(() => { setPage(1); }, [filteredCandidates.length, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / pageSize));

  const arrivedChecked = useRef<Set<string>>(new Set());
  const [arrivedCheckCandidate, setArrivedCheckCandidate] = useState<Candidate | null>(null);

  useEffect(() => {
    for (const c of candidates) {
      if (c.medical_status === "Fit" && c.medical_date && medDaysAgo(c.medical_date) >= 90) {
        onUpdateField(c.id, "medical_status", "Expired");
      }
    }
  }, [candidates]);

  useEffect(() => {
    if (arrivedCheckCandidate) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const c of candidates) {
      if (arrivedChecked.current.has(c.id)) continue;
      if (c.ticket_status === "Booked" && c.ticket_date && c.status === "processing") {
        const ticketDate = new Date(c.ticket_date + "T00:00:00");
        if (today > ticketDate) {
          arrivedChecked.current.add(c.id);
          setArrivedCheckCandidate(c);
          return;
        }
      }
    }
  }, [candidates, arrivedCheckCandidate]);
  const paginated = filteredCandidates.slice((page - 1) * pageSize, page * pageSize);
  const visibleCols = allCols.filter((col) => !hiddenCols.has(col.key));
  const allSel = paginated.length > 0 && paginated.every((c) => selected.has(c.id));
  const someSel = !allSel && paginated.some((c) => selected.has(c.id));

  const setMulti = (key: keyof typeof INITIAL_PROC_FILTERS) => (v: string[]) =>
    setProcFilters((p) => ({ ...p, [key]: v }));

  return (
    <div className="space-y-2">
      {/* Filter bar */}
      {<Card className="rounded-none">
        <CardContent className="p-3">
          <div className="flex items-center gap-1.5">
            {activeCount > 0 && (
              <span className="rounded-none bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                {activeCount}
              </span>
            )}
          </div>
            <div className="mt-3 flex flex-wrap items-center gap-5">
              <FilterSelect value={f.sort} onChange={(v) => setProcFilters((p) => ({ ...p, sort: v }))}
                icon={ArrowUpDown}
                options={[{ value: "newest", label: "Date (Newest)" }, { value: "oldest", label: "Date (Oldest)" }]} />
              <MultiFilterSelect values={f.narrative} onChange={setMulti("narrative")} placeholder="Narrative" icon={FileText}
                options={[{ value: "", label: "Not Selected" }, ...narrativeOpts.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect values={f.medical_status} onChange={setMulti("medical_status")} placeholder="Medical" icon={Stethoscope}
                options={[{ value: "", label: "Not Selected" }, ...MEDICAL_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect values={f.coc_status} onChange={setMulti("coc_status")} placeholder="COC" icon={FileCheck}
                options={[{ value: "", label: "Not Selected" }, ...COC_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect values={f.tasheer_status} onChange={setMulti("tasheer_status")} placeholder="Tasheer"
                options={[{ value: "", label: "Not Selected" }, ...TASHEER_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect values={f.wokala_status} onChange={setMulti("wokala_status")} placeholder="Wokala"
                options={[{ value: "", label: "Not Selected" }, ...WOKALA_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect values={f.visa_status} onChange={setMulti("visa_status")} placeholder="Visa"
                options={[{ value: "", label: "Not Selected" }, ...VISA_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect values={f.insurance_status} onChange={setMulti("insurance_status")} placeholder="Insurance"
                options={[{ value: "", label: "Not Selected" }, ...INSURANCE_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect values={f.unfilled_lmis} onChange={setMulti("unfilled_lmis")} placeholder="LMIS file"
                options={UNFILLED_LMIS_OPTIONS.map((o) => ({ value: o, label: o }))} />
              <MultiFilterSelect values={f.lmis_status} onChange={setMulti("lmis_status")} placeholder="LMIS"
                options={[{ value: "", label: "Not Selected" }, ...LMIS_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect values={f.ticket_status} onChange={setMulti("ticket_status")} placeholder="Ticket"
                options={[{ value: "", label: "Not Selected" }, ...TICKET_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect values={f.arrival_city} onChange={setMulti("arrival_city")} placeholder="Arrival City"
                options={[{ value: "", label: "Not Selected" }, ...ARRIVAL_CITY_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect values={f.selected_by} onChange={setMulti("selected_by")} placeholder="Selected By"
                options={[{ value: "", label: "Not Selected" }, ...agencyOptions.map((o) => ({ value: o, label: o }))]} />
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-7 text-xs rounded-none w-52"
                  placeholder="Search name / passport…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{filteredCandidates.length}</span> candidate{filteredCandidates.length !== 1 ? "s" : ""} found</span>
            <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs font-bold text-black"
              onClick={() => { setProcFilters(INITIAL_PROC_FILTERS); setSearch(""); }} disabled={activeCount === 0 && !search}>
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>}

      {selected.size === 0 && countryMeta.length > 0 && (
        <Card className="rounded-none">
          <CardContent className="px-3 py-2">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => { setActiveCountryTab("all"); setActiveOfficeTab("all"); }}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-none border transition-colors",
                  activeCountryTab === "all"
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40",
                )}
              >
                All ({candidates.length})
              </button>
              {countryMeta.map((c) => {
                const count = candidates.filter((cand) => matchesCountry(cand, c.name)).length;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      const next = activeCountryTab === c.name ? "all" : c.name;
                      setActiveCountryTab(next);
                      setActiveOfficeTab("all");
                    }}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-none border transition-colors flex items-center gap-1.5",
                      activeCountryTab === c.name
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40",
                    )}
                  >
                    <span>{c.flag}</span>
                    {c.name}
                    <span className="opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {activeCountryTab !== "all" && (officesByCountry[activeCountryTab] ?? []).length > 0 && (
        <Card className="rounded-none">
          <CardContent className="px-3 py-2">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveOfficeTab("all")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-none border transition-colors",
                  activeOfficeTab === "all"
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40",
                )}
              >
                All offices
              </button>
              {(officesByCountry[activeCountryTab] ?? []).map((office) => {
                const count = candidates.filter((c) => matchesCountry(c, activeCountryTab) && c.office === office).length;
                return (
                  <button
                    key={office}
                    type="button"
                    onClick={() => setActiveOfficeTab(activeOfficeTab === office ? "all" : office)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-none border transition-colors flex items-center gap-1.5",
                      activeOfficeTab === office
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40",
                    )}
                  >
                    {office}
                    <span className="opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {filteredCandidates.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={allSel ? true : someSel ? "indeterminate" : false}
              onCheckedChange={(v) =>
                paginated.forEach((c) => { if (!!v !== selected.has(c.id)) onToggleSelect(c.id); })
              }
            />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>
          <div className="relative" ref={colPickerRef}>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
              onClick={() => setShowColPicker((v) => !v)}>
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Columns
              {hiddenCols.size > 0 && (
                <span className="ml-1 rounded-none bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                  {hiddenCols.size} hidden
                </span>
              )}
            </Button>
            {showColPicker && (
              <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-none shadow-xl p-3 w-[340px]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Columns</span>
                  <button type="button" onClick={() => setHiddenCols(new Set())}
                    className="text-[11px] text-primary hover:underline disabled:opacity-40"
                    disabled={hiddenCols.size === 0}>
                    Reset
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {allCols.map((col) => (
                    <label key={col.key} className="flex items-center gap-1.5 text-xs cursor-pointer py-1 hover:text-primary">
                      <Checkbox
                        checked={!hiddenCols.has(col.key)}
                        onCheckedChange={(v) =>
                          setHiddenCols((prev) => { const n = new Set(prev); v ? n.delete(col.key) : n.add(col.key); return n; })
                        }
                      />
                      {col.header}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {candidates.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">No candidates in processing.</CardContent></Card>
      ) : filteredCandidates.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No matches for the selected filters.</CardContent></Card>
      ) : (
        <div className="relative">
          <div ref={scrollRef} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-2 min-w-max">
              {paginated.map((c) => (
                <ProcessingCard
                  key={c.id}
                  candidate={c}
                  selected={selected.has(c.id)}
                  visibleCols={visibleCols}
                  cancelMode={cancelMode}
                  onToggleSelect={() => onToggleSelect(c.id)}
                  onViewPhotos={() => setViewingPhotos(c)}
                  onAction={() => onAction(c)}
                  onUpdateField={(field, value) => onUpdateField(c.id, field, value)}
                  onEdit={() => onEdit(c)}
                  onDelete={() => onDelete(c.id)}
                  officesByCountry={officesByCountry}
                  agencyPhones={agencyPhones}
                  narrativeSuggestions={narrativeOpts}
                />
              ))}
            </div>
          </div>
          <div ref={fadeRef} aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent opacity-0 transition-opacity duration-200" />
        </div>
      )}
      <CandidatePhotosDialog candidate={viewingPhotos} onClose={() => setViewingPhotos(null)} />
      {arrivedCheckCandidate && (
        <ArrivedCheckDialog
          candidate={arrivedCheckCandidate}
          onArrived={() => {
            onUpdateField(arrivedCheckCandidate.id, "status", "arrived");
            setArrivedCheckCandidate(null);
          }}
          onNotArrived={(reason, problem) => {
            const note = `[${new Date().toLocaleDateString()}] Not arrived — ${reason}: ${problem}`;
            const existing = arrivedCheckCandidate.processing_notes ?? "";
            onUpdateField(arrivedCheckCandidate.id, "processing_notes", existing ? `${existing}\n${note}` : note);
            setArrivedCheckCandidate(null);
          }}
          onClose={() => setArrivedCheckCandidate(null)}
        />
      )}

      {candidates.length > 0 && (
        <div className="sticky bottom-0 z-10 bg-background shadow-[0_-1px_3px_rgba(0,0,0,0.06)]">
          <div ref={mirrorRef} className="w-full" style={{ overflowX: "scroll", overflowY: "hidden", height: 16 }}><div style={{ height: 1 }} /></div>
          <div className="flex items-center justify-between px-4 py-2 flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-none" disabled={page === 1}
              onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .map((n, i, arr) => (
                <React.Fragment key={n}>
                  {i > 0 && n - arr[i - 1] > 1 && <span className="text-xs text-muted-foreground px-0.5">…</span>}
                  <Button size="sm" variant={page === n ? "default" : "outline"}
                    className="h-7 w-7 p-0 rounded-none text-xs"
                    onClick={() => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                    {n}
                  </Button>
                </React.Fragment>
              ))}
            <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-none" disabled={page === totalPages}
              onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            {[5, 10, 50, 100, 500].map((s) => (
              <Button key={s} size="sm" variant={pageSize === s ? "default" : "outline"}
                className="h-7 px-2 rounded-none text-xs"
                onClick={() => { setPageSize(s); setPage(1); }}>
                {s}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredCandidates.length)} of {filteredCandidates.length}
            </span>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs font-bold text-black"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <ChevronUp className="h-3.5 w-3.5" /> Back to top
            </Button>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function downloadFile(url: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const ext = (url.split(".").pop()?.split("?")[0] ?? "").toLowerCase();
    const isImage = ["jpg", "jpeg", "png", "webp", "bmp"].includes(ext) || blob.type.startsWith("image/");

    if (isImage) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target!.result as string);
        reader.readAsDataURL(blob);
      });
      const img = new Image();
      await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = dataUrl; });
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: img.width > img.height ? "landscape" : "portrait", unit: "mm" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pw / img.width, ph / img.height);
      const iw = img.width * ratio;
      const ih = img.height * ratio;
      pdf.addImage(dataUrl, ext === "png" ? "PNG" : "JPEG", (pw - iw) / 2, (ph - ih) / 2, iw, ih);
      pdf.save("lmis_file.pdf");
    } else {
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = "lmis_file.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    }
  } catch {
    toast.error("Download failed");
  }
}

function ProcessingCard({
  candidate, selected, visibleCols, onToggleSelect, onViewPhotos, onAction, onUpdateField, onEdit, onDelete, cancelMode,
  officesByCountry, agencyPhones, narrativeSuggestions,
}: {
  candidate: Candidate;
  selected: boolean;
  visibleCols: ProcessingColDef[];
  cancelMode?: boolean;
  onToggleSelect: () => void;
  onViewPhotos: () => void;
  onAction: () => void;
  onUpdateField: (field: string, value: string | null) => void;
  onEdit: () => void;
  onDelete: () => void;
  officesByCountry: Record<string, string[]>;
  agencyPhones: Record<string, string>;
  narrativeSuggestions?: string[];
}) {
  const [viewing, setViewing] = useState(false);
  const [requireDate, setRequireDate] = useState<{
    field: "ticket_date" | "tasheer_date" | "medical_date" | "insurance_date";
    label: string;
    pendingStatus: string;
    statusField: string;
  } | null>(null);
  const [pendingDate, setPendingDate] = useState("");
  const [deleteRequestOpen, setDeleteRequestOpen] = useState(false);
  const [embassyOpen, setEmbassyOpen] = useState(false);
  const [embassyStep, setEmbassyStep] = useState<"ask" | "reason">("ask");
  const [embassyReason, setEmbassyReason] = useState("");
  const [visaReturnOpen, setVisaReturnOpen] = useState(false);
  const [visaReturnReason, setVisaReturnReason] = useState("");
  const [cocPlacedOpen, setCocPlacedOpen] = useState(false);
  const [cocPlacedName, setCocPlacedName] = useState("");
  const [cocPlacedPhone, setCocPlacedPhone] = useState("");
  const [lmisFilesOpen, setLmisFilesOpen] = useState(false);
  const [embassyOverwriteOpen, setEmbassyOverwriteOpen] = useState(false);
  const [ticketHoldOpen, setTicketHoldOpen] = useState(false);
  const [ticketHoldReason, setTicketHoldReason] = useState("");
  const [ticketFilesOpen, setTicketFilesOpen] = useState(false);
  function handleColUpdate(colKey: string, value: string | null) {
    if (colKey === "coc_status" && value === "Placed") {
      setCocPlacedOpen(true);
      setCocPlacedName((candidate as any).coc_agency_name ?? "");
      setCocPlacedPhone((candidate as any).coc_agency_phone ?? "");
      return;
    }
    if (colKey === "insurance_status" && value === "Done") {
      setRequireDate({ field: "insurance_date", label: "Insurance Date", pendingStatus: "Done", statusField: "insurance_status" });
      setPendingDate((candidate as any).insurance_date ?? "");
      return;
    }
    if (colKey === "visa_status" && (value === "Ready for embassy" || value === "Returned")) {
      const tasheerDone = candidate.tasheer_status === "Done";
      const passportOk = candidate.passport_accepted === true;
      const wokalaPaid = candidate.wokala_status === "Paid";
      if (candidate.status !== "processing" || !tasheerDone || (!passportOk && !wokalaPaid)) {
        toast.error("Candidate must be Processing with Tasheer = Done and either Passport Accepted or Wokala = Paid");
        return;
      }
    }
    if (colKey === "visa_status" && value === "Returned") {
      setVisaReturnOpen(true); setVisaReturnReason("");
      return;
    }
    if (colKey === "ticket_status" && value === "Hold") {
      setTicketHoldOpen(true);
      setTicketHoldReason("");
      return;
    }
    if (colKey === "ticket_status" && candidate.ticket_status === "Hold" && value !== "Hold") {
      onUpdateField("processing_notes", null);
    }
    if (colKey === "ticket_status" && value === "Booked") {
      setRequireDate({ field: "ticket_date", label: "Ticket Date", pendingStatus: "Booked", statusField: "ticket_status" });
      setPendingDate(candidate.ticket_date ?? "");
      return;
    }
    if (colKey === "tasheer_status" && value === "Booked") {
      setRequireDate({ field: "tasheer_date", label: "Tasheer Date", pendingStatus: "Booked", statusField: "tasheer_status" });
      setPendingDate(candidate.tasheer_date ?? "");
      return;
    }
    if (colKey === "tasheer_status" && value === "Done") {
      setEmbassyOpen(true); setEmbassyStep("ask"); setEmbassyReason("");
      return;
    }
    if (colKey === "medical_status" && value === "Fit") {
      if (!candidate.medical_date) {
        setRequireDate({ field: "medical_date", label: "Medical Date", pendingStatus: "Fit", statusField: "medical_status" });
        setPendingDate("");
        return;
      }
      if (medDaysAgo(candidate.medical_date) >= 90) {
        toast.error("Medical date is over 90 days ago — status set to Expired");
        onUpdateField(colKey, "Expired");
        return;
      }
    }
    onUpdateField(colKey, value);
    if (colKey === "medical_status" && value === "Fit") onUpdateField("lmis_status", "Not tested");
    if (colKey === "visa_status" && !value) onUpdateField("embassy_date", null);
    if (colKey === "visa_status" && value === "Sent to Embassy") {
      if ((candidate as any).embassy_date) {
        setEmbassyOverwriteOpen(true);
      } else {
        onUpdateField("embassy_date", new Date().toISOString().split("T")[0]);
      }
    }
  }

  return (
    <>
      <div
        className={cn("border border-border shadow-sm rounded-sm transition-colors", selected && "ring-1 ring-primary/50")}
        style={{ background: selected ? "var(--selected-bg)" : "var(--card)" }}
      >
        {/* Status badge + checkbox — sticky left */}
        <div className="sticky left-0 z-10 w-fit flex items-center gap-2 px-4 pt-2.5 pb-1" style={{ background: selected ? "var(--selected-bg)" : "var(--card)" }}>
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Select candidate" disabled={candidate.visa_status === "Waiting Replacement"} />
          <StatusBadge status="processing" />
        </div>
        <div className="flex items-center pb-3 pt-1">
          {/* Sticky left: photo + full name */}
          <div className="sticky left-0 z-10 shrink-0 self-stretch flex items-center gap-4 pl-4 pr-3" style={{ background: selected ? "var(--selected-bg)" : "var(--card)" }}>
            <button type="button" onClick={onViewPhotos} className="shrink-0">
              <Avatar className="h-14 w-14 hover:ring-2 hover:ring-primary transition-all">
                {candidate.photo_url && <AvatarImage src={candidate.photo_url} alt={candidate.full_name} />}
                <AvatarFallback className="text-[11px]">{candidate.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </button>
            <div className="shrink-0 w-[110px]">
              <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1">FULL NAME</div>
              <div className="text-sm font-semibold line-clamp-2 break-words">{candidate.full_name}</div>
            </div>
          </div>
          <div className={cn("flex-1 flex items-start gap-2", candidate.visa_status === "Waiting Replacement" && "pointer-events-none opacity-60")}>
            {visibleCols.map((col) => {
              const raw = candidate[col.key as keyof Candidate];
              const strVal = raw == null ? "" : String(raw);
              return (
                <div key={col.key} className="shrink-0 w-[110px]">
                  <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1">{col.header}</div>
                  <div className="text-sm text-foreground break-words">
                    {col.type === "copy" ? (
                      strVal ? (
                        <button
                          type="button"
                          className="text-left text-sm font-mono text-foreground hover:text-primary transition-colors cursor-pointer"
                          onClick={() => { navigator.clipboard.writeText(strVal); toast.success("Copied!"); }}
                          title="Click to copy"
                        >{strVal}</button>
                      ) : <span className="text-muted-foreground">—</span>
                    ) : col.type === "text" ? (
                      <InlineText value={strVal} onSave={(v) => handleColUpdate(col.key, v)} suggestions={col.key === "narrative" ? narrativeSuggestions : undefined} />
                    ) : col.type === "date" ? (
                      col.key === "medical_date" && strVal ? (
                        <span className="break-words">{(() => {
                          const d = new Date(strVal + "T00:00:00");
                          const dd = String(d.getDate()).padStart(2, "0");
                          const mm = String(d.getMonth() + 1).padStart(2, "0");
                          const yyyy = d.getFullYear();
                          const days = Math.max(1, Math.floor((Date.now() - d.getTime()) / 86400000));
                          return <>{`${dd}/${mm}/${yyyy}`}<br /><span className="text-muted-foreground text-xs">({days} days ago)</span></>;
                        })()}</span>
                      ) : col.key === "contract_date" ? (
                        <span className="px-1 py-0.5 min-w-[60px] block">
                          {strVal ? (() => {
                            const fmt = new Date(strVal + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
                            const days = Math.floor((Date.now() - new Date(strVal + "T00:00:00").getTime()) / 86_400_000);
                            return <>{fmt}<span className="block text-[11px] text-muted-foreground leading-none mt-0.5">({days} day{days !== 1 ? "s" : ""})</span></>;
                          })() : <span className="text-muted-foreground">—</span>}
                        </span>
                      ) : (
                        <InlineDate value={strVal} showDays={false} onSave={(v) => handleColUpdate(col.key, v)} />
                      )
                    ) : col.type === "select" ? (
                      col.key === "unfilled_lmis" ? (
                        <div className="flex flex-col gap-0.5">
                          {(() => {
                            const ca = candidate as any;
                            const bothIds = !!(ca.lmis_id_url && ca.lmis_id_relative_url);
                            const items: React.ReactNode[] = [];
                            if (ca.lmis_insu_url) items.push(
                              <div key="insu" className="flex items-center gap-1">
                                <button type="button" onClick={() => setLmisFilesOpen(true)} className="text-[10px] font-semibold text-green-700 dark:text-green-400 hover:underline w-7 shrink-0">INSU</button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.lmis_insu_url); }} className="text-green-700 dark:text-green-400 hover:opacity-70"><Download className="h-3 w-3" /></button>
                              </div>
                            );
                            if (ca.lmis_coc_url) items.push(
                              <div key="coc" className="flex items-center gap-1">
                                <button type="button" onClick={() => setLmisFilesOpen(true)} className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 hover:underline w-7 shrink-0">COC</button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.lmis_coc_url); }} className="text-blue-700 dark:text-blue-400 hover:opacity-70"><Download className="h-3 w-3" /></button>
                              </div>
                            );
                            if (ca.lmis_id_url || ca.lmis_id_relative_url) items.push(
                              <div key="id" className="flex items-center gap-1">
                                <button type="button" onClick={() => setLmisFilesOpen(true)} className="text-[10px] font-semibold text-purple-700 dark:text-purple-400 hover:underline w-7 shrink-0">{bothIds ? "ID'S" : "ID"}</button>
                                {ca.lmis_id_url && <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.lmis_id_url); }} className="text-purple-700 dark:text-purple-400 hover:opacity-70"><Download className="h-3 w-3" /></button>}
                                {bothIds && <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.lmis_id_relative_url); }} className="text-purple-700 dark:text-purple-400 hover:opacity-70"><Download className="h-3 w-3" /></button>}
                              </div>
                            );
                            return items.length > 0
                              ? items
                              : <button type="button" onClick={() => setLmisFilesOpen(true)} className="text-muted-foreground text-sm">—</button>;
                          })()}
                        </div>
                      ) : col.key === "coc_status" && strVal === "Placed" ? (
                        <div className="flex items-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <InlineSelect value={strVal} options={col.options} onSave={(v) => handleColUpdate(col.key, v)} />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="rounded-none text-xs p-2 space-y-0.5">
                                <div className="font-semibold">{(candidate as any).coc_agency_name || "—"}</div>
                                <div>{(candidate as any).coc_agency_phone || "No phone"}</div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setCocPlacedName((candidate as any).coc_agency_name ?? ""); setCocPlacedPhone((candidate as any).coc_agency_phone ?? ""); setCocPlacedOpen(true); }}>
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      ) : col.key === "insurance_status" && strVal === "Done" ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <InlineSelect value={strVal} options={col.options} onSave={(v) => handleColUpdate(col.key, v)} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="rounded-none text-xs p-2">
                              {(candidate as any).insurance_date
                                ? new Date((candidate as any).insurance_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                                : "No date"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <InlineSelect value={strVal} options={col.options} onSave={(v) => handleColUpdate(col.key, v)} />
                      )
                    ) : col.type === "select-dynamic" ? (
                      <InlineSelect
                        value={strVal}
                        options={officesByCountry[candidate.destination_country ?? ""] ?? []}
                        onSave={(v) => handleColUpdate(col.key, v)}
                      />
                    ) : col.type === "upload" ? (
                      (() => {
                        const ca = candidate as any;
                        const ticketItems: React.ReactNode[] = [];
                        if (ca.ticket_pdf_url) ticketItems.push(
                          <div key="ticket" className="flex items-center gap-1">
                            <button type="button" onClick={() => setTicketFilesOpen(true)} className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 hover:underline shrink-0">PDF</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.ticket_pdf_url); }} className="text-blue-700 dark:text-blue-400 hover:opacity-70"><Download className="h-3 w-3" /></button>
                          </div>
                        );
                        if (ca.qr_url) ticketItems.push(
                          <div key="qr" className="flex items-center gap-1">
                            <button type="button" onClick={() => setTicketFilesOpen(true)} className="text-[10px] font-semibold text-green-700 dark:text-green-400 hover:underline shrink-0">QR</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.qr_url); }} className="text-green-700 dark:text-green-400 hover:opacity-70"><Download className="h-3 w-3" /></button>
                          </div>
                        );
                        if (ca.visa_pdf_url) ticketItems.push(
                          <div key="visa" className="flex items-center gap-1">
                            <button type="button" onClick={() => setTicketFilesOpen(true)} className="text-[10px] font-semibold text-purple-700 dark:text-purple-400 hover:underline shrink-0">VISA</button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); downloadFile(ca.visa_pdf_url); }} className="text-purple-700 dark:text-purple-400 hover:opacity-70"><Download className="h-3 w-3" /></button>
                          </div>
                        );
                        return (
                          <div className="flex flex-col gap-0.5">
                            {ticketItems.length > 0
                              ? ticketItems
                              : <button type="button" onClick={() => setTicketFilesOpen(true)} className="text-muted-foreground text-sm">—</button>}
                          </div>
                        );
                      })()
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Actions — sticky right */}
          <div className="sticky right-0 z-10 self-stretch shrink-0 flex flex-col justify-center items-center gap-1.5 px-4 border-l border-border" style={{ background: selected ? "var(--selected-bg)" : "var(--card)" }}>
            <Button size="sm" onClick={() => setViewing(true)} className="w-full px-5 h-8 rounded text-xs font-semibold tracking-wide">
              VIEW
            </Button>
            {candidate.visa_status === "Waiting Replacement" ? (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">🔒 Locked</span>
            ) : (
              <button onClick={onEdit} className="text-xs text-primary hover:underline">Edit</button>
            )}
            <button
              onClick={() => setDeleteRequestOpen(true)}
              className="text-xs text-destructive hover:underline"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    {deleteRequestOpen && (
      <CancelReasonDialog
        onConfirm={(reason) => { onUpdateField("notes", reason); onDelete(); setDeleteRequestOpen(false); }}
        onClose={() => setDeleteRequestOpen(false)}
      />
    )}
    {requireDate && (
      <Dialog open onOpenChange={(o) => { if (!o) setRequireDate(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Date Required</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Please fill in the <strong>{requireDate.label}</strong> before setting the status to{" "}
            <strong>"{requireDate.pendingStatus}"</strong>.
          </p>
          <div className="py-2">
            <Input
              type="date"
              value={pendingDate}
              onChange={(e) => setPendingDate(e.target.value)}
              className="rounded-none h-9"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRequireDate(null)}>Cancel</Button>
            <Button
              disabled={!pendingDate}
              onClick={() => {
                if (!pendingDate) return;
                let finalStatus = requireDate.pendingStatus;
                if (finalStatus === "Fit" && medDaysAgo(pendingDate) >= 90) {
                  toast.error("Medical date is over 90 days ago — status set to Expired");
                  finalStatus = "Expired";
                }
                onUpdateField(requireDate.field, pendingDate);
                onUpdateField(requireDate.statusField, finalStatus);
                if (finalStatus === "Fit") onUpdateField("lmis_status", "Not tested");
                setRequireDate(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    {embassyOpen && (
      <Dialog open onOpenChange={(o) => { if (!o) { setEmbassyOpen(false); setEmbassyStep("ask"); setEmbassyReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Passport Accepted?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tasheer is Done for <strong>{candidate.full_name}</strong>. Is the passport accepted?
          </p>
          <DialogFooter className="flex gap-2 sm:justify-start">
            <Button onClick={() => {
              onUpdateField("tasheer_status", "Done");
              onUpdateField("passport_accepted", "true");
              onUpdateField("wokala_status", "Unpaid");
              onUpdateField("visa_status", "Ready for embassy");
              setEmbassyOpen(false);
            }}>
              Yes — Accepted
            </Button>
            <Button variant="outline" onClick={() => {
              onUpdateField("tasheer_status", "Ready");
              onUpdateField("passport_accepted", "false");
              onUpdateField("wokala_status", "Unpaid");
              setEmbassyOpen(false);
            }}>
              No — Not Accepted
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    {visaReturnOpen && (
      <Dialog open onOpenChange={(o) => { if (!o) { setVisaReturnOpen(false); setVisaReturnReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Visa Returned — Reason Required</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Why was the visa returned for <strong>{candidate.full_name}</strong>?</p>
          <Textarea rows={3} placeholder="Enter reason…" value={visaReturnReason} onChange={(e) => setVisaReturnReason(e.target.value)} />
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => { setVisaReturnOpen(false); setVisaReturnReason(""); }}>Cancel</Button>
            <Button
              disabled={!visaReturnReason.trim()}
              onClick={() => {
                onUpdateField("visa_status", "Returned");
                onUpdateField("remark", visaReturnReason.trim());
                setVisaReturnOpen(false);
                setVisaReturnReason("");
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    {ticketHoldOpen && (
      <Dialog open onOpenChange={(o) => { if (!o) { setTicketHoldOpen(false); setTicketHoldReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ticket Hold — Reason Required</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Why is the ticket on hold for <strong>{candidate.full_name}</strong>?</p>
          <Textarea rows={3} placeholder="Enter reason…" value={ticketHoldReason} onChange={(e) => setTicketHoldReason(e.target.value)} />
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => { setTicketHoldOpen(false); setTicketHoldReason(""); }}>Cancel</Button>
            <Button
              disabled={!ticketHoldReason.trim()}
              onClick={() => {
                onUpdateField("ticket_status", "Hold");
                onUpdateField("processing_notes", ticketHoldReason.trim());
                setTicketHoldOpen(false);
                setTicketHoldReason("");
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    {cocPlacedOpen && (
      <Dialog open onOpenChange={(o) => { if (!o) setCocPlacedOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>COC Placed — Agency Details</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enter the agency name and phone number for <strong>{candidate.full_name}</strong>.
          </p>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Agency Name"
              value={cocPlacedName}
              onChange={(e) => setCocPlacedName(e.target.value)}
              className="rounded-none h-9"
            />
            <Input
              placeholder="Phone Number"
              value={cocPlacedPhone}
              onChange={(e) => setCocPlacedPhone(e.target.value)}
              className="rounded-none h-9"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCocPlacedOpen(false)}>Cancel</Button>
            <Button
              disabled={!cocPlacedName.trim() || !cocPlacedPhone.trim()}
              onClick={() => {
                onUpdateField("coc_status", "Placed");
                onUpdateField("coc_agency_name", cocPlacedName.trim());
                onUpdateField("coc_agency_phone", cocPlacedPhone.trim());
                setCocPlacedOpen(false);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    {lmisFilesOpen && (
      <LmisFilesDialog
        candidate={candidate}
        onUpdateField={(field, value) => onUpdateField(field, value)}
        onClose={() => setLmisFilesOpen(false)}
      />
    )}
    {embassyOverwriteOpen && (
      <Dialog open onOpenChange={(o) => { if (!o) setEmbassyOverwriteOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Overwrite Embassy Date?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Embassy date is already set to{" "}
            <strong>{new Date((candidate as any).embassy_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</strong>.
            Replace with today's date?
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmbassyOverwriteOpen(false)}>No, keep existing</Button>
            <Button onClick={() => { onUpdateField("embassy_date", new Date().toISOString().split("T")[0]); setEmbassyOverwriteOpen(false); }}>
              Yes, update to today
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    <CandidateDetailDialog
      candidate={viewing ? candidate : null}
      onClose={() => setViewing(false)}
      agencyPhones={agencyPhones}
    />
    {ticketFilesOpen && (
      <TicketFilesDialog
        candidate={candidate}
        onUpdateField={(field, value) => onUpdateField(field, value)}
        onClose={() => setTicketFilesOpen(false)}
      />
    )}
    </>
  );
}

function InlineDate({ value, onSave, display, showDays }: { value: string; onSave: (v: string | null) => void; display?: string; showDays?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const fmt = (v: string) =>
    v ? new Date(v + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "";
  const days = showDays && value
    ? Math.floor((Date.now() - new Date(value + "T00:00:00").getTime()) / 86_400_000)
    : null;
  return (
    <>
      <button type="button" onClick={() => { setDraft(value); setOpen(true); }}
        className="text-left rounded-none px-1 -mx-1 py-0.5 hover:bg-muted/60 hover:ring-1 hover:ring-border min-w-[60px] block">
        {display ?? (value ? fmt(value) : <span className="text-muted-foreground">—</span>)}
        {days !== null && (
          <span className="block text-[11px] text-muted-foreground leading-none mt-0.5">
            ({days} day{days !== 1 ? "s" : ""})
          </span>
        )}
      </button>
      {open && (
        <Dialog open onOpenChange={(o) => { if (!o) setOpen(false); }}>
          <DialogContent className="max-w-xs rounded-none">
            <DialogHeader><DialogTitle>Set Date</DialogTitle></DialogHeader>
            <input autoFocus type="date" value={draft} onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            <DialogFooter>
              <Button variant="ghost" className="rounded-none" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="rounded-none" onClick={() => { onSave(draft || null); setOpen(false); }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function InlineText({ value, onSave, suggestions }: { value: string; onSave: (v: string | null) => void; suggestions?: string[] }) {
  const listId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <button
        type="button"
        title={value || undefined}
        onClick={() => { setDraft(value); setEditing(true); }}
        className="text-left rounded-none px-1 -mx-1 py-0.5 hover:bg-muted/60 hover:ring-1 hover:ring-border min-w-[40px] line-clamp-2 break-words"
      >
        {value || <span className="text-muted-foreground">—</span>}
      </button>
    );
  }
  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft.trim() === "" ? null : draft);
  };
  const hasSugg = (suggestions?.length ?? 0) > 0;
  return (
    <>
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        list={hasSugg ? listId : undefined}
        className="rounded-none border border-primary bg-background px-1 py-0.5 text-[14px] text-foreground outline-none w-full max-w-full"
      />
      {hasSugg && <datalist id={listId}>{suggestions!.map((s) => <option key={s} value={s} />)}</datalist>}
    </>
  );
}

function OptionPill({ label, className }: { label: string; className?: string }) {
  const color = OPTION_COLORS[label] ?? "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-semibold leading-none whitespace-nowrap", color, className)}>
      {label}
    </span>
  );
}

function InlineSelect({
  value, options, onSave,
}: { value: string; options: string[]; onSave: (v: string | null) => void }) {
  return (
    <Select value={value || "__clear__"} onValueChange={(v) => onSave(v === "__clear__" ? null : v)}>
      <SelectTrigger className="h-auto w-full max-w-full overflow-hidden gap-1 border-transparent bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:shrink-0 [&>span]:min-w-0 [&>span]:max-w-full">
        <SelectValue placeholder={<span className="text-muted-foreground text-[14px] px-1">—</span>} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__clear__" className="py-1 px-2 focus:bg-muted/50 text-muted-foreground">—</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="py-1 px-2 focus:bg-muted/50">
            <OptionPill label={o} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CardField({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="shrink-0">
      <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase whitespace-nowrap">{label}</div>
      <div className={cn("mt-0.5 text-[14px] text-foreground whitespace-nowrap", bold && "font-semibold")}>{value}</div>
    </div>
  );
}

function FilterSelect({
  value, onChange, options, placeholder, icon: Icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  icon?: React.ElementType;
}) {
  const isReset = value === "all" || !value;
  const hasColor = !isReset && !!OPTION_COLORS[value];
  return (
    <div className="flex items-center gap-0.5">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="border-0 bg-transparent shadow-none h-auto w-auto px-0 gap-1 text-[13px] font-bold text-foreground hover:opacity-70 transition-opacity [&>svg]:shrink-0">
          {Icon && <Icon className="h-3 w-3 shrink-0" />}
          {isReset ? (
            <span>{placeholder}</span>
          ) : hasColor ? (
            <span>{options.find((o) => o.value === value)?.label ?? value}</span>
          ) : (
            <SelectValue />
          )}
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => {
            const isAll = o.value === "all";
            const color = OPTION_COLORS[o.label] ?? OPTION_COLORS[o.value];
            return (
              <SelectItem key={o.value} value={o.value} className="py-1 px-2 focus:bg-muted/50">
                {isAll ? (
                  <span className="text-[13px] text-muted-foreground">{o.label}</span>
                ) : color ? (
                  <OptionPill label={o.label} />
                ) : (
                  <span className="text-[14px] text-foreground">{o.label}</span>
                )}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {!isReset && (
        <button
          type="button"
          onClick={() => onChange("all")}
          className="rounded-none p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Clear filter"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function MultiFilterSelect({
  values, onChange, options, placeholder, icon: Icon,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  icon?: React.ElementType;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const isEmpty = values.length === 0;
  const hasSingleColor = !isEmpty && values.length === 1 && !!OPTION_COLORS[values[0]];

  const toggle = (val: string) =>
    onChange(values.includes(val) ? values.filter((v) => v !== val) : [...values, val]);

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const triggerLabel = isEmpty
    ? placeholder
    : values.length === 1
      ? (options.find((o) => o.value === values[0])?.label ?? values[0])
      : `${placeholder} (${values.length})`;

  return (
    <div className="flex items-center gap-0.5">
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "group flex items-center gap-1 bg-transparent border-0 text-[13px] font-bold transition-opacity px-0",
              isEmpty ? "text-foreground hover:opacity-70" : "text-primary"
            )}
          >
            {Icon && <Icon className="h-3 w-3 shrink-0" />}
            {isEmpty ? (
              <span>{placeholder}</span>
            ) : (
              <>
                <span className="group-hover:hidden">{triggerLabel}</span>
                <span className="hidden group-hover:inline">{placeholder}</span>
              </>
            )}
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-1 rounded-none" align="start">
          <div className="px-1 pb-1">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full h-6 text-[12px] px-2 border border-border rounded-none bg-background outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto">
            {filtered.map((o) => {
              const checked = values.includes(o.value);
              const color = OPTION_COLORS[o.label] ?? OPTION_COLORS[o.value];
              return (
                <button
                  key={o.value}
                  type="button"
                  className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors", checked ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50")}
                  onClick={() => toggle(o.value)}
                >
                  <Checkbox checked={checked} className="h-3.5 w-3.5 pointer-events-none" />
                  {color ? (
                    <span className={cn("text-[13px] font-medium px-1.5 py-0.5", color)}>{o.label}</span>
                  ) : (
                    <span className="text-[13px] text-foreground">{o.label}</span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-[12px] text-muted-foreground py-2">No results</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {!isEmpty && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="rounded-none p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Clear filter"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, maxLength, suggestions,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; maxLength?: number; suggestions?: string[] }) {
  const listId = useId();
  const hasSugg = (suggestions?.length ?? 0) > 0;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-none h-9" placeholder={placeholder} maxLength={maxLength} list={hasSugg ? listId : undefined} />
      {hasSugg && <datalist id={listId}>{suggestions!.map((s) => <option key={s} value={s} />)}</datalist>}
    </div>
  );
}

function FormSelect({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="rounded-none h-9"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function PhotoUpload({
  label, value, onChange, accept = "image/*",
}: { label: string; value: string; onChange: (url: string) => void; accept?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("candidate-files").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("candidate-files").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const isImage = value && !value.endsWith(".pdf");

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          className={`border-2 border-dashed rounded-none cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5 min-h-[88px] p-2 bg-muted/20 select-none ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"}`}
        >
          {uploading ? (
            <span className="text-xs text-muted-foreground animate-pulse">Uploading…</span>
          ) : dragOver ? (
            <>
              <Upload className="h-5 w-5 text-primary" />
              <span className="text-xs text-primary">Drop to upload</span>
            </>
          ) : value ? (
            <>
              {isImage ? (
                <img src={value} alt={label} className="max-h-[60px] max-w-full object-contain rounded-none" />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{value.split("/").pop()}</span>
                </div>
              )}
              <span className="text-[10px] text-primary">Click or drop to replace</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Click or drag &amp; drop</span>
            </>
          )}
        </div>
        {value && !uploading && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors"
            title="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

function LmisDocSection({
  label, url, onUpload, onRemove,
}: {
  label: string; url: string;
  onUpload: (f: File) => Promise<void>;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const handleFile = async (file: File) => {
    setUploading(true);
    try { await onUpload(file); }
    catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };
  const isImage = url && !url.endsWith(".pdf");
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between min-h-[20px]">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        {url && (
          <button type="button" onClick={() => downloadFile(url)}
            className="flex items-center gap-0.5 text-[11px] text-primary hover:underline">
            <Download className="h-3 w-3" /> Download
          </button>
        )}
      </div>
      <div className="relative">
        <div
          role="button" tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          className={cn(
            "border-2 border-dashed rounded-none cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5 min-h-[90px] p-2 bg-muted/20 select-none",
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/60",
          )}
        >
          {uploading ? (
            <span className="text-xs text-muted-foreground animate-pulse">Uploading…</span>
          ) : dragOver ? (
            <><Upload className="h-5 w-5 text-primary" /><span className="text-xs text-primary">Drop to upload</span></>
          ) : url ? (
            <>
              {isImage
                ? <img src={url} alt={label} className="max-h-[60px] max-w-full object-contain rounded-none" />
                : <><ImageIcon className="h-7 w-7 text-muted-foreground" /><span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{url.split("/").pop()}</span></>}
              <span className="text-[10px] text-primary">Click to replace</span>
            </>
          ) : (
            <><Upload className="h-5 w-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Click or drag &amp; drop</span></>
          )}
        </div>
        {url && !uploading && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

function LmisFilesDialog({
  candidate, onUpdateField, onClose,
}: {
  candidate: Candidate;
  onUpdateField: (field: string, value: string | null) => void;
  onClose: () => void;
}) {
  const c = candidate as any;
  const insuUrl: string = c.lmis_insu_url ?? "";
  const cocUrl: string = c.lmis_coc_url ?? "";
  const idUrl: string = c.lmis_id_url ?? "";
  const idRelUrl: string = c.lmis_id_relative_url ?? "";
  const hasBothIds = !!(idUrl && idRelUrl);

  const upload = async (file: File, field: string) => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `lmis/${candidate.id}/${field}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("candidate-files").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("candidate-files").getPublicUrl(path);
    onUpdateField(field, data.publicUrl);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl rounded-none">
        <DialogHeader>
          <DialogTitle className="text-base">LMIS Documents — {candidate.full_name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 pt-1">
          <LmisDocSection label="INSU" url={insuUrl}
            onUpload={(f) => upload(f, "lmis_insu_url")}
            onRemove={() => onUpdateField("lmis_insu_url", null)} />
          <LmisDocSection label="COC" url={cocUrl}
            onUpload={(f) => upload(f, "lmis_coc_url")}
            onRemove={() => onUpdateField("lmis_coc_url", null)} />
          <LmisDocSection label={hasBothIds ? "ID'S — Candidate" : "ID (Candidate)"} url={idUrl}
            onUpload={(f) => upload(f, "lmis_id_url")}
            onRemove={() => onUpdateField("lmis_id_url", null)} />
          <LmisDocSection label={hasBothIds ? "ID'S — Relative" : "ID (Relative)"} url={idRelUrl}
            onUpload={(f) => upload(f, "lmis_id_relative_url")}
            onRemove={() => onUpdateField("lmis_id_relative_url", null)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TicketFilesDialog({
  candidate, onUpdateField, onClose, showReturnFiles,
}: {
  candidate: Candidate;
  onUpdateField: (field: string, value: string | null) => void;
  onClose: () => void;
  showReturnFiles?: boolean;
}) {
  const c = candidate as any;
  const upload = async (file: File, field: string) => {
    const ext = file.name.split(".").pop() ?? "pdf";
    const path = `ticket-pdfs/${candidate.id}/${field}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("candidate-files").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("candidate-files").getPublicUrl(path);
    onUpdateField(field, data.publicUrl);
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl rounded-none">
        <DialogHeader>
          <DialogTitle className="text-base">Ticket Documents — {candidate.full_name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-4 pt-1">
          <LmisDocSection label="Ticket PDF" url={c.ticket_pdf_url ?? ""}
            onUpload={(f) => upload(f, "ticket_pdf_url")}
            onRemove={() => onUpdateField("ticket_pdf_url", null)} />
          <LmisDocSection label="QR" url={c.qr_url ?? ""}
            onUpload={(f) => upload(f, "qr_url")}
            onRemove={() => onUpdateField("qr_url", null)} />
          <LmisDocSection label="Visa" url={c.visa_pdf_url ?? ""}
            onUpload={(f) => upload(f, "visa_pdf_url")}
            onRemove={() => onUpdateField("visa_pdf_url", null)} />
        </div>
        {showReturnFiles && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-t border-border pt-3">Return Documents</p>
            <div className="grid grid-cols-3 gap-4">
              <LmisDocSection label="Return Ticket" url={c.return_ticket_url ?? ""}
                onUpload={(f) => upload(f, "return_ticket_url")}
                onRemove={() => onUpdateField("return_ticket_url", null)} />
              <LmisDocSection label="Stamp" url={c.stamp_url ?? ""}
                onUpload={(f) => upload(f, "stamp_url")}
                onRemove={() => onUpdateField("stamp_url", null)} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormSection({ title, children, required }: { title: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 pb-1 border-b border-border flex items-center gap-1">
        {title}
        {required && <span className="text-destructive text-xs normal-case tracking-normal">— required</span>}
      </p>
      {children}
    </div>
  );
}

function CancelReasonDialog({
  onConfirm, onClose,
}: {
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("No sponsor");
  const [notes, setNotes] = useState("");
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Candidate</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="rounded-none h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["No sponsor", "Candidate withdrew", "Medical issue", "Visa rejected", "Document issue", "Other"].map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">NOTES</Label>
            <Textarea
              rows={2}
              placeholder="Optional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-none text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Back</Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(notes.trim() ? `${reason}: ${notes.trim()}` : reason)}
          >
            Confirm Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReturnReasonDialog({
  onConfirm, onClose,
}: {
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("Employer request");
  const [notes, setNotes] = useState("");
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark as Returned</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Return Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="rounded-none h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Employer request", "Medical condition", "Personal reasons", "Contract dispute", "Document issue", "Failed clearance", "Other"].map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">NOTES *</Label>
            <Textarea
              rows={3}
              placeholder="Describe the return reason in detail..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-none text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Back</Button>
          <Button
            className="bg-white0 hover:bg-orange-600 text-white"
            disabled={!notes.trim()}
            onClick={() => onConfirm(`${reason}: ${notes.trim()}`)}
          >
            Confirm Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArrivedCheckDialog({
  candidate, onArrived, onNotArrived, onClose,
}: {
  candidate: Candidate;
  onArrived: () => void;
  onNotArrived: (reason: string, problem: string) => void;
  onClose: () => void;
}) {
  const [notArrived, setNotArrived] = useState(false);
  const [reason, setReason] = useState("Visa issue");
  const [problem, setProblem] = useState("");
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Arrival Check — {candidate.full_name}</DialogTitle>
        </DialogHeader>
        {!notArrived ? (
          <>
            <p className="text-sm text-muted-foreground">
              The departure date{" "}
              <strong className="text-foreground">
                {candidate.ticket_date
                  ? new Date(candidate.ticket_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                  : ""}
              </strong>{" "}
              has passed. Did <strong className="text-foreground">{candidate.full_name}</strong> arrive?
            </p>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="ghost" className="sm:mr-auto" onClick={onClose}>Remind Later</Button>
              <Button variant="outline" onClick={() => setNotArrived(true)}>No — Not Arrived</Button>
              <Button onClick={onArrived}>Yes — Arrived</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="rounded-none h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Visa issue", "Flight issue", "Health issue", "Sponsor issue", "Other"].map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Problem Description</Label>
                <Textarea
                  rows={3}
                  placeholder="Describe the issue..."
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  className="rounded-none text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setNotArrived(false)}>Back</Button>
              <Button disabled={!problem.trim()} onClick={() => onNotArrived(reason, problem)}>
                Save & Stay in Processing
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CandidatePhotosDialog({ candidate, onClose }: { candidate: Candidate | null; onClose: () => void }) {
  if (!candidate) return null;
  const photos = [
    { label: "Photo", url: candidate.photo_url },
    { label: "Full Size Photo", url: (candidate as any).full_photo_url as string | null },
    { label: "Passport Scan", url: candidate.passport_scan_url },
  ].filter((p) => p.url);

  return (
    <Dialog open={!!candidate} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">{candidate.full_name}</DialogTitle>
        </DialogHeader>
        {photos.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">No photos uploaded.</div>
        ) : (
          <div className="grid grid-cols-3 gap-4 py-2">
            {photos.map((p) => (
              <div key={p.label} className="flex flex-col items-center gap-2">
                <a href={p.url!} target="_blank" rel="noreferrer" className="block hover:opacity-80 transition-opacity">
                  <img
                    src={p.url!}
                    alt={p.label}
                    className="w-full max-h-52 object-contain border border-border bg-muted/30"
                  />
                </a>
                <span className="text-[11px] text-muted-foreground font-medium">{p.label}</span>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Excel Import ─────────────────────────────────────────────────────────────

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
      { "Medical Status": "Unfit",   "COC Status": "No",   "Country": "",             "Remark": "Failed medical",       "Notes": "" },
      { "Medical Status": "Fit",     "COC Status": "No",   "Country": "Saudi Arabia", "Remark": "Withdrew application", "Notes": "" },
      { "Medical Status": "Booked",  "COC Status": "No",   "Country": "",             "Remark": "Not reachable",        "Notes": "" },
      { "Medical Status": "Fit",     "COC Status": "Done", "Country": "Kuwait",       "Remark": "Visa canceled",        "Notes": "" },
      { "Medical Status": "Fit",     "COC Status": "No",   "Country": "",             "Remark": "Duplicate entry",      "Notes": "" },
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

function ImportExcelButton({ onImported, status, countryOptions }: { onImported: () => void; status: Status; countryOptions: string[] }) {
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
