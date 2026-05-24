import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, FilePlus, FileText, Pencil, Trash2, FileSignature, Calendar,
  SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight,
  ArrowUpDown, Users, User, BookOpen, Stethoscope, Briefcase, FileCheck,
  Globe, Send, Activity, ClipboardPaste, Upload, ImageIcon,
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
  bulkDeleteCandidates, bulkUpdateStatus, bulkAssignStaff,
} from "@/lib/candidates.functions";
import { UserCheck, X } from "lucide-react";

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
const MUSANED_OPTIONS = ["Saudi", "Kuwait"];
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
  // Unfilled LMIS
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
  { key: "unfilled_lmis",     header: "Unfilled LMIS",     type: "select", options: UNFILLED_LMIS_OPTIONS },
  { key: "lmis_status",       header: "LMIS",              type: "select", options: LMIS_OPTIONS },
  { key: "ticket_status",     header: "Ticket",            type: "select", options: TICKET_OPTIONS },
  { key: "ticket_date",       header: "Ticket Date",       type: "date" },
  { key: "arrival_city",      header: "Arrival City",      type: "select", options: ARRIVAL_CITY_OPTIONS },
  { key: "processing_notes",  header: "Note",              type: "text" },
  { key: "emergency_contact", header: "Emergency Contact", type: "text" },
];

const CANDIDATE_CARD_COLS = [
  "FULL NAME", "CANDIDATE CODE", "GENDER", "RELIGION", "MARITAL STATUS",
  "BIRTH PLACE", "LIVING TOWN", "OCCUPATION", "PASSPORT NUMBER", "LABOUR ID",
  "OFFICE", "PASSPORT STATUS", "COC STATUS", "MUSANED STATUS", "MEDICAL STATUS",
  "MEDICAL DATE", "AVAILABILITY", "SELECTED BY", "CV SENT TO", "CV SENT DATE",
  "NARRATIVE", "NOTES",
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
  medical: "all",
  narrative: "all",
  experience: "all",
  coc: "all",
  musaned: "all",
  cv_sent_to: "all",
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSelection = () => setSelected(new Set());

  const [tab, setTab] = useState<Status>("available");
  const [passport, setPassport] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState(initialFilters);
  const activeCount = Object.entries(filters).filter(([k, v]) =>
    k !== "sort" && v && v !== "all"
  ).length;
  useEffect(() => { setFilters(initialFilters); setPassport(""); }, [tab]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [form, setForm] = useState(initialForm);

  const { data: candidates = [] } = useQuery({
    queryKey: ["staff-candidates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates").select("*");
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
        old?.map((c) => c.id === input.id ? { ...c, [input.field]: input.value } : c) ?? []
      );
      return { previous };
    },
    onError: (e: Error, _, ctx) => {
      if (ctx?.previous) qc.setQueryData(["staff-candidates", user?.id], ctx.previous);
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["staff-candidates"] });
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
    if (filters.medical !== "all") list = list.filter((c) => c.medical_status === filters.medical);
    if (filters.narrative !== "all") list = list.filter((c) => c.narrative === filters.narrative);
    if (filters.experience !== "all") list = list.filter((c) => c.experience === filters.experience);
    if (filters.coc !== "all") list = list.filter((c) => c.coc_status === filters.coc);
    if (filters.musaned !== "all") list = list.filter((c) => c.musaned_status === filters.musaned);
    if (filters.cv_sent_to !== "all") list = list.filter((c) => c.cv_sent_to === filters.cv_sent_to);
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
    onSuccess: (r) => {
      toast.success(`Updated ${r.count} candidate(s)`);
      qc.invalidateQueries({ queryKey: ["staff-candidates"] });
      clearSelection();
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
              const first = Array.from(selected)[0];
              if (first) navigate({ to: "/staff/cv-generator", search: { id: first } });
            }}
          >
            <FileSignature className="h-4 w-4" />
            GENERATE CV{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
          <Button size="sm" className="gap-2 text-xs h-8 rounded-none" onClick={openCreate}>
            <FilePlus className="h-4 w-4" /> ADD NEW CANDIDATE
          </Button>
        </div>
      </div>

      {/* Filters — hidden on Processing tab (ProcessingTable has its own) */}
      {tab !== "processing" && <Card className="rounded-none">
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
            <FilterSelect placeholder="Medical" value={filters.medical} icon={Stethoscope}
              onChange={(v) => setFilters({ ...filters, medical: v })}
              options={[{ value: "all", label: "-----" }, ...MEDICAL_OPTIONS.map((o) => ({ value: o, label: o }))]} />
            <FilterSelect placeholder="Narrative" value={filters.narrative} icon={FileText}
              onChange={(v) => setFilters({ ...filters, narrative: v })}
              options={[{ value: "all", label: "-----" }, ...opts.narrative.map((o) => ({ value: o, label: o }))]} />
            <FilterSelect placeholder="Experience" value={filters.experience} icon={Briefcase}
              onChange={(v) => setFilters({ ...filters, experience: v })}
              options={[{ value: "all", label: "-----" }, { value: "Yes", label: "Yes" }, { value: "No", label: "No" }, { value: "None", label: "None" }]} />
            <FilterSelect placeholder="COC" value={filters.coc} icon={FileCheck}
              onChange={(v) => setFilters({ ...filters, coc: v })}
              options={[{ value: "all", label: "-----" }, ...["Done","No","Booked","Placed","Yitazez","Pending Release"].map((o) => ({ value: o, label: o }))]} />
            <FilterSelect placeholder="Musaned" value={filters.musaned} icon={Globe}
              onChange={(v) => setFilters({ ...filters, musaned: v })}
              options={[{ value: "all", label: "-----" }, ...opts.musaned.map((o) => ({ value: o, label: o }))]} />
            <FilterSelect placeholder="CV Sent To" value={filters.cv_sent_to} icon={Send}
              onChange={(v) => setFilters({ ...filters, cv_sent_to: v })}
              options={[{ value: "all", label: "-----" }, ...opts.cv_sent_to.map((o) => ({ value: o, label: o }))]} />
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
                onClick={() => setTab(t.key)}
                className={cn(
                  "pb-2 text-[16px] font-medium transition-colors",
                  tab === t.key
                    ? "text-primary border-b-2 border-primary -mb-px"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label} <span className="ml-1 text-[16px] opacity-70">({counts[t.key] ?? 0})</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold pl-1">
              {selected.size} selected
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Select onValueChange={(v) => bulkStatusMut.mutate(v as Status)}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="Update status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="arrived">Arrived</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>

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
          onUpdateField={(id, field, value) => fieldMut.mutate({ id, field, value })}
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
            <FormSection title="Names & IDs">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name *" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} />
                <Field label="Last Name *" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} />
                <Field label="Candidate Code" value={form.candidate_code} onChange={(v) => setForm({ ...form, candidate_code: v })} />
              </div>
            </FormSection>

            {/* Personal */}
            <FormSection title="Personal">
              <div className="grid grid-cols-2 gap-3">
                <FormSelect label="Gender" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} options={["Male", "Female"]} />
                <Field label="Date of Birth" type="date" value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} />
                <FormSelect label="Religion" value={form.religion} onChange={(v) => setForm({ ...form, religion: v })} options={["Muslim", "Non-muslim"]} />
                <Field label="Birth Place" value={form.birth_place} onChange={(v) => setForm({ ...form, birth_place: v })} />
                <Field label="Living Town" value={form.living_town} onChange={(v) => setForm({ ...form, living_town: v })} />
                <FormSelect label="Marital Status" value={form.marital_status} onChange={(v) => setForm({ ...form, marital_status: v })} options={["Single", "Married", "Divorced", "Widowed"]} />
                <Field label="Children" type="number" value={String(form.children)} onChange={(v) => setForm({ ...form, children: v })} />
                <Field label="Education" value={form.education} onChange={(v) => setForm({ ...form, education: v })} />
                <Field label="Occupation" value={form.occupation} onChange={(v) => setForm({ ...form, occupation: v })} />
              </div>
            </FormSection>

            {/* Passport */}
            <FormSection title="Passport">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Passport Number" value={form.passport_number} onChange={(v) => setForm({ ...form, passport_number: v })} />
                <Field label="Labour ID" value={form.labour_id} onChange={(v) => setForm({ ...form, labour_id: v })} />
                <Field label="Issue Date" type="date" value={form.passport_issue_date} onChange={(v) => setForm({ ...form, passport_issue_date: v })} />
                <Field label="Expiry Date" type="date" value={form.passport_expiry_date} onChange={(v) => setForm({ ...form, passport_expiry_date: v })} />
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
                <FormSelect label="Work Experience" value={form.experience} onChange={(v) => setForm({ ...form, experience: v })} options={["Yes", "No", "None"]} />
              </div>
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
                <FormSelect label="Musaned" value={form.musaned_status} onChange={(v) => setForm({ ...form, musaned_status: v })} options={MUSANED_OPTIONS} />
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
              onClick={() => saveMut.mutate()}
              disabled={(!form.first_name && !form.last_name) || saveMut.isPending}
            >
              {saveMut.isPending ? "Saving..." : editing ? "Save changes" : "Add candidate"}
            </Button>
          </DialogFooter>
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
  | "processing_notes" | "remark";

function CandidateCardList({
  candidates, selected, onToggleSelect, onEdit, onDelete, onUpdateField, cancelMode, onReturn,
  countryMeta, officesByCountry,
}: {
  candidates: Candidate[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onEdit: (c: Candidate) => void;
  onDelete: (id: string) => void;
  onUpdateField: (id: string, field: string, value: string | null) => void;
  cancelMode?: boolean;
  onReturn?: (id: string) => void;
  countryMeta: Array<{ name: string; flag: string }>;
  officesByCountry: Record<string, string[]>;
}) {
  const [viewingPhotos, setViewingPhotos] = useState<Candidate | null>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [showColPicker, setShowColPicker] = useState(false);
  const [activeCountryTab, setActiveCountryTab] = useState("all");
  const [activeOfficeTab, setActiveOfficeTab] = useState("all");

  const filtered = useMemo(() => {
    let list = candidates;
    if (activeCountryTab !== "all") list = list.filter((c) => c.destination_country === activeCountryTab);
    if (activeOfficeTab !== "all") list = list.filter((c) => c.office === activeOfficeTab);
    return list;
  }, [candidates, activeCountryTab, activeOfficeTab]);

  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [filtered.length]);
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allSel = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const someSel = !allSel && filtered.some((c) => selected.has(c.id));

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
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer w-fit">
            <Checkbox
              checked={allSel ? true : someSel ? "indeterminate" : false}
              onCheckedChange={(v) =>
                filtered.forEach((c) => { if (!!v !== selected.has(c.id)) onToggleSelect(c.id); })
              }
            />
            Select all ({filtered.length})
          </label>
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
              <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-none shadow-xl p-3 w-[340px] grid grid-cols-2 gap-x-4 gap-y-1">
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
            )}
          </div>
        </div>
      )}
      {filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">No candidates here yet.</CardContent></Card>
      ) : paginated.map((c) => (
        <CandidateCard
          key={c.id}
          candidate={c}
          selected={selected.has(c.id)}
          hiddenCols={hiddenCols}
          cancelMode={cancelMode}
          onToggleSelect={() => onToggleSelect(c.id)}
          onViewPhotos={() => setViewingPhotos(c)}
          onEdit={() => onEdit(c)}
          onDelete={() => onDelete(c.id)}
          onUpdateField={(field, value) => onUpdateField(c.id, field, value)}
          onReturn={onReturn ? () => onReturn(c.id) : undefined}
        />
      ))}
      <CandidatePhotosDialog candidate={viewingPhotos} onClose={() => setViewingPhotos(null)} />

      {filtered.length > 0 && (
        <div className="sticky bottom-0 z-10 bg-background flex items-center justify-between px-4 py-2 shadow-[0_-1px_3px_rgba(0,0,0,0.06)]">
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
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
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
  candidate, selected, hiddenCols, onToggleSelect, onViewPhotos, onEdit, onDelete, onUpdateField, cancelMode, onReturn,
}: {
  candidate: Candidate;
  selected: boolean;
  hiddenCols: Set<string>;
  cancelMode?: boolean;
  onToggleSelect: () => void;
  onViewPhotos: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateField: (field: EditableField, value: string | null) => void;
  onReturn?: () => void;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const statusStyles: Record<Status, string> = {
    available: "bg-success text-success-foreground",
    processing: "bg-warning text-foreground",
    arrived: "bg-info text-info-foreground",
    canceled: "bg-destructive text-destructive-foreground",
    returned: "bg-orange-500 text-white",
  };
  const statusLabel: Record<Status, string> = {
    available: "Available", processing: "Processing", arrived: "Arrived", canceled: "Canceled", returned: "Returned",
  };
  const statusKey = (candidate.status in statusStyles ? candidate.status : "available") as Status;

  type FieldDef =
    | { label: string; value: string; bold?: boolean }
    | { label: string; value: string; edit: "text"; field: EditableField; long?: boolean }
    | { label: string; value: string; edit: "date"; field: EditableField }
    | { label: string; value: string; edit: "select"; field: EditableField; options: string[] };

  const fields: FieldDef[] = [
    { label: "FULL NAME", value: candidate.full_name, bold: true },
    { label: "CANDIDATE CODE", value: candidate.candidate_code ?? "—" },
    { label: "GENDER", value: candidate.gender ?? "—" },
    { label: "RELIGION", value: candidate.religion ?? "—" },
    { label: "MARITAL STATUS", value: candidate.marital_status ?? "—" },
    { label: "BIRTH PLACE", value: candidate.birth_place ?? "—" },
    { label: "LIVING TOWN", value: candidate.living_town ?? "", edit: "text", field: "living_town" },
    { label: "OCCUPATION", value: candidate.occupation ?? "", edit: "text", field: "occupation" },
    { label: "PASSPORT NUMBER", value: candidate.passport_number ?? "—" },
    { label: "LABOUR ID", value: candidate.labour_id ?? "—" },
    { label: "OFFICE", value: candidate.office ?? "", edit: "select", field: "office", options: OFFICE_OPTIONS },
    { label: "PASSPORT STATUS", value: candidate.passport_status ?? "", edit: "select", field: "passport_status", options: PASSPORT_OPTIONS },
    { label: "COC STATUS", value: candidate.coc_status ?? "", edit: "select", field: "coc_status", options: COC_OPTIONS },
    { label: "MUSANED STATUS", value: candidate.musaned_status ?? "", edit: "select", field: "musaned_status", options: MUSANED_OPTIONS },
    { label: "MEDICAL STATUS", value: candidate.medical_status ?? "", edit: "select", field: "medical_status", options: MEDICAL_OPTIONS },
    { label: "MEDICAL DATE", value: candidate.medical_date ? new Date(candidate.medical_date).toLocaleDateString() : "—" },
    { label: "AVAILABILITY", value: statusKey, edit: "select", field: "status", options: AVAILABILITY_OPTIONS },
    { label: "SELECTED BY", value: candidate.selected_by ?? "", edit: "text", field: "selected_by" },
    { label: "CONTRACT DATE", value: candidate.contract_date ?? "", edit: "date", field: "contract_date" },
    { label: "CV SENT TO", value: candidate.cv_sent_to ?? "—" },
    { label: "CV SENT DATE", value: candidate.cv_sent_date ? new Date(candidate.cv_sent_date).toLocaleDateString() : "—" },
    { label: "NARRATIVE", value: candidate.narrative ?? "", edit: "text", field: "narrative", long: true },
    { label: "NOTES", value: candidate.notes ?? "", edit: "text", field: "notes", long: true },
  ];
  const visibleFields = fields.filter((f) => !hiddenCols.has(f.label));

  return (
    <>
    <Card className={cn("relative overflow-visible transition-colors rounded-none mx-[5px]", selected && "ring-2 ring-primary")}>
      <span className={cn(
        "absolute -top-2 left-3 rounded-none px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
        statusStyles[statusKey],
      )}>
        {statusLabel[statusKey]}
      </span>
      <CardContent className="p-0">
        <div className="grid grid-cols-[20px_40px_1fr_auto] gap-3 items-center">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Select candidate" />
          <button type="button" onClick={onViewPhotos} className="cursor-pointer">
            <Avatar className="h-10 w-10 hover:ring-2 hover:ring-primary transition-all">
              {candidate.photo_url && <AvatarImage src={candidate.photo_url} alt={candidate.full_name} />}
              <AvatarFallback className="text-[10px]">{candidate.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </button>
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex gap-5 items-start">
              {visibleFields.map((f) => (
                <div key={f.label} className="shrink-0">
                  <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase whitespace-nowrap mb-[5px]">
                    {f.label}
                  </div>
                  <div className={cn(
                    "text-[14px] text-[#181A27]",
                    "edit" in f && "long" in f && f.long ? "whitespace-normal" : "whitespace-nowrap",
                    "bold" in f && f.bold && "font-semibold",
                  )}>
                    {"edit" in f && f.edit === "text" ? (
                      <InlineText value={f.value} onSave={(v) => onUpdateField(f.field, v)} truncate={"long" in f && f.long} />
                    ) : "edit" in f && f.edit === "date" ? (
                      <InlineDate value={f.value} onSave={(v) => onUpdateField(f.field, v)} />
                    ) : "edit" in f && f.edit === "select" ? (
                      <InlineSelect value={f.value} options={f.options} onSave={(v) => onUpdateField(f.field, v)} />
                    ) : (
                      ("value" in f ? f.value : "—") || "—"
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 mb-[8px] pt-[10px] pr-[12px] pb-[10px] pl-[4px]">
            <Button asChild size="sm" className="h-6 w-18 text-[12px] px-2 rounded-none">
              <Link to="/staff/cv-generator" search={{ id: candidate.id }}>
                <FileText className="h-3.5 w-3.5 mr-1" /> VIEW
              </Link>
            </Button>
            <button onClick={onEdit} className="text-[14px] text-primary hover:underline flex items-center gap-1">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            {onReturn && (
              <button
                onClick={() => setReturnOpen(true)}
                className="text-[14px] text-orange-600 hover:underline flex items-center gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Return
              </button>
            )}
            <button
              onClick={() => cancelMode ? setCancelOpen(true) : onDelete()}
              className="text-[14px] text-destructive hover:underline flex items-center gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
    {cancelOpen && (
      <CancelReasonDialog
        onConfirm={(reason) => {
          onUpdateField("notes", reason);
          onDelete();
          setCancelOpen(false);
        }}
        onClose={() => setCancelOpen(false)}
      />
    )}
    {returnOpen && onReturn && (
      <ReturnReasonDialog
        onConfirm={(reason) => {
          onUpdateField("notes", reason);
          onReturn();
          setReturnOpen(false);
        }}
        onClose={() => setReturnOpen(false)}
      />
    )}
    </>
  );
}

const INITIAL_PROC_FILTERS = {
  medical_status: "all", coc_status: "all", tasheer_status: "all",
  wokala_status: "all", visa_status: "all", insurance_status: "all",
  unfilled_lmis: "all", lmis_status: "all", ticket_status: "all",
  arrival_city: "all",
};

function ProcessingTable({
  candidates, selected, onToggleSelect, onUpdateField, onEdit, onDelete, cancelMode,
  countryMeta, officesByCountry,
}: {
  candidates: Candidate[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
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

  const activeCount = Object.values(procFilters).filter((v) => v !== "all").length;

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
    if (f.medical_status !== "all")   list = list.filter((c) => c.medical_status   === f.medical_status);
    if (f.coc_status     !== "all")   list = list.filter((c) => c.coc_status       === f.coc_status);
    if (f.tasheer_status !== "all")   list = list.filter((c) => c.tasheer_status   === f.tasheer_status);
    if (f.wokala_status  !== "all")   list = list.filter((c) => c.wokala_status    === f.wokala_status);
    if (f.visa_status    !== "all")   list = list.filter((c) => c.visa_status      === f.visa_status);
    if (f.insurance_status !== "all") list = list.filter((c) => c.insurance_status === f.insurance_status);
    if (f.unfilled_lmis  !== "all")   list = list.filter((c) => c.unfilled_lmis    === f.unfilled_lmis);
    if (f.lmis_status    !== "all")   list = list.filter((c) => c.lmis_status      === f.lmis_status);
    if (f.ticket_status  !== "all")   list = list.filter((c) => c.ticket_status    === f.ticket_status);
    if (f.arrival_city   !== "all")   list = list.filter((c) => c.arrival_city     === f.arrival_city);
    return list;
  }, [candidates, search, f.medical_status, f.coc_status, f.tasheer_status, f.wokala_status,
      f.visa_status, f.insurance_status, f.unfilled_lmis, f.lmis_status,
      f.ticket_status, f.arrival_city, activeCountryTab, activeOfficeTab]);

  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [filteredCandidates.length]);
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / PAGE_SIZE));

  const medExpiryChecked = useRef<Set<string>>(new Set());
  const arrivedChecked = useRef<Set<string>>(new Set());
  const [arrivedCheckCandidate, setArrivedCheckCandidate] = useState<Candidate | null>(null);

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
  const paginated = filteredCandidates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const visibleCols = allCols.filter((col) => !hiddenCols.has(col.key));
  const allSel = filteredCandidates.length > 0 && filteredCandidates.every((c) => selected.has(c.id));
  const someSel = !allSel && filteredCandidates.some((c) => selected.has(c.id));

  const set = (key: keyof typeof INITIAL_PROC_FILTERS) => (v: string) =>
    setProcFilters((p) => ({ ...p, [key]: v }));

  return (
    <div className="space-y-2">
      {/* Filter bar */}
      <Card className="rounded-none">
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
              <FilterSelect value={f.medical_status} onChange={set("medical_status")} placeholder="Medical" icon={Stethoscope}
                options={[{ value: "all", label: "-----" }, ...MEDICAL_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <FilterSelect value={f.coc_status} onChange={set("coc_status")} placeholder="COC" icon={FileCheck}
                options={[{ value: "all", label: "-----" }, ...COC_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <FilterSelect value={f.tasheer_status} onChange={set("tasheer_status")} placeholder="Tasheer"
                options={[{ value: "all", label: "-----" }, ...TASHEER_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <FilterSelect value={f.wokala_status} onChange={set("wokala_status")} placeholder="Wokala"
                options={[{ value: "all", label: "-----" }, ...WOKALA_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <FilterSelect value={f.visa_status} onChange={set("visa_status")} placeholder="Visa"
                options={[{ value: "all", label: "-----" }, ...VISA_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <FilterSelect value={f.insurance_status} onChange={set("insurance_status")} placeholder="Insurance"
                options={[{ value: "all", label: "-----" }, ...INSURANCE_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <FilterSelect value={f.unfilled_lmis} onChange={set("unfilled_lmis")} placeholder="Unfilled LMIS"
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
      </Card>

      {countryMeta.length > 0 && (
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

      {/* Toolbar: select-all + column picker */}
      {filteredCandidates.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer w-fit">
            <Checkbox
              checked={allSel ? true : someSel ? "indeterminate" : false}
              onCheckedChange={(v) =>
                filteredCandidates.forEach((c) => { if (!!v !== selected.has(c.id)) onToggleSelect(c.id); })
              }
            />
            Select all ({filteredCandidates.length})
          </label>
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
              <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-none shadow-xl p-3 w-[340px] grid grid-cols-2 gap-x-4 gap-y-1">
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
            )}
          </div>
        </div>
      )}

      {/* Processing cards */}
      {candidates.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">No candidates in processing.</CardContent></Card>
      ) : filteredCandidates.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No matches for the selected filters.</CardContent></Card>
      ) : paginated.map((c) => (
        <ProcessingCard
          key={c.id}
          candidate={c}
          selected={selected.has(c.id)}
          visibleCols={visibleCols}
          cancelMode={cancelMode}
          onToggleSelect={() => onToggleSelect(c.id)}
          onViewPhotos={() => setViewingPhotos(c)}
          onUpdateField={(field, value) => onUpdateField(c.id, field, value)}
          onEdit={() => onEdit(c)}
          onDelete={() => onDelete(c.id)}
          officesByCountry={officesByCountry}
        />
      ))}
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
        <div className="sticky bottom-0 z-10 bg-background flex items-center justify-between px-4 py-2 shadow-[0_-1px_3px_rgba(0,0,0,0.06)]">
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
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredCandidates.length)} of {filteredCandidates.length}
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
  candidate, selected, visibleCols, onToggleSelect, onViewPhotos, onUpdateField, onEdit, onDelete, cancelMode,
  officesByCountry,
}: {
  candidate: Candidate;
  selected: boolean;
  visibleCols: ProcessingColDef[];
  cancelMode?: boolean;
  onToggleSelect: () => void;
  onViewPhotos: () => void;
  onUpdateField: (field: string, value: string | null) => void;
  onEdit: () => void;
  onDelete: () => void;
  officesByCountry: Record<string, string[]>;
}) {
  const [requireDate, setRequireDate] = useState<{
    field: "ticket_date" | "medical_date";
    label: string;
    pendingStatus: string;
    statusField: string;
  } | null>(null);
  const [pendingDate, setPendingDate] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);

  function handleColUpdate(colKey: string, value: string | null) {
    if (colKey === "ticket_status" && value === "Booked" && !candidate.ticket_date) {
      setRequireDate({ field: "ticket_date", label: "Ticket Date", pendingStatus: "Booked", statusField: "ticket_status" });
      setPendingDate("");
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
    <Card className={cn("relative overflow-visible transition-colors rounded-none mx-[5px]", selected && "ring-2 ring-primary")}>
      <span className="absolute -top-2 left-3 rounded-none px-1.5 py-0.5 text-[9px] font-semibold tracking-wide bg-warning text-foreground">
        PROCESSING
      </span>
      <CardContent className="p-0">
        <div className="grid grid-cols-[20px_40px_1fr_auto] gap-3 items-center">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Select candidate" />
          <button type="button" onClick={onViewPhotos} className="cursor-pointer">
            <Avatar className="h-10 w-10 hover:ring-2 hover:ring-primary transition-all">
              {candidate.photo_url && <AvatarImage src={candidate.photo_url} alt={candidate.full_name} />}
              <AvatarFallback className="text-[10px]">{candidate.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </button>
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex gap-5 items-start">
              <div className="shrink-0">
                <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase whitespace-nowrap mb-[5px]">Full Name</div>
                <div className="text-[14px] text-[#181A27] font-semibold whitespace-nowrap">{candidate.full_name}</div>
              </div>
              {visibleCols.map((col) => {
                const raw = candidate[col.key as keyof Candidate];
                const strVal = raw == null ? "" : String(raw);
                return (
                  <div key={col.key} className="shrink-0">
                    <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase whitespace-nowrap mb-[5px]">
                      {col.header}
                    </div>
                    <div className="text-[14px] text-[#181A27] whitespace-nowrap">
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
          </div>
          <div className="flex flex-col items-end gap-1 mb-[8px] pt-[10px] pr-[12px] pb-[10px] pl-[4px]">
            <Button asChild size="sm" className="h-6 w-18 text-[12px] px-2 rounded-none">
              <Link to="/staff/cv-generator" search={{ id: candidate.id }}>
                <FileText className="h-3.5 w-3.5 mr-1" /> VIEW
              </Link>
            </Button>
            <button onClick={onEdit} className="text-[14px] text-primary hover:underline flex items-center gap-1">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={() => cancelMode ? setCancelOpen(true) : onDelete()}
              className="text-[14px] text-destructive hover:underline flex items-center gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
    {cancelOpen && (
      <CancelReasonDialog
        onConfirm={(reason) => {
          onUpdateField("notes", reason);
          onDelete();
          setCancelOpen(false);
        }}
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
    <Select value={value || undefined} onValueChange={(v) => onSave(v)}>
      <SelectTrigger className="h-auto w-auto min-w-[80px] gap-1 border-transparent bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:shrink-0">
        <SelectValue placeholder={<span className="text-muted-foreground text-[14px] px-1">—</span>} />
      </SelectTrigger>
      <SelectContent>
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
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-none h-9" />
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

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 pb-1 border-b border-border">{title}</p>
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
