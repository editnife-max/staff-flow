import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ActionDialog } from "@/components/action-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, FilePlus, FileText, Pencil, Trash2, FileSignature, Calendar,
  SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight,
  ArrowUpDown, Users, User, BookOpen, Stethoscope, Briefcase, FileCheck,
  Globe, Send, Activity, ClipboardPaste, Upload, ImageIcon, AlertTriangle, Table2,
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
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  upsertCandidate, deleteCandidate, updateCandidateField,
  bulkDeleteCandidates, bulkUpdateStatus, bulkAssignStaff, bulkUpdateField,
  bulkImportCandidates,
} from "@/lib/candidates.functions";
import { UserCheck, X } from "lucide-react";
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
const INSURANCE_OPTIONS = ["Done", "Pending", "No", "Expired"];
const LMIS_OPTIONS = [
  "No COC", "Not tested", "Placed", "Imported", "Checked",
  "Verified", "Draft", "Pending", "Issued", "Rejected",
];
const UNFILLED_LMIS_OPTIONS = ["INSU", "COC", "ID"];
const TICKET_OPTIONS = ["No", "Ready", "New Order", "Booked", "Exchange", "Urgent"];
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

const SKILLS_LIST = [
  "Cooking", "Cleaning", "Childcare", "Eldercare", "Ironing",
  "Driving", "Gardening", "Sewing", "Babysitting", "Pet Care", "Nursing",
];

const OPTION_COLORS: Record<string, string> = {
  // Medical
  "Fit":               "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  "Unfit":             "bg-red-100/50 text-[#181A27] dark:bg-red-900/40 dark:text-red-300",
  "In progress":       "bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
  "Expired":           "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
  "No":                "bg-zinc-100/50 text-[#181A27] dark:bg-zinc-800 dark:text-zinc-400",
  // COC / shared
  "Done":              "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  "Booked":            "bg-blue-100/50 text-[#181A27] dark:bg-blue-900/40 dark:text-blue-300",
  "Placed":            "bg-violet-100/50 text-[#181A27] dark:bg-violet-900/40 dark:text-violet-300",
  "Yitazez":           "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
  "Pending release":   "bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
  // Tasheer
  "Ready":             "bg-violet-100/50 text-[#181A27] dark:bg-violet-900/40 dark:text-violet-300",
  // Wokala
  "Paid":              "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  "Unpaid":            "bg-red-100/50 text-[#181A27] dark:bg-red-900/40 dark:text-red-300",
  // Visa
  "Ready for embassy": "bg-sky-100/50 text-[#181A27] dark:bg-sky-900/40 dark:text-sky-300",
  "Sent to Embassy":   "bg-violet-100/50 text-[#181A27] dark:bg-violet-900/40 dark:text-violet-300",
  "Privately Sent":    "bg-cyan-100/50 text-[#181A27] dark:bg-cyan-900/40 dark:text-cyan-300",
  "Issued":            "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  "Visa canceled":     "bg-red-100/50 text-[#181A27] dark:bg-red-900/40 dark:text-red-300",
  "Arrived KSA":       "bg-green-100/50 text-[#181A27] dark:bg-green-900/40 dark:text-green-300",
  "Returned":          "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
  "Waiting Replacement":"bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
  // Insurance
  "Pending":           "bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
  // LMIS
  "No COC":            "bg-red-100/50 text-[#181A27] dark:bg-red-900/40 dark:text-red-300",
  "Not tested":        "bg-zinc-100/50 text-[#181A27] dark:bg-zinc-800 dark:text-zinc-400",
  "Imported":          "bg-violet-100/50 text-[#181A27] dark:bg-violet-900/40 dark:text-violet-300",
  "Checked":           "bg-teal-100/50 text-[#181A27] dark:bg-teal-900/40 dark:text-teal-300",
  "Verified":          "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  "Draft":             "bg-zinc-100/50 text-[#181A27] dark:bg-zinc-800 dark:text-zinc-400",
  "Rejected":          "bg-red-100/50 text-[#181A27] dark:bg-red-900/40 dark:text-red-300",
  // Ticket
  "New Order":         "bg-blue-100/50 text-[#181A27] dark:bg-blue-900/40 dark:text-blue-300",
  "Exchange":          "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
  "Urgent":            "bg-red-100/50 text-[#181A27] dark:bg-red-900/40 dark:text-red-300",
  // Arrival city
  "RIYADH":            "bg-violet-100/50 text-[#181A27] dark:bg-violet-900/40 dark:text-violet-300",
  "JEDDAH":            "bg-blue-100/50 text-[#181A27] dark:bg-blue-900/40 dark:text-blue-300",
  "DAMMAM":            "bg-cyan-100/50 text-[#181A27] dark:bg-cyan-900/40 dark:text-cyan-300",
  "JOUF":              "bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
  "HAIL":              "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
  "ABHA":              "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  "OTHERS":            "bg-zinc-100/50 text-[#181A27] dark:bg-zinc-800 dark:text-zinc-400",
  // Passport
  "Submitted":         "bg-blue-100/50 text-[#181A27] dark:bg-blue-900/40 dark:text-blue-300",
  "Received":          "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  // Availability/status
  "available":         "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  "processing":        "bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
  "arrived":           "bg-blue-100/50 text-[#181A27] dark:bg-blue-900/40 dark:text-blue-300",
  "canceled":          "bg-red-100/50 text-[#181A27] dark:bg-red-900/40 dark:text-red-300",
  "returned":          "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
  // Office
  "Riyadh":            "bg-violet-100/50 text-[#181A27] dark:bg-violet-900/40 dark:text-violet-300",
  "Jeddah":            "bg-blue-100/50 text-[#181A27] dark:bg-blue-900/40 dark:text-blue-300",
  "Dammam":            "bg-cyan-100/50 text-[#181A27] dark:bg-cyan-900/40 dark:text-cyan-300",
  "Other":             "bg-zinc-100/50 text-[#181A27] dark:bg-zinc-800 dark:text-zinc-400",
  // Musaned
  "Saudi":             "bg-green-100/50 text-[#181A27] dark:bg-green-900/40 dark:text-green-300",
  "Kuwait":            "bg-teal-100/50 text-[#181A27] dark:bg-teal-900/40 dark:text-teal-300",
  // LMIS file
  "INSU":              "bg-rose-100/50 text-[#181A27] dark:bg-rose-900/40 dark:text-rose-300",
  "COC":               "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
  "ID":                "bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
  // Age ranges
  "18-25":             "bg-sky-100/50 text-[#181A27] dark:bg-sky-900/40 dark:text-sky-300",
  "26-35":             "bg-blue-100/50 text-[#181A27] dark:bg-blue-900/40 dark:text-blue-300",
  "36-45":             "bg-violet-100/50 text-[#181A27] dark:bg-violet-900/40 dark:text-violet-300",
  "46-99":             "bg-indigo-100/50 text-[#181A27] dark:bg-indigo-900/40 dark:text-indigo-300",
  // Gender
  "Male":              "bg-blue-100/50 text-[#181A27] dark:bg-blue-900/40 dark:text-blue-300",
  "Female":            "bg-pink-100/50 text-[#181A27] dark:bg-pink-900/40 dark:text-pink-300",
  // Religion
  "Muslim":            "bg-teal-100/50 text-[#181A27] dark:bg-teal-900/40 dark:text-teal-300",
  "Non-muslim":        "bg-slate-100/50 text-[#181A27] dark:bg-slate-800 dark:text-slate-400",
  // Experience / Languages
  "Experienced":       "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  "Non-Experienced":   "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
  "Yes":               "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  "None":              "bg-zinc-100/50 text-[#181A27] dark:bg-zinc-800 dark:text-zinc-400",
  // Sort
  "newest":            "bg-sky-100/50 text-[#181A27] dark:bg-sky-900/40 dark:text-sky-300",
  "oldest":            "bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
};

type ProcessingColDef =
  | { key: string; header: string; type: "text" | "date" }
  | { key: string; header: string; type: "select"; options: string[] }
  | { key: string; header: string; type: "select-dynamic" };

const PROCESSING_COLS: ProcessingColDef[] = [
  { key: "narrative",         header: "Narrative",         type: "text" },
  { key: "narrative_phone",   header: "Narrative Phone",   type: "text" },
  { key: "contract_date",     header: "Contract Date",     type: "date" },
  { key: "medical_status",    header: "Medical",           type: "select", options: MEDICAL_OPTIONS },
  { key: "medical_date",      header: "Medical Date",      type: "date" },
  { key: "medical_days",      header: "Medical Days",      type: "text" },
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
  { key: "arrival_city",      header: "Arrival City",      type: "select", options: ARRIVAL_CITY_OPTIONS },
  { key: "processing_notes",  header: "Note",              type: "text" },
  { key: "emergency_contact", header: "Emergency Contact", type: "text" },
];

const CANDIDATE_CARD_COLS = [
  "FULL NAME", "CANDIDATE CODE", "GENDER", "AGE", "RELIGION", "MARITAL STATUS",
  "BIRTH PLACE", "LIVING TOWN", "PASSPORT NUMBER", "LABOUR ID",
  "OFFICE", "PASSPORT STATUS", "COC STATUS", "COUNTRY", "MEDICAL STATUS",
  "MEDICAL DATE", "AVAILABILITY", "SELECTED BY", "CV SENT TO", "CV SENT DATE",
  "NARRATIVE", "NARRATIVE PHONE", "NOTES",
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
  occupation: "",
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
};

const initialFilters = {
  sort: "newest",
  education: "all",
  age: "all",
  marital: "all",
  gender: "all",
  religion: "all",
  medical: [] as string[],
  narrative: "all",
  experience: "all",
  coc: [] as string[],
  musaned: [] as string[],
  cv_sent_to: "all",
  selected_by: "all",
  availability: "all",
  from: "",
  to: "",
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

  return result as Partial<typeof initialForm>;
}


function StaffCandidatesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const upsert = useServerFn(upsertCandidate);
  const remove = useServerFn(deleteCandidate);
  const bulkDel = useServerFn(bulkDeleteCandidates);
  const bulkStatus = useServerFn(bulkUpdateStatus);
  const bulkAssign = useServerFn(bulkAssignStaff);
  const bulkField = useServerFn(bulkUpdateField);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSelection = () => setSelected(new Set());
  const [actionCandidates, setActionCandidates] = useState<Candidate[]>([]);

  const [tab, setTab] = useState<Status>("available");
  const [passport, setPassport] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState(initialFilters);
  const activeCount = Object.entries(filters).filter(([k, v]) =>
    k !== "sort" && (Array.isArray(v) ? v.length > 0 : v && v !== "all")
  ).length;
  useEffect(() => { setFilters(initialFilters); setPassport(""); }, [tab]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [form, setForm] = useState(initialForm);

  const { data: candidates = [] } = useQuery({
    queryKey: ["staff-candidates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
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
      const [agenciesRes, officesRes] = await Promise.all([
        supabase.from("foreign_agencies").select("name").order("name"),
        supabase.from("assignment_offices").select("name").order("name"),
      ]);
      const names = [
        ...(agenciesRes.data ?? []).map((a) => a.name),
        ...(officesRes.data ?? []).map((o) => o.name),
      ];
      return [...new Set(names)].filter(Boolean).sort();
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

  const opts = useMemo(() => {
    const uniq = (k: keyof Candidate) =>
      Array.from(new Set(candidates.map((c) => (c[k] as string | null) ?? "").filter(Boolean))).sort();
    return {
      education: uniq("education"),
      marital: uniq("marital_status"),
      gender: uniq("gender"),
      religion: uniq("religion"),
      narrative: uniq("narrative"),
      experience: uniq("experience"),
      cv_sent_to: uniq("cv_sent_to"),
      coc: uniq("coc_status"),
      musaned: uniq("musaned_status"),
      availability: uniq("status"),
    };
  }, [candidates]);

  const filtered = useMemo(() => {
    let list = candidates.filter((c) => c.status === tab);
    // Processing tab handles its own filtering inside ProcessingTable
    if (tab === "processing") return list;
    if (passport) list = list.filter((c) => (c.passport_number ?? "").toLowerCase().includes(passport.toLowerCase()));
    if (filters.education !== "all") list = list.filter((c) => c.education === filters.education);
    if (filters.marital !== "all") list = list.filter((c) => c.marital_status === filters.marital);
    if (filters.gender !== "all") list = list.filter((c) => c.gender === filters.gender);
    if (filters.religion !== "all") list = list.filter((c) => c.religion === filters.religion);
    if (filters.medical.length > 0) list = list.filter((c) => filters.medical.includes(c.medical_status ?? ""));
    if (filters.narrative !== "all") list = list.filter((c) => c.narrative === filters.narrative);
    if (filters.experience !== "all") list = list.filter((c) => c.experience === filters.experience);
    if (filters.coc.length > 0) list = list.filter((c) => filters.coc.includes(c.coc_status ?? ""));
    if (filters.musaned.length > 0) list = list.filter((c) => filters.musaned.includes(c.musaned_status ?? ""));
    if (filters.cv_sent_to !== "all") list = list.filter((c) => c.cv_sent_to === filters.cv_sent_to);
    if (filters.selected_by !== "all") list = list.filter((c) => c.selected_by === filters.selected_by);
    if (filters.availability !== "all") list = list.filter((c) => c.status === filters.availability);
    if (filters.age !== "all") {
      const [min, max] = filters.age.split("-").map(Number);
      list = list.filter((c) => c.age != null && c.age >= min && c.age <= max);
    }
    if (filters.from) list = list.filter((c) => c.created_at >= filters.from);
    if (filters.to) list = list.filter((c) => c.created_at <= filters.to + "T23:59:59");
    list = [...list].sort((a, b) =>
      filters.sort === "newest"
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at),
    );
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
    mutationFn: async () => bulkDel({ data: { ids: Array.from(selected) } }),
    onSuccess: (r) => {
      toast.success(`Deleted ${r.count} candidate(s)`);
      qc.invalidateQueries({ queryKey: ["staff-candidates"] });
      clearSelection();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkStatusMut = useMutation({
    mutationFn: async (status: Status) =>
      bulkStatus({ data: { ids: Array.from(selected), status } }),
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
    mutationFn: ({ field, value }: { field: string; value: string }) =>
      bulkField({ data: { ids: Array.from(selected), field: field as any, value } }),
    onSuccess: (r, { field, value }) => {
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
    mutationFn: async (readyForEmbassy: boolean) => {
      const ids = Array.from(selected);
      await bulkField({ data: { ids, field: "tasheer_status", value: "Done" } });
      if (readyForEmbassy) {
        await bulkField({ data: { ids, field: "visa_status", value: "Ready for embassy" } });
      } else if (tasheerDoneReason.trim()) {
        await bulkField({ data: { ids, field: "processing_notes", value: tasheerDoneReason.trim() } });
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

  const openCreate = () => {
    let max = 0;
    for (const c of candidates) {
      const m = (c.candidate_code ?? "").match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    const nextCode = `C-${String(max + 1).padStart(4, "0")}`;
    setEditing(null);
    setForm({ ...initialForm, status: tab, candidate_code: nextCode });
    setOpen(true);
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
      occupation: c.occupation ?? "",
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
      musaned_status: c.musaned_status ?? "",
      status: (c.status as Status) ?? "available",
      office: c.office ?? "",
      selected_by: c.selected_by ?? "",
      narrative: c.narrative ?? "",
      narrative_phone: c.narrative_phone ?? "",
      skills: c.skills ?? "",
      remark: c.remark ?? "",
      notes: c.notes ?? "",
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
          {tab === "available" && (
            <>
              <ImportExcelButton onImported={() => qc.invalidateQueries({ queryKey: ["staff-candidates"] })} />
              <Button size="sm" className="gap-2 text-xs h-8 rounded-none" onClick={openCreate}>
                <FilePlus className="h-4 w-4" /> ADD NEW CANDIDATE
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters — hidden on Processing tab and when bulk bar is open */}
      {tab !== "processing" && selected.size === 0 && <Card className="rounded-none">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              className="flex items-center gap-2 text-xs font-bold text-foreground hover:text-primary transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
              Filters
              {activeCount > 0 && (
                <span className="rounded-none bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                  {activeCount}
                </span>
              )}
              {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs"
              onClick={() => { setFilters(initialFilters); setPassport(""); }}
              disabled={activeCount === 0 && !passport}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
          {showFilters && (
          <>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <FilterSelect value={filters.sort} onChange={(v) => setFilters({ ...filters, sort: v })}
              icon={ArrowUpDown}
              options={[{ value: "newest", label: "Date (Newest)" }, { value: "oldest", label: "Date (Oldest)" }]} />
            <FilterSelect placeholder="Age" value={filters.age} icon={Users}
              onChange={(v) => setFilters({ ...filters, age: v })}
              options={[
                { value: "all", label: "-----" },
                { value: "18-25", label: "18-25" }, { value: "26-35", label: "26-35" },
                { value: "36-45", label: "36-45" }, { value: "46-99", label: "46+" },
              ]} />
            <FilterSelect placeholder="Gender" value={filters.gender} icon={User}
              onChange={(v) => setFilters({ ...filters, gender: v })}
              options={[{ value: "all", label: "-----" }, { value: "Male", label: "Male" }, { value: "Female", label: "Female" }]} />
            <FilterSelect placeholder="Religion" value={filters.religion} icon={BookOpen}
              onChange={(v) => setFilters({ ...filters, religion: v })}
              options={[{ value: "all", label: "-----" }, { value: "Muslim", label: "Muslim" }, { value: "Non-muslim", label: "Non-muslim" }]} />
            <MultiFilterSelect placeholder="Medical" values={filters.medical} icon={Stethoscope}
              onChange={(v) => setFilters({ ...filters, medical: v })}
              options={MEDICAL_OPTIONS.map((o) => ({ value: o, label: o }))} />
            <FilterSelect placeholder="Narrative" value={filters.narrative} icon={FileText}
              onChange={(v) => setFilters({ ...filters, narrative: v })}
              options={[{ value: "all", label: "-----" }, ...opts.narrative.map((o) => ({ value: o, label: o }))]} />
            <FilterSelect placeholder="Experience" value={filters.experience} icon={Briefcase}
              onChange={(v) => setFilters({ ...filters, experience: v })}
              options={[{ value: "all", label: "-----" }, { value: "Yes", label: "Yes" }, { value: "No", label: "No" }, { value: "None", label: "None" }]} />
            <MultiFilterSelect placeholder="COC" values={filters.coc} icon={FileCheck}
              onChange={(v) => setFilters({ ...filters, coc: v })}
              options={["Done","No","Booked","Placed","Yitazez","Pending Release"].map((o) => ({ value: o, label: o }))} />
            <MultiFilterSelect placeholder="Country" values={filters.musaned} icon={Globe}
              onChange={(v) => setFilters({ ...filters, musaned: v })}
              options={assignCountries.map((c) => ({ value: c.name, label: c.name }))} />
            <FilterSelect placeholder="Selected By" value={filters.selected_by} icon={ClipboardPaste}
              onChange={(v) => setFilters({ ...filters, selected_by: v })}
              options={[{ value: "all", label: "-----" }, ...agencyOptions.map((o) => ({ value: o, label: o }))]} />
            <FilterSelect placeholder="CV Sent To" value={filters.cv_sent_to} icon={Send}
              onChange={(v) => setFilters({ ...filters, cv_sent_to: v })}
              options={[{ value: "all", label: "-----" }, ...agencyOptions.map((o) => ({ value: o, label: o }))]} />
            <FilterSelect placeholder="Availability" value={filters.availability} icon={Activity}
              onChange={(v) => setFilters({ ...filters, availability: v })}
              options={[
                { value: "all", label: "-----" },
                ...(["available", "processing", "arrived", "returned", "canceled"] as const)
                  .filter((s) => opts.availability.includes(s))
                  .map((o) => ({ value: o, label: o.charAt(0).toUpperCase() + o.slice(1) })),
              ]} />
            <DateField label="From Date" value={filters.from} onChange={(v) => setFilters({ ...filters, from: v })} />
            <DateField label="To Date" value={filters.to} onChange={(v) => setFilters({ ...filters, to: v })} />
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <div className="relative w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-9 h-8 text-xs rounded-none" placeholder="Passport Number" value={passport} onChange={(e) => setPassport(e.target.value)} />
            </div>
          </div>
          </>
          )}
        </CardContent>
      </Card>}

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
                <span className={cn(
                  "ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full font-semibold",
                  tab === t.key ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}>
                  {counts[t.key] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {visaReturnedOpen && (
        <Card className="border-rose-400/60 bg-rose-50/60 dark:bg-rose-900/20">
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
        <Card className="border-violet-400/60 bg-violet-50/60 dark:bg-violet-900/20">
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
        <Card className="border-amber-400/60 bg-amber-50/60 dark:bg-amber-900/20">
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

      {/* Bulk actions */}
      {selected.size > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold pl-1">
              {selected.size} selected
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
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

              {BULK_FIELD_DEFS.filter((fd) => !fd.processingOnly || tab === "processing").map((fd) => {
                const opts = Array.from(new Set(
                  filtered.map((c) => (c[fd.key as keyof Candidate] as string | null) ?? "").filter(Boolean)
                )).sort();
                if (opts.length === 0) return null;
                return (
                  <Select key={fd.key} onValueChange={(v) => {
                    if (fd.key === "ticket_status" && v === "Booked") { setTicketDateOpen(true); }
                    else if (fd.key === "tasheer_status" && v === "Booked") { setTasheerDateOpen(true); }
                    else if (fd.key === "tasheer_status" && v === "Done") {
                      const hasWokalaPaid = candidates.filter((c) => selected.has(c.id)).some((c) => c.wokala_status === "Paid");
                      if (hasWokalaPaid) { setTasheerDoneOpen(true); setTasheerDoneStep("ask"); setTasheerDoneReason(""); }
                      else { bulkFieldMut.mutate({ field: fd.key, value: v }); }
                    }
                    else if (fd.key === "visa_status" && v === "Returned") {
                      const blocked = candidates.filter((c) => selected.has(c.id) && (c.status !== "processing" || c.tasheer_status !== "Done" || c.wokala_status !== "Paid")).length;
                      if (blocked > 0) { toast.error(`${blocked} candidate(s) must be Processing with Tasheer = Done and Wokala = Paid`); }
                      else { setVisaReturnedOpen(true); setVisaReturnedReason(""); }
                    }
                    else if (fd.key === "visa_status" && v === "Ready for embassy") {
                      const blocked = candidates.filter((c) => selected.has(c.id) && (c.status !== "processing" || c.tasheer_status !== "Done" || c.wokala_status !== "Paid"));
                      if (blocked.length > 0) { toast.error(`${blocked.length} candidate(s) must be Processing with Tasheer = Done and Wokala = Paid`); }
                      else { bulkFieldMut.mutate({ field: fd.key, value: v }); }
                    }
                    else { bulkFieldMut.mutate({ field: fd.key, value: v }); }
                  }}>
                    <SelectTrigger className="h-9 w-[120px]">
                      <SelectValue placeholder={fd.label} />
                    </SelectTrigger>
                    <SelectContent>
                      {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                );
              })}

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
          }}
          onEdit={openEdit}
          cancelMode
          onDelete={(id) => fieldMut.mutate({ id, field: "status", value: "canceled" })}
          countryMeta={countryMeta}
          officesByCountry={officesByCountry}
        />
      ) : (
        <CandidateCardList
          candidates={filtered}
          selected={selected}
          onToggleSelect={toggleSelect}
          onAction={(c) => setActionCandidates([c])}
          onEdit={openEdit}
          cancelMode={tab === "available"}
          onDelete={(id) =>
            tab === "available"
              ? fieldMut.mutate({ id, field: "status", value: "canceled" })
              : removeMut.mutate(id)
          }
          onUpdateField={(id, field, value) => fieldMut.mutate({ id, field, value })}
          onReturn={tab === "arrived" ? (id) => fieldMut.mutate({ id, field: "status", value: "returned" }) : undefined}
          countryMeta={tab === "available" ? [] : countryMeta}
          officesByCountry={tab === "available" ? {} : officesByCountry}
          agencyOptions={agencyOptions}
        />
      )}

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
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
                <Field label="Birth Place" value={form.birth_place} onChange={(v) => setForm({ ...form, birth_place: v })} />
                <Field label="Living Town" value={form.living_town} onChange={(v) => setForm({ ...form, living_town: v })} />
                <FormSelect label="Marital Status" value={form.marital_status} onChange={(v) => setForm({ ...form, marital_status: v })} options={["Single", "Married", "Divorced", "Widowed"]} />
                <Field label="Children" type="number" value={String(form.children)} onChange={(v) => setForm({ ...form, children: v })} />
                <FormSelect label="Education" value={form.education} onChange={(v) => setForm({ ...form, education: v })} options={["Illiterate", "Primary", "Secondary", "High School", "Diploma", "Degree", "Master's", "PhD"]} />
              </div>
            </FormSection>

            {/* Passport */}
            <FormSection title="Passport" required>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Passport Number *" value={form.passport_number} onChange={(v) => setForm({ ...form, passport_number: v })} />
                <Field label="Labour ID" value={form.labour_id} onChange={(v) => setForm({ ...form, labour_id: v })} />
                <Field label="Issue Date" type="date" value={form.passport_issue_date} onChange={(v) => setForm({ ...form, passport_issue_date: v })} />
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
                <FormSelect label="Work Experience" value={form.experience} onChange={(v) => setForm({ ...form, experience: v, experience_country: v !== "Yes" ? "" : form.experience_country, experience_years: v !== "Yes" ? "" : form.experience_years })} options={["Yes", "No", "None"]} />
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
                <FormSelect label="Passport Status" value={form.passport_status} onChange={(v) => setForm({ ...form, passport_status: v })} options={PASSPORT_OPTIONS} />
                <FormSelect label="Medical Status" value={form.medical_status} onChange={(v) => setForm({ ...form, medical_status: v })} options={MEDICAL_OPTIONS} />
                <FormSelect label="COC Status" value={form.coc_status} onChange={(v) => setForm({ ...form, coc_status: v })} options={COC_OPTIONS} />
                <FormSelect label="Country" value={form.musaned_status} onChange={(v) => setForm({ ...form, musaned_status: v })} options={assignCountries.map((c) => c.name)} />
              </div>
            </FormSection>

            {/* Narrative */}
            <FormSection title="Narrative">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Narrative" value={form.narrative} onChange={(v) => setForm({ ...form, narrative: v })} />
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
                if (!form.passport_number?.trim() || !form.passport_expiry_date) {
                  toast.error("Passport Number and Expiry Date are required"); return;
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
      {actionCandidates.length > 0 && (
        <ActionDialog candidates={actionCandidates} onClose={() => setActionCandidates([])} />
      )}

      {/* Tasheer Done — embassy readiness dialog */}
      <Dialog open={tasheerDoneOpen} onOpenChange={(o) => { if (!o) { setTasheerDoneOpen(false); setTasheerDoneStep("ask"); setTasheerDoneReason(""); } }}>
        <DialogContent className="max-w-sm">
          {tasheerDoneStep === "ask" ? (
            <>
              <DialogHeader>
                <DialogTitle>Ready for Embassy Visa?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Tasheer is Done for <strong>{selected.size}</strong> candidate{selected.size !== 1 ? "s" : ""}.
                Are they ready for embassy visa?
              </p>
              <DialogFooter className="flex gap-2 sm:justify-start">
                <Button disabled={tasheerDoneMut.isPending} onClick={() => tasheerDoneMut.mutate(true)}>
                  {tasheerDoneMut.isPending ? "Updating…" : "Yes — Ready for Embassy"}
                </Button>
                <Button variant="outline" onClick={() => setTasheerDoneStep("reason")}>
                  No — Enter Reason
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Reason Not Ready</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">Why are these candidates not ready for embassy visa?</p>
              <Textarea
                rows={3}
                placeholder="Enter reason…"
                value={tasheerDoneReason}
                onChange={(e) => setTasheerDoneReason(e.target.value)}
              />
              <DialogFooter className="flex gap-2">
                <Button variant="ghost" onClick={() => setTasheerDoneStep("ask")}>Back</Button>
                <Button
                  disabled={tasheerDoneMut.isPending || !tasheerDoneReason.trim()}
                  onClick={() => tasheerDoneMut.mutate(false)}
                >
                  {tasheerDoneMut.isPending ? "Updating…" : "Submit"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

type EditableField =
  | "notes" | "narrative" | "occupation" | "living_town" | "selected_by"
  | "medical_status" | "status" | "office" | "passport_status"
  | "musaned_status" | "coc_status"
  | "narrative_phone" | "contract_date" | "medical_date" | "medical_days"
  | "tasheer_status" | "tasheer_date" | "wokala_status" | "embassy_date"
  | "visa_status" | "insurance_status" | "unfilled_lmis" | "lmis_status"
  | "ticket_status" | "ticket_date" | "arrival_city" | "emergency_contact"
  | "processing_notes" | "remark" | "cv_sent_to";

function CandidateCardList({
  candidates, selected, onToggleSelect, onAction, onEdit, onDelete, onUpdateField, cancelMode, onReturn,
  countryMeta, officesByCountry, agencyOptions,
}: {
  candidates: Candidate[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onAction: (c: Candidate) => void;
  onEdit: (c: Candidate) => void;
  onDelete: (id: string) => void;
  onUpdateField: (id: string, field: string, value: string | null) => void;
  cancelMode?: boolean;
  onReturn?: (id: string) => void;
  countryMeta: Array<{ name: string; flag: string }>;
  officesByCountry: Record<string, string[]>;
  agencyOptions: string[];
}) {
  const [viewingPhotos, setViewingPhotos] = useState<Candidate | null>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [showColPicker, setShowColPicker] = useState(false);
  const [activeCountryTab, setActiveCountryTab] = useState("all");
  const [activeOfficeTab, setActiveOfficeTab] = useState("all");

  const countryOptions = useMemo(() => countryMeta.map((c) => c.name), [countryMeta]);

  const filtered = useMemo(() => {
    let list = candidates;
    if (activeCountryTab !== "all") list = list.filter((c) => c.destination_country === activeCountryTab);
    if (activeOfficeTab !== "all") list = list.filter((c) => c.office === activeOfficeTab);
    return list;
  }, [candidates, activeCountryTab, activeOfficeTab]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  useEffect(() => { setPage(1); }, [filtered.length, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const allSel = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const someSel = !allSel && filtered.some((c) => selected.has(c.id));
  const visibleCols = (CANDIDATE_CARD_COLS as readonly string[]).filter((l) => !hiddenCols.has(l));

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
                const count = candidates.filter((cand) => cand.destination_country === c.name).length;
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
                const count = candidates.filter((c) => c.destination_country === activeCountryTab && c.office === office).length;
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
                filtered.forEach((c) => { if (!!v !== selected.has(c.id)) onToggleSelect(c.id); })
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
            <div className="relative">
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
                    {CANDIDATE_CARD_COLS.map((label) => (
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
        <div className="overflow-x-auto">
          <div className="space-y-2 min-w-max">
            {paginated.map((c) => (
              <CandidateCard
                key={c.id}
                candidate={c}
                selected={selected.has(c.id)}
                visibleCols={visibleCols}
                cancelMode={cancelMode}
                onToggleSelect={() => onToggleSelect(c.id)}
                onViewPhotos={() => setViewingPhotos(c)}
                onAction={() => onAction(c)}
                onEdit={() => onEdit(c)}
                onDelete={() => onDelete(c.id)}
                onUpdateField={(field, value) => onUpdateField(c.id, field, value)}
                onReturn={onReturn ? () => onReturn(c.id) : undefined}
                agencyOptions={agencyOptions}
                countryOptions={countryOptions}
              />
            ))}
          </div>
        </div>
      )}
      <CandidatePhotosDialog candidate={viewingPhotos} onClose={() => setViewingPhotos(null)} />
      {filtered.length > 0 && (
        <div className="sticky bottom-0 z-10 bg-background flex items-center justify-between px-4 py-2 shadow-[0_-1px_3px_rgba(0,0,0,0.06)] flex-wrap gap-2">
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
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <ChevronUp className="h-3.5 w-3.5" /> Back to top
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CandidateCard({
  candidate, selected, visibleCols, onToggleSelect, onViewPhotos, onAction, onEdit, onDelete, onUpdateField, cancelMode, onReturn, agencyOptions, countryOptions,
}: {
  candidate: Candidate;
  selected: boolean;
  visibleCols: readonly string[];
  cancelMode?: boolean;
  onToggleSelect: () => void;
  onViewPhotos: () => void;
  onAction: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateField: (field: EditableField, value: string | null) => void;
  onReturn?: () => void;
  agencyOptions: string[];
  countryOptions: string[];
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const statusKey = (["available","processing","arrived","canceled","returned"].includes(candidate.status ?? "")
    ? candidate.status : "available") as Status;

  type FieldDef =
    | { label: string; value: string; bold?: boolean }
    | { label: string; value: string; edit: "text"; field: EditableField; long?: boolean }
    | { label: string; value: string; edit: "date"; field: EditableField }
    | { label: string; value: string; edit: "select"; field: EditableField; options: string[] };

  const allFields: FieldDef[] = [
    { label: "FULL NAME", value: candidate.full_name, bold: true },
    { label: "CANDIDATE CODE", value: candidate.candidate_code ?? "—" },
    { label: "GENDER", value: candidate.gender ?? "—" },
    { label: "AGE", value: candidate.age != null ? String(candidate.age) : "—" },
    { label: "RELIGION", value: candidate.religion ?? "—" },
    { label: "MARITAL STATUS", value: candidate.marital_status ?? "—" },
    { label: "BIRTH PLACE", value: candidate.birth_place ?? "—" },
    { label: "LIVING TOWN", value: candidate.living_town ?? "", edit: "text", field: "living_town" },
    { label: "PASSPORT NUMBER", value: candidate.passport_number ?? "—" },
    { label: "LABOUR ID", value: candidate.labour_id ?? "—" },
    { label: "OFFICE", value: candidate.office ?? "", edit: "select", field: "office", options: OFFICE_OPTIONS },
    { label: "PASSPORT STATUS", value: candidate.passport_status ?? "", edit: "select", field: "passport_status", options: PASSPORT_OPTIONS },
    { label: "COC STATUS", value: candidate.coc_status ?? "", edit: "select", field: "coc_status", options: COC_OPTIONS },
    { label: "COUNTRY", value: candidate.musaned_status ?? "", edit: "select", field: "musaned_status", options: countryOptions },
    { label: "MEDICAL STATUS", value: candidate.medical_status ?? "", edit: "select", field: "medical_status", options: MEDICAL_OPTIONS },
    { label: "MEDICAL DATE", value: candidate.medical_date ? new Date(candidate.medical_date).toLocaleDateString() : "—" },
    { label: "AVAILABILITY", value: statusKey, edit: "select", field: "status", options: AVAILABILITY_OPTIONS },
    { label: "SELECTED BY", value: candidate.selected_by ?? "", edit: "select", field: "selected_by", options: agencyOptions },
    { label: "CONTRACT DATE", value: candidate.contract_date ?? "", edit: "date", field: "contract_date" },
    { label: "CV SENT TO", value: candidate.cv_sent_to ?? "", edit: "select", field: "cv_sent_to", options: agencyOptions },
    { label: "CV SENT DATE", value: candidate.cv_sent_date ? new Date(candidate.cv_sent_date).toLocaleDateString() : "—" },
    { label: "NARRATIVE", value: candidate.narrative ?? "", edit: "text", field: "narrative", long: true },
    { label: "NARRATIVE PHONE", value: candidate.narrative_phone ?? "", edit: "text", field: "narrative_phone" },
    { label: "NOTES", value: candidate.notes ?? "", edit: "text", field: "notes", long: true },
  ];

  return (
    <>
      <div className={cn(
        "bg-white border border-border shadow-sm rounded-sm overflow-hidden transition-colors",
        selected && "ring-1 ring-primary/50 bg-primary/5",
      )}>
        {/* Status badge + checkbox row */}
        <div className="flex items-center gap-2 px-4 pt-2.5 pb-1">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Select candidate" />
          <StatusBadge status={candidate.status ?? "available"} />
        </div>
        {/* Main content row */}
        <div className="flex items-center gap-4 px-4 pb-3 pt-1">
          {/* Photo */}
          <button type="button" onClick={onViewPhotos} className="shrink-0">
            <Avatar className="h-14 w-14 hover:ring-2 hover:ring-primary transition-all">
              {candidate.photo_url && <AvatarImage src={candidate.photo_url} alt={candidate.full_name} />}
              <AvatarFallback className="text-[11px]">{candidate.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </button>
          {/* Field columns */}
          <div className="flex-1 flex items-start gap-6">
            {visibleCols.map((colLabel) => {
              const f = allFields.find((f) => f.label === colLabel);
              if (!f) return null;
              return (
                <div key={colLabel} className="shrink-0 w-[90px]">
                  <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1 whitespace-nowrap">{colLabel}</div>
                  <div className="text-sm text-foreground break-words">
                    {"bold" in f && f.bold ? (
                      <span className="font-semibold">{f.value || "—"}</span>
                    ) : "edit" in f && f.edit === "text" ? (
                      <InlineText value={f.value} onSave={(v) => onUpdateField(f.field, v)} truncate={"long" in f && f.long} />
                    ) : "edit" in f && f.edit === "date" ? (
                      <InlineDate value={f.value} onSave={(v) => onUpdateField(f.field, v)} />
                    ) : "edit" in f && f.edit === "select" ? (
                      <InlineSelect value={f.value} options={f.options} onSave={(v) => onUpdateField(f.field, v)} />
                    ) : (
                      f.value || "—"
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Actions */}
          <div className="shrink-0 flex flex-col items-end gap-1.5 ml-auto pl-4">
            <Button size="sm" onClick={onAction} className="bg-[#5cb8c4] hover:bg-[#4aa8b4] text-white px-5 h-8 rounded text-xs font-semibold tracking-wide">
              VIEW
            </Button>
            <button onClick={onEdit} className="text-xs text-primary hover:underline">Edit</button>
            {onReturn && (
              <button onClick={() => setReturnOpen(true)} className="text-xs text-orange-600 hover:underline">Return</button>
            )}
            <button
              onClick={() => cancelMode ? setCancelOpen(true) : onDelete()}
              className="text-xs text-destructive hover:underline"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
      {cancelOpen && (
        <CancelReasonDialog
          onConfirm={(reason) => { onUpdateField("notes", reason); onDelete(); setCancelOpen(false); }}
          onClose={() => setCancelOpen(false)}
        />
      )}
      {returnOpen && onReturn && (
        <ReturnReasonDialog
          onConfirm={(reason) => { onUpdateField("notes", reason); onReturn(); setReturnOpen(false); }}
          onClose={() => setReturnOpen(false)}
        />
      )}
    </>
  );
}

const INITIAL_PROC_FILTERS = {
  narrative: "all",
  medical_status: [] as string[], coc_status: [] as string[], tasheer_status: "all",
  wokala_status: "all", visa_status: "all", insurance_status: "all",
  unfilled_lmis: "all", lmis_status: "all", ticket_status: "all",
  arrival_city: "all",
};

function ProcessingTable({
  candidates, selected, onToggleSelect, onAction, onUpdateField, onEdit, onDelete, cancelMode,
  countryMeta, officesByCountry,
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
}) {
  const [viewingPhotos, setViewingPhotos] = useState<Candidate | null>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [showColPicker, setShowColPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [search, setSearch] = useState("");
  const [procFilters, setProcFilters] = useState(INITIAL_PROC_FILTERS);
  const [activeCountryTab, setActiveCountryTab] = useState("all");
  const [activeOfficeTab, setActiveOfficeTab] = useState("all");
  const f = procFilters;

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

  const activeCount = Object.values(procFilters).filter((v) => Array.isArray(v) ? v.length > 0 : v !== "all").length;

  const narrativeOpts = useMemo(() =>
    Array.from(new Set(candidates.map((c) => (c.narrative as string | null) ?? "").filter(Boolean))).sort(),
  [candidates]);

  const filteredCandidates = useMemo(() => {
    let list = candidates;
    if (activeCountryTab !== "all") list = list.filter((c) => c.destination_country === activeCountryTab);
    if (activeOfficeTab !== "all") list = list.filter((c) => c.office === activeOfficeTab);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.full_name.toLowerCase().includes(q) ||
        (c.passport_number ?? "").toLowerCase().includes(q) ||
        (c.serial_number ?? "").toLowerCase().includes(q)
      );
    }
    if (f.narrative       !== "all")   list = list.filter((c) => c.narrative        === f.narrative);
    if (f.medical_status.length > 0)  list = list.filter((c) => f.medical_status.includes(c.medical_status ?? ""));
    if (f.coc_status.length > 0)      list = list.filter((c) => f.coc_status.includes(c.coc_status ?? ""));
    if (f.tasheer_status !== "all")   list = list.filter((c) => c.tasheer_status   === f.tasheer_status);
    if (f.wokala_status  !== "all")   list = list.filter((c) => c.wokala_status    === f.wokala_status);
    if (f.visa_status    !== "all")   list = list.filter((c) => c.visa_status      === f.visa_status);
    if (f.insurance_status !== "all") list = list.filter((c) => c.insurance_status === f.insurance_status);
    if (f.unfilled_lmis  !== "all")   list = list.filter((c) => c.unfilled_lmis    === f.unfilled_lmis);
    if (f.lmis_status    !== "all")   list = list.filter((c) => c.lmis_status      === f.lmis_status);
    if (f.ticket_status  !== "all")   list = list.filter((c) => c.ticket_status    === f.ticket_status);
    if (f.arrival_city   !== "all")   list = list.filter((c) => c.arrival_city     === f.arrival_city);
    return list;
  }, [candidates, search, f.narrative, f.medical_status, f.coc_status, f.tasheer_status, f.wokala_status,
      f.visa_status, f.insurance_status, f.unfilled_lmis, f.lmis_status,
      f.ticket_status, f.arrival_city, activeCountryTab, activeOfficeTab]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  useEffect(() => { setPage(1); }, [filteredCandidates.length, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / pageSize));

  const medExpiryChecked = useRef<Set<string>>(new Set());
  const tasheerDoneChecked = useRef<Set<string>>(new Set());
  const arrivedChecked = useRef<Set<string>>(new Set());
  const [arrivedCheckCandidate, setArrivedCheckCandidate] = useState<Candidate | null>(null);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const c of candidates) {
      if (tasheerDoneChecked.current.has(c.id)) continue;
      if (c.tasheer_status === "Booked" && c.tasheer_date) {
        const tasheerDate = new Date(c.tasheer_date + "T00:00:00");
        if (today > tasheerDate) {
          tasheerDoneChecked.current.add(c.id);
          onUpdateField(c.id, "tasheer_status", "Done");
        }
      }
    }
  }, [candidates]);

  useEffect(() => {
    const today = new Date();
    for (const c of candidates) {
      if (medExpiryChecked.current.has(c.id)) continue;
      if (c.medical_status === "Fit" && c.medical_date) {
        const medDate = new Date(c.medical_date + "T00:00:00");
        const diffDays = Math.floor((today.getTime() - medDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 90) {
          medExpiryChecked.current.add(c.id);
          onUpdateField(c.id, "medical_status", "Expired");
        }
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

  const set = (key: keyof typeof INITIAL_PROC_FILTERS) => (v: string) =>
    setProcFilters((p) => ({ ...p, [key]: v }));
  const setMulti = (key: "medical_status" | "coc_status") => (v: string[]) =>
    setProcFilters((p) => ({ ...p, [key]: v }));

  return (
    <div className="space-y-2">
      {/* Filter bar — hidden when bulk bar is open */}
      {selected.size === 0 && <Card className="rounded-none">
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setShowFilters((s) => !s)}
              className="flex items-center gap-2 text-xs font-bold text-foreground hover:text-primary transition-colors">
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
              Filters
              {activeCount > 0 && (
                <span className="rounded-none bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                  {activeCount}
                </span>
              )}
              {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"
              onClick={() => { setProcFilters(INITIAL_PROC_FILTERS); setSearch(""); }} disabled={activeCount === 0 && !search}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
          <div className="mt-3 relative w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-9 h-8 text-xs rounded-none" placeholder="Name / Passport / Code" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {showFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <FilterSelect value={f.narrative} onChange={set("narrative")} placeholder="Narrative" icon={FileText}
                options={[{ value: "all", label: "-----" }, ...narrativeOpts.map((o) => ({ value: o, label: o }))]} />
              <MultiFilterSelect values={f.medical_status} onChange={setMulti("medical_status")} placeholder="Medical" icon={Stethoscope}
                options={MEDICAL_OPTIONS.map((o) => ({ value: o, label: o }))} />
              <MultiFilterSelect values={f.coc_status} onChange={setMulti("coc_status")} placeholder="COC" icon={FileCheck}
                options={COC_OPTIONS.map((o) => ({ value: o, label: o }))} />
              <FilterSelect value={f.tasheer_status} onChange={set("tasheer_status")} placeholder="Tasheer"
                options={[{ value: "all", label: "-----" }, ...TASHEER_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <FilterSelect value={f.wokala_status} onChange={set("wokala_status")} placeholder="Wokala"
                options={[{ value: "all", label: "-----" }, ...WOKALA_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <FilterSelect value={f.visa_status} onChange={set("visa_status")} placeholder="Visa"
                options={[{ value: "all", label: "-----" }, ...VISA_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <FilterSelect value={f.insurance_status} onChange={set("insurance_status")} placeholder="Insurance"
                options={[{ value: "all", label: "-----" }, ...INSURANCE_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <FilterSelect value={f.unfilled_lmis} onChange={set("unfilled_lmis")} placeholder="LMIS file"
                options={[{ value: "all", label: "-----" }, ...UNFILLED_LMIS_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <FilterSelect value={f.lmis_status} onChange={set("lmis_status")} placeholder="LMIS"
                options={[{ value: "all", label: "-----" }, ...LMIS_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <FilterSelect value={f.ticket_status} onChange={set("ticket_status")} placeholder="Ticket"
                options={[{ value: "all", label: "-----" }, ...TICKET_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <FilterSelect value={f.arrival_city} onChange={set("arrival_city")} placeholder="Arrival City"
                options={[{ value: "all", label: "-----" }, ...ARRIVAL_CITY_OPTIONS.map((o) => ({ value: o, label: o }))]} />
            </div>
          )}
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
                const count = candidates.filter((cand) => cand.destination_country === c.name).length;
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
                const count = candidates.filter((c) => c.destination_country === activeCountryTab && c.office === office).length;
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
        <div className="flex items-center justify-end px-1">
          <div className="relative">
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
        <div className="overflow-x-auto">
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
              />
            ))}
          </div>
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
        <div className="sticky bottom-0 z-10 bg-background flex items-center justify-between px-4 py-2 shadow-[0_-1px_3px_rgba(0,0,0,0.06)] flex-wrap gap-2">
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
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <ChevronUp className="h-3.5 w-3.5" /> Back to top
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProcessingCard({
  candidate, selected, visibleCols, onToggleSelect, onViewPhotos, onAction, onUpdateField, onEdit, onDelete, cancelMode,
  officesByCountry,
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
}) {
  const [requireDate, setRequireDate] = useState<{
    field: "ticket_date" | "tasheer_date" | "medical_date";
    label: string;
    pendingStatus: string;
    statusField: string;
  } | null>(null);
  const [pendingDate, setPendingDate] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [embassyOpen, setEmbassyOpen] = useState(false);
  const [embassyStep, setEmbassyStep] = useState<"ask" | "reason">("ask");
  const [embassyReason, setEmbassyReason] = useState("");
  const [visaReturnOpen, setVisaReturnOpen] = useState(false);
  const [visaReturnReason, setVisaReturnReason] = useState("");

  function handleColUpdate(colKey: string, value: string | null) {
    if (colKey === "visa_status" && (value === "Ready for embassy" || value === "Returned")) {
      if (candidate.status !== "processing" || candidate.tasheer_status !== "Done" || candidate.wokala_status !== "Paid") {
        toast.error("Candidate must be Processing with Tasheer = Done and Wokala = Paid");
        return;
      }
    }
    if (colKey === "visa_status" && value === "Returned") {
      setVisaReturnOpen(true); setVisaReturnReason("");
      return;
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
    if (colKey === "tasheer_status" && value === "Done" && candidate.wokala_status === "Paid") {
      setEmbassyOpen(true); setEmbassyStep("ask"); setEmbassyReason("");
      return;
    }
    if (colKey === "medical_status" && value === "Fit" && !candidate.medical_date) {
      setRequireDate({ field: "medical_date", label: "Medical Date", pendingStatus: "Fit", statusField: "medical_status" });
      setPendingDate("");
      return;
    }
    onUpdateField(colKey, value);
  }

  return (
    <>
      <div className={cn(
        "bg-white border border-border shadow-sm rounded-sm overflow-hidden transition-colors",
        selected && "ring-1 ring-primary/50 bg-primary/5",
      )}>
        <div className="flex items-center gap-2 px-4 pt-2.5 pb-1">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Select candidate" />
          <StatusBadge status="processing" />
        </div>
        <div className="flex items-center gap-4 px-4 pb-3 pt-1">
          <button type="button" onClick={onViewPhotos} className="shrink-0">
            <Avatar className="h-14 w-14 hover:ring-2 hover:ring-primary transition-all">
              {candidate.photo_url && <AvatarImage src={candidate.photo_url} alt={candidate.full_name} />}
              <AvatarFallback className="text-[11px]">{candidate.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </button>
          <div className="flex-1 flex items-start gap-6">
            <div className="shrink-0 w-[90px]">
              <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1">FULL NAME</div>
              <div className="text-sm font-semibold">{candidate.full_name}</div>
            </div>
            {visibleCols.map((col) => {
              const raw = candidate[col.key as keyof Candidate];
              const strVal = raw == null ? "" : String(raw);
              return (
                <div key={col.key} className="shrink-0 w-[90px]">
                  <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1 whitespace-nowrap">{col.header}</div>
                  <div className="text-sm text-foreground break-words">
                    {col.type === "text" ? (
                      <InlineText value={strVal} onSave={(v) => handleColUpdate(col.key, v)} />
                    ) : col.type === "date" ? (
                      <InlineDate value={strVal} onSave={(v) => handleColUpdate(col.key, v)} />
                    ) : col.type === "select" ? (
                      <InlineSelect value={strVal} options={col.options} onSave={(v) => handleColUpdate(col.key, v)} />
                    ) : col.type === "select-dynamic" ? (
                      <InlineSelect
                        value={strVal}
                        options={officesByCountry[candidate.destination_country ?? ""] ?? []}
                        onSave={(v) => handleColUpdate(col.key, v)}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5 ml-auto pl-4">
            <Button size="sm" onClick={onAction} className="bg-[#5cb8c4] hover:bg-[#4aa8b4] text-white px-5 h-8 rounded text-xs font-semibold tracking-wide">
              VIEW
            </Button>
            <button onClick={onEdit} className="text-xs text-primary hover:underline">Edit</button>
            <button
              onClick={() => cancelMode ? setCancelOpen(true) : onDelete()}
              className="text-xs text-destructive hover:underline"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    {cancelOpen && (
      <CancelReasonDialog
        onConfirm={(reason) => { onUpdateField("notes", reason); onDelete(); setCancelOpen(false); }}
        onClose={() => setCancelOpen(false)}
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
                onUpdateField(requireDate.field, pendingDate);
                onUpdateField(requireDate.statusField, requireDate.pendingStatus);
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
          {embassyStep === "ask" ? (
            <>
              <DialogHeader><DialogTitle>Ready for Embassy Visa?</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">
                Tasheer is Done and Wokala is Paid for <strong>{candidate.full_name}</strong>.
                Are they ready for embassy visa?
              </p>
              <DialogFooter className="flex gap-2 sm:justify-start">
                <Button onClick={() => {
                  onUpdateField("tasheer_status", "Done");
                  onUpdateField("visa_status", "Ready for embassy");
                  setEmbassyOpen(false);
                }}>
                  Yes — Ready for Embassy
                </Button>
                <Button variant="outline" onClick={() => setEmbassyStep("reason")}>
                  No — Enter Reason
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader><DialogTitle>Reason Not Ready</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">Why is this candidate not ready for embassy visa?</p>
              <Textarea rows={3} placeholder="Enter reason…" value={embassyReason} onChange={(e) => setEmbassyReason(e.target.value)} />
              <DialogFooter className="flex gap-2">
                <Button variant="ghost" onClick={() => setEmbassyStep("ask")}>Back</Button>
                <Button
                  disabled={!embassyReason.trim()}
                  onClick={() => {
                    onUpdateField("tasheer_status", "Done");
                    onUpdateField("processing_notes", embassyReason.trim());
                    setEmbassyOpen(false);
                    setEmbassyStep("ask");
                    setEmbassyReason("");
                  }}
                >
                  Submit
                </Button>
              </DialogFooter>
            </>
          )}
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
    </>
  );
}

function InlineDate({ value, onSave }: { value: string; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const fmt = (v: string) =>
    v ? new Date(v + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "";
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(value); setEditing(true); }}
        className="text-left rounded-none px-1 -mx-1 py-0.5 hover:bg-muted/60 hover:ring-1 hover:ring-border min-w-[60px] block"
      >
        {value ? fmt(value) : <span className="text-muted-foreground">—</span>}
      </button>
    );
  }
  return (
    <input
      autoFocus
      type="date"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); if (draft !== value) onSave(draft || null); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
      }}
      className="rounded-none border border-primary bg-background px-1 py-0.5 text-[14px] text-[#181A27] outline-none min-w-[110px]"
    />
  );
}

function InlineText({ value, onSave, truncate }: { value: string; onSave: (v: string | null) => void; truncate?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(value);
  const words = value.trim().split(/\s+/);
  const isLong = truncate && words.length > 1;
  const display = isLong && !expanded ? `${words[0]}...` : (value || null);
  if (!editing) {
    if (truncate && expanded) {
      return (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-left rounded-none px-1 -mx-1 py-0.5 hover:bg-muted/60 hover:ring-1 hover:ring-border block whitespace-normal max-w-[260px] break-words"
        >
          {value}
        </button>
      );
    }
    return (
      <button
        type="button"
        title={isLong ? value : undefined}
        onClick={() => { if (isLong) { setExpanded(true); } else { setDraft(value); setEditing(true); } }}
        className={cn(
          "text-left rounded-none px-1 -mx-1 py-0.5 hover:bg-muted/60 hover:ring-1 hover:ring-border min-w-[40px] block",
          isLong && "cursor-pointer",
        )}
      >
        {display ?? <span className="text-muted-foreground">—</span>}
      </button>
    );
  }
  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft.trim() === "" ? null : draft);
  };
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
      }}
      className="rounded-none border border-primary bg-background px-1 py-0.5 text-[14px] text-[#181A27] outline-none min-w-[80px]"
    />
  );
}

function OptionPill({ label, className }: { label: string; className?: string }) {
  const color = OPTION_COLORS[label] ?? "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center rounded-none px-1.5 py-0.5 text-[14px] font-medium leading-none whitespace-nowrap", color, className)}>
      {label}
    </span>
  );
}

function InlineSelect({
  value, options, onSave,
}: { value: string; options: string[]; onSave: (v: string | null) => void }) {
  return (
    <Select value={value || "__clear__"} onValueChange={(v) => onSave(v === "__clear__" ? null : v)}>
      <SelectTrigger className="h-auto w-auto min-w-[80px] gap-1 border-transparent bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:shrink-0">
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
      <div className={cn("mt-0.5 text-[14px] text-[#181A27] whitespace-nowrap", bold && "font-semibold")}>{value}</div>
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
        <SelectTrigger
          className={cn(
            "border shadow-none w-auto h-7 px-2 gap-1.5 transition-colors rounded-none text-[13px] font-medium [&>svg]:shrink-0",
            isReset
              ? "bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              : hasColor
                ? cn(OPTION_COLORS[value], "border-transparent")
                : "bg-black/10 border-black/20 text-[#181A27] dark:bg-white/10 dark:border-white/20 dark:text-white",
          )}
        >
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
                  <span className="text-[14px] text-[#181A27] dark:text-white">{o.label}</span>
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
  const isEmpty = values.length === 0;
  const hasSingleColor = !isEmpty && values.length === 1 && !!OPTION_COLORS[values[0]];

  const toggle = (val: string) =>
    onChange(values.includes(val) ? values.filter((v) => v !== val) : [...values, val]);

  const triggerLabel = isEmpty
    ? placeholder
    : values.length === 1
      ? (options.find((o) => o.value === values[0])?.label ?? values[0])
      : `${placeholder} (${values.length})`;

  return (
    <div className="flex items-center gap-0.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 border shadow-none h-7 px-2 transition-colors rounded-none text-[13px] font-medium",
              isEmpty
                ? "bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                : hasSingleColor
                  ? cn(OPTION_COLORS[values[0]], "border-transparent")
                  : "bg-black/10 border-black/20 text-[#181A27] dark:bg-white/10 dark:border-white/20 dark:text-white",
            )}
          >
            {Icon && <Icon className="h-3 w-3 shrink-0" />}
            <span>{triggerLabel}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1 rounded-none" align="start">
          {options.map((o) => {
            const checked = values.includes(o.value);
            const color = OPTION_COLORS[o.label] ?? OPTION_COLORS[o.value];
            return (
              <button
                key={o.value}
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors"
                onClick={() => toggle(o.value)}
              >
                <Checkbox checked={checked} className="h-3.5 w-3.5 pointer-events-none" />
                {color ? (
                  <span className={cn("text-[13px] font-medium px-1.5 py-0.5", color)}>{o.label}</span>
                ) : (
                  <span className="text-[13px] text-[#181A27] dark:text-white">{o.label}</span>
                )}
              </button>
            );
          })}
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

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const hasValue = !!value;
  const selected = value ? new Date(value + "T00:00:00") : undefined;

  function handleSelect(date: Date | undefined) {
    if (date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      onChange(`${y}-${m}-${d}`);
    } else {
      onChange("");
    }
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-0.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 border shadow-none w-auto h-7 px-2 transition-colors rounded-none text-[13px] font-medium cursor-pointer",
              hasValue
                ? "bg-black/10 border-black/20 text-[#181A27] dark:bg-white/10 dark:border-white/20 dark:text-white"
                : "bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Calendar className="h-3 w-3 shrink-0" />
            <span>{hasValue ? selected?.toLocaleDateString() : label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 rounded-none"
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={16}
          avoidCollisions
        >
          <CalendarPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            captionLayout="dropdown"
            fromYear={2020}
            toYear={2030}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {hasValue && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="rounded-none p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Clear date"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-none h-9" placeholder={placeholder} />
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
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-none cursor-pointer hover:border-primary/60 transition-colors flex flex-col items-center justify-center gap-1.5 min-h-[88px] p-2 bg-muted/20 select-none"
      >
        {uploading ? (
          <span className="text-xs text-muted-foreground animate-pulse">Uploading…</span>
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
            <span className="text-[10px] text-primary">Click to replace</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Click to upload</span>
          </>
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
            className="bg-orange-500 hover:bg-orange-600 text-white"
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
};

function resolveHeader(header: string): ExcelKey | undefined {
  const lower = header.trim().toLowerCase();
  const norm = normalizeHeader(header);
  return LABEL_TO_KEY_EXACT[lower] ?? LABEL_TO_KEY_NORM[norm] ?? HEADER_ALIASES[norm];
}

const REQUIRED_KEYS = EXCEL_COLUMNS.filter((c) => c.required).map((c) => c.key as ExcelKey);
const DATE_KEYS = new Set<ExcelKey>(["dob", "passport_issue_date", "passport_expiry_date"]);
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

function downloadSampleExcel() {
  const sampleRows: Record<string, unknown>[] = [
    { "First Name": "Abebe",    "Last Name": "Kebede",    "Gender": "Female", "Date of Birth (YYYY-MM-DD)": "1995-06-15", "Religion": "Muslim",     "Birth Place": "Addis Ababa",  "Living Town": "Addis Ababa",  "Marital Status": "Single",   "Children": 0, "Education": "High School",  "Passport Number": "EP1234567", "Labour ID": "L-001", "Issue Date (YYYY-MM-DD)": "2022-01-10", "Expiry Date (YYYY-MM-DD)": "2027-01-09", "Place of Issue": "Addis Ababa",  "Spoken Languages": "Good",  "English Level": "Good",   "Arabic Level": "Basic", "Work Experience": "Yes", "Experience Country": "Saudi Arabia", "Years of Experience": "2", "Weight (kg)": 58, "Height (cm)": 162, "Passport Status": "Original", "Medical Status": "Fit",   "COC Status": "Done",    "Country": "",          "Narrative": "", "Narrative Phone": "", "Remark": "", "Notes": "" },
    { "First Name": "Tigist",   "Last Name": "Haile",     "Gender": "Female", "Date of Birth (YYYY-MM-DD)": "1997-03-22", "Religion": "Christian",  "Birth Place": "Bahir Dar",    "Living Town": "Bahir Dar",    "Marital Status": "Single",   "Children": 0, "Education": "Diploma",      "Passport Number": "EP2345678", "Labour ID": "L-002", "Issue Date (YYYY-MM-DD)": "2021-07-15", "Expiry Date (YYYY-MM-DD)": "2026-07-14", "Place of Issue": "Bahir Dar",    "Spoken Languages": "Fair",  "English Level": "Fair",   "Arabic Level": "Poor",  "Work Experience": "No",  "Experience Country": "",             "Years of Experience": "",  "Weight (kg)": 55, "Height (cm)": 158, "Passport Status": "Original", "Medical Status": "Fit",   "COC Status": "No",      "Country": "",          "Narrative": "", "Narrative Phone": "", "Remark": "", "Notes": "" },
    { "First Name": "Mekdes",   "Last Name": "Tadesse",   "Gender": "Female", "Date of Birth (YYYY-MM-DD)": "1993-11-08", "Religion": "Muslim",     "Birth Place": "Dire Dawa",    "Living Town": "Dire Dawa",    "Marital Status": "Married",  "Children": 1, "Education": "Secondary",    "Passport Number": "EP3456789", "Labour ID": "L-003", "Issue Date (YYYY-MM-DD)": "2023-02-20", "Expiry Date (YYYY-MM-DD)": "2028-02-19", "Place of Issue": "Dire Dawa",    "Spoken Languages": "Good",  "English Level": "Good",   "Arabic Level": "Fair",  "Work Experience": "Yes", "Experience Country": "Saudi Arabia", "Years of Experience": "3", "Weight (kg)": 60, "Height (cm)": 160, "Passport Status": "Original", "Medical Status": "Fit",   "COC Status": "Done",    "Country": "",          "Narrative": "", "Narrative Phone": "", "Remark": "", "Notes": "" },
    { "First Name": "Selam",    "Last Name": "Girma",     "Gender": "Female", "Date of Birth (YYYY-MM-DD)": "1999-05-30", "Religion": "Christian",  "Birth Place": "Hawassa",      "Living Town": "Hawassa",      "Marital Status": "Single",   "Children": 0, "Education": "High School",  "Passport Number": "EP4567890", "Labour ID": "L-004", "Issue Date (YYYY-MM-DD)": "2022-09-01", "Expiry Date (YYYY-MM-DD)": "2027-08-31", "Place of Issue": "Hawassa",      "Spoken Languages": "Fair",  "English Level": "Fair",   "Arabic Level": "Poor",  "Work Experience": "No",  "Experience Country": "",             "Years of Experience": "",  "Weight (kg)": 52, "Height (cm)": 155, "Passport Status": "Original", "Medical Status": "Booked", "COC Status": "No",      "Country": "",          "Narrative": "", "Narrative Phone": "", "Remark": "", "Notes": "" },
    { "First Name": "Hiwot",    "Last Name": "Mulugeta",  "Gender": "Female", "Date of Birth (YYYY-MM-DD)": "1991-08-14", "Religion": "Muslim",     "Birth Place": "Jimma",        "Living Town": "Addis Ababa",  "Marital Status": "Divorced", "Children": 2, "Education": "Degree",       "Passport Number": "EP5678901", "Labour ID": "L-005", "Issue Date (YYYY-MM-DD)": "2020-04-18", "Expiry Date (YYYY-MM-DD)": "2025-04-17", "Place of Issue": "Addis Ababa",  "Spoken Languages": "Good",  "English Level": "Good",   "Arabic Level": "Good",  "Work Experience": "Yes", "Experience Country": "Kuwait",       "Years of Experience": "5", "Weight (kg)": 63, "Height (cm)": 164, "Passport Status": "Scan",     "Medical Status": "Fit",   "COC Status": "Done",    "Country": "Kuwait",    "Narrative": "", "Narrative Phone": "", "Remark": "", "Notes": "" },
    { "First Name": "Birtukan", "Last Name": "Worku",     "Gender": "Female", "Date of Birth (YYYY-MM-DD)": "1996-01-25", "Religion": "Christian",  "Birth Place": "Gondar",       "Living Town": "Gondar",       "Marital Status": "Single",   "Children": 0, "Education": "High School",  "Passport Number": "EP6789012", "Labour ID": "L-006", "Issue Date (YYYY-MM-DD)": "2023-06-05", "Expiry Date (YYYY-MM-DD)": "2028-06-04", "Place of Issue": "Gondar",       "Spoken Languages": "Poor",  "English Level": "Poor",   "Arabic Level": "Poor",  "Work Experience": "No",  "Experience Country": "",             "Years of Experience": "",  "Weight (kg)": 57, "Height (cm)": 159, "Passport Status": "Original", "Medical Status": "Fit",   "COC Status": "Booked",  "Country": "",          "Narrative": "", "Narrative Phone": "", "Remark": "", "Notes": "" },
    { "First Name": "Almaz",    "Last Name": "Bekele",    "Gender": "Female", "Date of Birth (YYYY-MM-DD)": "1994-09-19", "Religion": "Muslim",     "Birth Place": "Mekelle",      "Living Town": "Mekelle",      "Marital Status": "Married",  "Children": 1, "Education": "Secondary",    "Passport Number": "EP7890123", "Labour ID": "L-007", "Issue Date (YYYY-MM-DD)": "2021-11-30", "Expiry Date (YYYY-MM-DD)": "2026-11-29", "Place of Issue": "Mekelle",      "Spoken Languages": "Fair",  "English Level": "Little", "Arabic Level": "Poor",  "Work Experience": "Yes", "Experience Country": "UAE",          "Years of Experience": "1", "Weight (kg)": 61, "Height (cm)": 163, "Passport Status": "Original", "Medical Status": "Fit",   "COC Status": "No",      "Country": "UAE",       "Narrative": "", "Narrative Phone": "", "Remark": "", "Notes": "" },
    { "First Name": "Selamawit","Last Name": "Tesfaye",   "Gender": "Female", "Date of Birth (YYYY-MM-DD)": "1998-04-07", "Religion": "Christian",  "Birth Place": "Addis Ababa",  "Living Town": "Addis Ababa",  "Marital Status": "Single",   "Children": 0, "Education": "Diploma",      "Passport Number": "EP8901234", "Labour ID": "L-008", "Issue Date (YYYY-MM-DD)": "2022-12-12", "Expiry Date (YYYY-MM-DD)": "2027-12-11", "Place of Issue": "Addis Ababa",  "Spoken Languages": "Good",  "English Level": "Good",   "Arabic Level": "Basic", "Work Experience": "No",  "Experience Country": "",             "Years of Experience": "",  "Weight (kg)": 54, "Height (cm)": 157, "Passport Status": "Original", "Medical Status": "Fit",   "COC Status": "Done",    "Country": "",          "Narrative": "", "Narrative Phone": "", "Remark": "", "Notes": "" },
    { "First Name": "Yeshi",    "Last Name": "Alemu",     "Gender": "Female", "Date of Birth (YYYY-MM-DD)": "1992-07-03", "Religion": "Muslim",     "Birth Place": "Dessie",       "Living Town": "Dessie",       "Marital Status": "Widowed",  "Children": 3, "Education": "Primary",      "Passport Number": "EP9012345", "Labour ID": "L-009", "Issue Date (YYYY-MM-DD)": "2021-03-25", "Expiry Date (YYYY-MM-DD)": "2026-03-24", "Place of Issue": "Dessie",       "Spoken Languages": "Poor",  "English Level": "Poor",   "Arabic Level": "Poor",  "Work Experience": "Yes", "Experience Country": "Saudi Arabia", "Years of Experience": "4", "Weight (kg)": 59, "Height (cm)": 161, "Passport Status": "Scan",     "Medical Status": "Fit",   "COC Status": "Placed",  "Country": "",          "Narrative": "", "Narrative Phone": "", "Remark": "", "Notes": "" },
    { "First Name": "Fikirte",  "Last Name": "Assefa",    "Gender": "Female", "Date of Birth (YYYY-MM-DD)": "2000-12-18", "Religion": "Christian",  "Birth Place": "Adama",        "Living Town": "Adama",        "Marital Status": "Single",   "Children": 0, "Education": "High School",  "Passport Number": "EP0123456", "Labour ID": "L-010", "Issue Date (YYYY-MM-DD)": "2023-08-22", "Expiry Date (YYYY-MM-DD)": "2028-08-21", "Place of Issue": "Adama",        "Spoken Languages": "Fair",  "English Level": "Fair",   "Arabic Level": "Poor",  "Work Experience": "No",  "Experience Country": "",             "Years of Experience": "",  "Weight (kg)": 50, "Height (cm)": 153, "Passport Status": "Original", "Medical Status": "Booked", "COC Status": "No",      "Country": "",          "Narrative": "", "Narrative Phone": "", "Remark": "", "Notes": "" },
  ];

  const instructionsData = EXCEL_COLUMNS.map(({ label, required }) => ({
    "Column Header": label,
    "Required": required ? "YES ★" : "No",
  }));

  const ws1 = XLSX.utils.json_to_sheet(sampleRows);
  ws1["!cols"] = Object.keys(sampleRows[0]).map(() => ({ wch: 28 }));
  const ws2 = XLSX.utils.json_to_sheet(instructionsData);
  ws2["!cols"] = [{ wch: 36 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Candidates");
  XLSX.utils.book_append_sheet(wb, ws2, "Instructions");
  XLSX.writeFile(wb, "candidates_sample.xlsx");
}

function ImportExcelButton({ onImported }: { onImported: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<string>("available");
  const fileRef = useRef<HTMLInputElement>(null);
  const importFn = useServerFn(bulkImportCandidates);

  const reset = () => { setRows([]); setParseError(null); setValidationErrors([]); setImportStatus("available"); };

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
      const result = await importFn({ data: { rows: rows.map((r) => ({ ...r, status: importStatus as never })) as never[] } });
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
              onClick={downloadSampleExcel}
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
