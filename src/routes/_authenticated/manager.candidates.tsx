import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ActionDialog } from "@/components/action-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search, FilePlus, FileText, Pencil, Trash2, FileSignature,
  SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp,
  ArrowUpDown, Users, User, BookOpen, Stethoscope, Briefcase, FileCheck,
  Globe, Send, Activity, ClipboardPaste, Upload, ImageIcon, UserPlus, AlertTriangle, Table2, Plus, Loader2,
  ScanSearch, RefreshCw, Sparkles,
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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, calcAge } from "@/lib/utils";
import {
  upsertCandidate, deleteCandidate, updateCandidateField,
  bulkDeleteCandidates, bulkUpdateStatus, bulkAssignStaff, bulkUpdateField,
  nextCandidateCode, searchCandidates,
  getCandidates,
} from "@/lib/candidates.functions";
import { generateNarrative } from "@/lib/narrative.functions";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { X, Play, Undo2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { Database } from "@/integrations/supabase/types";
import type { Status, Candidate } from "@/components/candidates/types";
import {
  MEDICAL_OPTIONS, COC_OPTIONS, TASHEER_OPTIONS, WOKALA_OPTIONS, VISA_OPTIONS,
  INSURANCE_OPTIONS, LMIS_OPTIONS, UNFILLED_LMIS_OPTIONS, TICKET_OPTIONS,
  ARRIVAL_CITY_OPTIONS, PASSPORT_OPTIONS, firstName,
} from "@/components/candidates/types";
import { FilterSelect, MultiFilterSelect } from "@/components/candidates/atoms";
import { ProcessingEditDialog, CandidateCardList } from "@/components/candidates/candidate-views";
import { ProcessingTable } from "@/components/candidates/processing-views";
import { ImportExcelButton } from "@/components/candidates/import-excel";
import { Field, FormSelect, FormInput, PhotoUpload, FormSection } from "@/components/candidates/forms";
import { CandidateDetailDialog } from "@/components/candidates/dialogs";

export const Route = createFileRoute("/_authenticated/manager/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Staff-Flow" }] }),
  validateSearch: z.object({ tab: z.enum(["available", "processing", "arrived", "returned", "canceled"]).optional() }),
  component: ManagerCandidatesPage,
});

const TABS: { key: Status; label: string }[] = [
  { key: "available", label: "Available" },
  { key: "processing", label: "Processing" },
  { key: "arrived", label: "Arrived" },
  { key: "returned", label: "Returned" },
  { key: "canceled", label: "Canceled" },
];

const toNumOrNull = (v: string | number | null | undefined): number | null => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

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

const initialForm = {
  first_name: "",
  last_name: "",
  photo_url: "",
  full_photo_url: "",
  passport_scan_url: "",
  serial_number: "",
  candidate_code: "",
  gender: "",
  dob: "",
  religion: "",
  birth_place: "",
  living_town: "",
  marital_status: "",
  children: "" as string | number,
  education: "",
  occupation: "House Maid",
  passport_number: "",
  labour_id: "",
  passport_issue_date: "",
  passport_expiry_date: "",
  country: "Ethiopian",
  place_of_issue: "ADDIS ABABA",
  spoken_languages: "",
  english_level: "",
  arabic_level: "",
  experience: "",
  experience_country: "",
  experience_years: "",
  weight: "" as string | number,
  height: "" as string | number,
  passport_status: "",
  medical_status: "",
  coc_status: "",
  coc_agency_name: "",
  coc_agency_phone: "",
  musaned_status: "",
  status: "available" as Status,
  office: "",
  selected_by: "",
  narrative: "",
  narrative_phone: "",
  skills: "",
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
  added_by: [] as string[],
  private_filter: [] as string[],
  video: [] as string[],
  from: "",
  to: "",
};

function parsePasteData(text: string): Partial<typeof initialForm> {
  const LABEL_MAP: Record<string, string | string[]> = {
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
  const colonLines = lines.filter((l) => /^[^:]+:[^:]+/.test(l)).length;

  if (colonLines > lines.length / 3) {
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

function ManagerCandidatesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { tab: tabParam } = Route.useSearch();
  const upsert         = useServerFn(upsertCandidate);
  const remove         = useServerFn(deleteCandidate);
  const bulkDel        = useServerFn(bulkDeleteCandidates);
  const bulkStatus     = useServerFn(bulkUpdateStatus);
  const bulkAssign     = useServerFn(bulkAssignStaff);
  const bulkField           = useServerFn(bulkUpdateField);
  const getNextCode         = useServerFn(nextCandidateCode);
  const fetchCandidates     = useServerFn(getCandidates);
  const doGenerateNarrative = useServerFn(generateNarrative);
  const [selected, setSelected] = useState<Set<string>>(() => {
    try {
      // Match the same tab resolution used by the tab state initializer
      const t = tabParam ?? sessionStorage.getItem("mgr-last-tab") ?? "available";
      const s = sessionStorage.getItem(`mgr-selected-${t}`);
      if (s) return new Set(JSON.parse(s));
    } catch {}
    return new Set();
  });
  const toggleSelect = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSelection = () => setSelected(new Set());
  const [actionCandidates, setActionCandidates] = useState<Candidate[]>([]);

  const filterCache = useRef<Map<string, { f: typeof initialFilters; p: string }>>((() => {
    try {
      const raw = sessionStorage.getItem("mgr-filter-cache");
      if (raw) return new Map(Object.entries(JSON.parse(raw)));
    } catch {}
    return new Map();
  })());
  const saveFilterCache = (t: string, f: typeof initialFilters, p: string) => {
    filterCache.current.set(t, { f, p });
    try { sessionStorage.setItem("mgr-filter-cache", JSON.stringify(Object.fromEntries(filterCache.current))); } catch {}
  };
  const [tab, setTab] = useState<Status>(() => {
    if (tabParam) return tabParam;
    try {
      const saved = sessionStorage.getItem("mgr-last-tab");
      if (saved && (["available","processing","arrived","returned","canceled"] as string[]).includes(saved))
        return saved as Status;
    } catch {}
    return "available";
  });
  // Ref that always reflects the current tab synchronously during render,
  // used by the selection-save effect so it saves to the right tab key
  // even if tab and selected change in the same React batch.
  const currentTabRef = useRef(tab);
  currentTabRef.current = tab;

  useEffect(() => { if (tabParam) setTab(tabParam); }, [tabParam]);
  useEffect(() => { try { sessionStorage.setItem("mgr-last-tab", tab); } catch {} }, [tab]);
  const [passport, setPassport] = useState(() => {
    try { return filterCache.current.get(tabParam ?? "available")?.p ?? ""; } catch { return ""; }
  });
  const [filters, setFilters] = useState<typeof initialFilters>(() => {
    try { return filterCache.current.get(tabParam ?? "available")?.f ?? initialFilters; } catch { return initialFilters; }
  });

  // Global deep search
  const doSearch = useServerFn(searchCandidates);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalQ, setGlobalQ] = useState("");
  const [globalResults, setGlobalResults] = useState<Awaited<ReturnType<typeof searchCandidates>>>([]);
  const [globalSearching, setGlobalSearching] = useState(false);
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
      catch (e: any) { toast.error(e?.message ?? "Search failed"); }
      finally { setGlobalSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [globalQ, globalSearchOpen]);
  const activeCount = Object.entries(filters).filter(([k, v]) =>
    k !== "sort" && (Array.isArray(v) ? v.length > 0 : v && v !== "all")
  ).length;
  // Save selection only when it genuinely changes (not when tab changes).
  // Using the ref avoids the race where tab has already flipped to the new value
  // while selected still holds the previous tab's items.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    try { sessionStorage.setItem(`mgr-selected-${currentTabRef.current}`, JSON.stringify([...selected])); } catch {}
  }, [selected]);

  // Restore per-tab filters and selection when tab changes (save happens in the tab-click handler)
  useEffect(() => {
    const cached = filterCache.current.get(tab);
    setFilters(cached?.f ?? initialFilters);
    setPassport(cached?.p ?? "");
    try {
      const s = sessionStorage.getItem(`mgr-selected-${tab}`);
      setSelected(s ? new Set(JSON.parse(s)) : new Set());
    } catch { setSelected(new Set()); }
  }, [tab]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [form, setForm] = useState(initialForm);
  const [expEntries, setExpEntries] = useState<Array<{ country: string; customCountry: string; years: string }>>([{ country: "", customCountry: "", years: "" }]);
  const [viewing, setViewing] = useState<Candidate | null>(null);
  const [processingEdit, setProcessingEdit] = useState<Candidate | null>(null);
  const [cocPlacedPending, setCocPlacedPending] = useState<{ id: string } | null>(null);
  const [cocPlacedName, setCocPlacedName] = useState("");
  const [cocPlacedPhone, setCocPlacedPhone] = useState("");
  const [lmisNeededId, setLmisNeededId] = useState<string | null>(null);
  const [lmisNeededSel, setLmisNeededSel] = useState<string[]>([]);

  const [preloadedCandidates] = useState<Candidate[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = sessionStorage.getItem("mgr-cands-v1");
      if (!raw) return [];
      const { ts, d } = JSON.parse(raw);
      return Date.now() - ts < 15 * 60 * 1000 ? (d as Candidate[]) : [];
    } catch { return []; }
  });
  const { data: candidates = preloadedCandidates } = useQuery({
    queryKey: ["manager-candidates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const result = await (fetchCandidates({}) as Promise<Candidate[]>);
      try { sessionStorage.setItem("mgr-cands-v1", JSON.stringify({ ts: Date.now(), d: result })); } catch {}
      return result;
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["team-staff", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id,name").eq("manager_id", user!.id).eq("status", "active");
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

  // Pre-fetch CV templates so they're instantly available when ActionDialog opens.
  // Uses the same query key as ActionDialog's internal query to share the cache.
  useQuery({
    queryKey: ["cv-templates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cv_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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

  const isFiltered = (activeCount > 0 || !!passport);

  const filteredCounts = useMemo(() => {
    if (!isFiltered) return counts;
    const result: Record<string, number> = { ...counts };
    for (const status of ["available", "arrived", "returned", "canceled"] as Status[]) {
      let list = candidates.filter((c) => c.status === status);
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
      if (filters.added_by.length > 0) list = list.filter((c) => filters.added_by.includes(firstName(c.created_by_name) ?? ""));
      if (status === "available" && filters.private_filter.length > 0) {
        list = list.filter((c) => filters.private_filter.includes((c.availability_type ?? "available").toLowerCase()));
      }
      if (filters.age.length > 0) {
        list = list.filter((c) => {
          const age = calcAge(c.dob) ?? c.age;
          if (age == null) return false;
          return filters.age.some((range) => { const [min, max] = range.split("-").map(Number); return age >= min && age <= max; });
        });
      }
      result[status] = list.length;
    }
    return result;
  }, [isFiltered, candidates, counts, passport, filters]);

  const filteredTotal = useMemo(() => {
    if (!isFiltered) return candidates.length;
    let list = candidates;
    if (passport) {
      const q = passport.toLowerCase();
      list = list.filter((c) =>
        [
          c.full_name, c.labour_id, c.passport_number, c.candidate_code,
          c.occupation, c.country, c.destination_country, c.office,
          c.serial_number, c.narrative, c.notes, c.skills,
          c.selected_by, c.living_town, c.coc_agency_name, c.cv_sent_to,
        ].some((v) => v?.toLowerCase().includes(q)),
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
    if (filters.added_by.length > 0) list = list.filter((c) => filters.added_by.includes(firstName(c.created_by_name) ?? ""));
    if (filters.age.length > 0) {
      list = list.filter((c) => {
        const age = calcAge(c.dob) ?? c.age;
        if (age == null) return false;
        return filters.age.some((range) => { const [min, max] = range.split("-").map(Number); return age >= min && age <= max; });
      });
    }
    if (filters.from) list = list.filter((c) => c.created_at >= filters.from);
    if (filters.to) list = list.filter((c) => c.created_at <= filters.to + "T23:59:59");
    return list.length;
  }, [isFiltered, candidates, passport, filters]);

  const updateField = useServerFn(updateCandidateField);
  const fieldMut = useMutation({
    mutationFn: async (input: { id: string; field: string; value: string | null }) =>
      updateField({ data: input as never }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["manager-candidates", user?.id] });
      const previous = qc.getQueryData<Candidate[]>(["manager-candidates", user?.id]);
      qc.setQueryData<Candidate[]>(["manager-candidates", user?.id], (old) =>
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
      if (ctx?.previous) qc.setQueryData(["manager-candidates", user?.id], ctx.previous);
      toast.error(e.message);
    },
  });

  const narrativeMut = useMutation({
    mutationFn: () => doGenerateNarrative({
      data: {
        full_name:      [form.first_name, form.last_name].filter(Boolean).join(" ").trim() || undefined,
        occupation:     form.occupation     || undefined,
        country:        form.country        || undefined,
        experience:     form.experience     || undefined,
        education:      form.education      || undefined,
        marital_status: form.marital_status || undefined,
        children:       form.children !== "" ? String(form.children) : undefined,
        religion:       form.religion       || undefined,
      },
    }),
    onSuccess: (r) => { setForm((f) => ({ ...f, narrative: r.narrative })); toast.success("Narrative generated"); },
    onError:   (e: Error) => toast.error(e.message),
  });

  // Resolves destination_country + office from the selected agency/office name
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

  // Backfill destination_country / office for processing candidates that already have selected_by
  useEffect(() => {
    if (!assignOffices.length && !foreignAgencies.length) return;
    for (const c of candidates) {
      if (c.status !== "processing" || !c.selected_by) continue;
      const fill = resolveSelectedBy(c.selected_by);
      if (fill.destination_country && !c.destination_country)
        fieldMut.mutate({ id: c.id, field: "destination_country", value: fill.destination_country });
      if (fill.office && !c.office)
        fieldMut.mutate({ id: c.id, field: "office", value: fill.office });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, resolveSelectedBy]);

  const handleUpdateField = useCallback((id: string, field: string, value: string | null) => {
    const target = candidates.find((c) => c.id === id);
    if (target?.visa_status === "Waiting Replacement" && field !== "visa_status" && field !== "delete_reason") {
      toast.error("Candidate is locked — Visa Status is Waiting Replacement");
      return;
    }
    fieldMut.mutate({ id, field, value });
    const current = () => qc.getQueryData<Candidate[]>(["manager-candidates", user?.id])?.find((c) => c.id === id);
    // When contract_date is first set, prompt for LMIS files needed
    if (field === "contract_date" && value) {
      const c = candidates.find((c) => c.id === id);
      if (c && !c.unfilled_lmis) { setLmisNeededId(id); setLmisNeededSel([]); }
    }
    if (field === "selected_by" && value) {
      const c = current();
      if (c && !c.contract_date && !c.unfilled_lmis) { setLmisNeededId(id); setLmisNeededSel([]); }
      const fill = resolveSelectedBy(value);
      if (fill.destination_country && !c?.destination_country)
        fieldMut.mutate({ id, field: "destination_country", value: fill.destination_country });
      if (fill.office && !c?.office)
        fieldMut.mutate({ id, field: "office", value: fill.office });
    }
    // Clear medical date when status changes away from Fit (keep it for Expired)
    if (field === "medical_status" && value !== "Fit" && value !== "Expired") {
      if (current()?.medical_status === "Fit" || !value) fieldMut.mutate({ id, field: "medical_date", value: null });
    }
    // Visa arrived → set status to arrived
    if (field === "visa_status" && value === "Arrived KSA")
      fieldMut.mutate({ id, field: "status", value: "arrived" });
    // Visa canceled → move to Canceled tab + write notes
    if (field === "visa_status" && value === "Visa canceled") {
      fieldMut.mutate({ id, field: "status", value: "canceled" });
      fieldMut.mutate({ id, field: "notes", value: "Visa canceled" });
    }
    if (field === "tasheer_status" && !value)
      fieldMut.mutate({ id, field: "tasheer_date", value: null });
    // Tasheer Done + Wokala Paid → Visa "Ready for embassy"
    if (field === "tasheer_status" && value === "Done" && current()?.wokala_status === "Paid")
      fieldMut.mutate({ id, field: "visa_status", value: "Ready for embassy" });
    if (field === "wokala_status" && value === "Paid" && current()?.tasheer_status === "Done")
      fieldMut.mutate({ id, field: "visa_status", value: "Ready for embassy" });
    // LMIS Issued + Visa Issued → Ticket Ready; either undone → clear Ticket
    if (field === "lmis_status") {
      if (value === "Issued" && current()?.visa_status === "Issued")
        fieldMut.mutate({ id, field: "ticket_status", value: "Ready" });
      else if (value !== "Issued" && current()?.ticket_status === "Ready")
        fieldMut.mutate({ id, field: "ticket_status", value: null });
    }
    if (field === "visa_status") {
      if (value === "Issued" && current()?.lmis_status === "Issued")
        fieldMut.mutate({ id, field: "ticket_status", value: "Ready" });
      else if (value !== "Issued" && current()?.ticket_status === "Ready")
        fieldMut.mutate({ id, field: "ticket_status", value: null });
    }
    if (field === "ticket_status" && !value)
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
    const tabCandidates = candidates.filter((c) => c.status === tab);
    return {
      education: uniq("education"),
      marital: uniq("marital_status"),
      gender: uniq("gender"),
      religion: uniq("religion"),
      narrative: Array.from(new Set(tabCandidates.map((c) => c.narrative ?? "").filter(Boolean))).sort(),
      experience: Array.from(new Set(candidates.map((c) => c.experience === "None" ? "No" : (c.experience ?? "")).filter(Boolean))).sort(),
      cv_sent_to: uniq("cv_sent_to"),
      coc: uniq("coc_status"),
      musaned: uniq("musaned_status"),
      availability: uniq("status"),
    };
  }, [candidates, tab]);

  const addedByOptions = useMemo(() => {
    const fromStaff = staffList.map((s) => firstName(s.name)).filter(Boolean);
    const fromCands = candidates.map((c) => firstName(c.created_by_name)).filter(Boolean);
    return Array.from(new Set([...fromStaff, ...fromCands])).sort();
  }, [staffList, candidates]);

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
        [
          c.full_name, c.labour_id, c.passport_number, c.candidate_code,
          c.occupation, c.country, c.destination_country, c.office,
          c.serial_number, c.narrative, c.notes, c.skills,
          c.selected_by, c.living_town, c.coc_agency_name, c.cv_sent_to,
        ].some((v) => v?.toLowerCase().includes(q)),
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
    if (filters.added_by.length > 0) list = list.filter((c) => filters.added_by.includes(firstName(c.created_by_name) ?? ""));
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
        return filters.age.some((range) => { const [min, max] = range.split("-").map(Number); return age >= min && age <= max; });
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
      const validEntries = form.experience === "Yes"
        ? expEntries.filter(e => e.country === "Other" ? e.customCountry.trim() : e.country)
        : [];
      const payload = {
        ...form,
        full_name: fullName,
        experience_country: validEntries.map(e => e.country === "Other" ? e.customCountry.trim() : e.country).join("|") || null,
        experience_years: validEntries.map(e => e.years).join("|") || null,
        dob: form.dob || null,
        photo_url: form.photo_url || null,
        full_photo_url: form.full_photo_url || null,
        passport_scan_url: form.passport_scan_url || null,
        video_url: form.video_url || null,
        passport_issue_date: form.passport_issue_date || null,
        passport_expiry_date: form.passport_expiry_date || null,
        children: toNumOrNull(form.children),
        weight: toNumOrNull(form.weight),
        height: toNumOrNull(form.height),
      };
      return upsert({ data: { id: editing?.id, data: payload } });
    },
    onSuccess: () => {
      toast.success(editing ? "Candidate updated" : "Candidate added");
      qc.invalidateQueries({ queryKey: ["manager-candidates"] });
      setOpen(false); setEditing(null); setForm(initialForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["manager-candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: async () => bulkStatus({ data: { ids: Array.from(selected), status: "canceled" } }),
    onSuccess: (r) => {
      toast.success(`Moved ${r.count} candidate(s) to Canceled`);
      qc.invalidateQueries({ queryKey: ["manager-candidates"] });
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
      qc.invalidateQueries({ queryKey: ["manager-candidates"] });
      clearSelection();
      setLastBulkOp(null);
      setTab(status);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkAssignMut = useMutation({
    mutationFn: async (staffId: string | null) =>
      bulkAssign({ data: { ids: Array.from(selected), staff_id: staffId } }),
    onSuccess: (r) => {
      toast.success(`Assigned ${r.count} candidate(s)`);
      qc.invalidateQueries({ queryKey: ["manager-candidates"] });
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
      toast.success(`Updated ${r.count} candidate(s)`);
      qc.invalidateQueries({ queryKey: ["manager-candidates"] });
      if (field === "coc_status" && value === "Done")
        bulkField({ data: { ids: Array.from(selected), field: "lmis_status", value: "Placed" } });
      if (field === "tasheer_status" && value === "Done")
        bulkField({ data: { ids: Array.from(selected), field: "wokala_status", value: "Unpaid" } });
      const fk = BULK_FIELD_TO_FILTER[field];
      if (fk && tab !== "available") {
        const isMulti = ["medical", "musaned"].includes(fk);
        setFilters((prev) => ({ ...prev, [fk]: isMulti ? [value] : value }));
      }
      clearSelection();
      if (context) setLastBulkOp(context);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [ticketDateOpen, setTicketDateOpen] = useState(false);
  const [ticketDate, setTicketDate] = useState("");
  const [bulkNarrativeOpen, setBulkNarrativeOpen] = useState(false);
  const [bulkNarrativeText, setBulkNarrativeText] = useState("");
  const [bulkNarrativePhone, setBulkNarrativePhone] = useState("");
  const [lastBulkOp, setLastBulkOp] = useState<{ field: string; prevs: Array<{ id: string; value: string | null }> } | null>(null);
  useEffect(() => {
    if (!lastBulkOp) return;
    const t = setTimeout(() => setLastBulkOp(null), 60_000);
    return () => clearTimeout(t);
  }, [lastBulkOp]);
  const [pendingBulk, setPendingBulk] = useState<{ title: string; description: string; action: () => void } | null>(null);

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
      qc.invalidateQueries({ queryKey: ["manager-candidates"] });
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
      qc.invalidateQueries({ queryKey: ["manager-candidates"] });
      setTicketDateOpen(false);
      setTicketDate("");
      clearSelection();
      setLastBulkOp(null);
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
      qc.invalidateQueries({ queryKey: ["manager-candidates"] });
      setTasheerDateOpen(false);
      setTasheerDate("");
      clearSelection();
      setLastBulkOp(null);
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
      qc.invalidateQueries({ queryKey: ["manager-candidates"] });
      setVisaReturnedOpen(false);
      setVisaReturnedReason("");
      clearSelection();
      setLastBulkOp(null);
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
      qc.invalidateQueries({ queryKey: ["manager-candidates"] });
      setTasheerDoneOpen(false);
      setTasheerDoneStep("ask");
      setTasheerDoneReason("");
      clearSelection();
      setLastBulkOp(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = async () => {
    setEditing(null);
    setForm({ ...initialForm, status: tab, candidate_code: "" });
    setExpEntries([{ country: "", customCountry: "", years: "" }]);
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
      passport_number: c.passport_number ?? "",
      labour_id: c.labour_id ?? "",
      passport_issue_date: c.passport_issue_date ?? "",
      passport_expiry_date: c.passport_expiry_date ?? "",
      country: c.country ?? "Ethiopian",
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
      office: c.office ?? "",
      selected_by: c.selected_by ?? "",
      narrative: c.narrative ?? "",
      narrative_phone: c.narrative_phone ?? "",
      skills: c.skills ?? "",
      remark: c.remark ?? "",
      notes: c.notes ?? "",
      video_url: c.video_url ?? "",
      availability_type: (() => { const v = c.availability_type ?? "Available"; return v.charAt(0).toUpperCase() + v.slice(1); })(),
    });
    const countries = (c.experience_country ?? "").split("|").filter(Boolean);
    const years = (c.experience_years ?? "").split("|");
    if (countries.length > 0) {
      setExpEntries(countries.map((ct, i) => ({ country: ct, customCountry: "", years: years[i] ?? "" })));
    } else {
      setExpEntries([{ country: "", customCountry: "", years: "" }]);
    }
    setOpen(true);
  };

  return (
    <div className="space-y-6 px-6 py-6">
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
            onImported={() => qc.invalidateQueries({ queryKey: ["manager-candidates"] })}
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
                          // Let the search dialog finish closing before mounting the detail dialog
                          setTimeout(() => setViewing(toView!), 200);
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

      {tab !== "processing" && (
        <>
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
                  <MultiFilterSelect placeholder="Added By" values={filters.added_by} icon={UserPlus}
                    onChange={(v) => setFilters({ ...filters, added_by: v })}
                    options={[{ value: "", label: "Not Selected" }, ...addedByOptions.map((o) => ({ value: o, label: o }))]} />
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
        </>
      )}

      <Card className="rounded-none">
        <CardContent className="p-4">
          <div className="flex items-center gap-8 border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  saveFilterCache(tab, filters, passport);
                  // Persist selection for the tab we're leaving before the ref flips
                  try { sessionStorage.setItem(`mgr-selected-${tab}`, JSON.stringify([...selected])); } catch {}
                  navigate({ to: "/manager/candidates", search: { tab: t.key }, replace: true });
                  setTab(t.key);
                  // Don't clearSelection — the tab-change useEffect restores each tab's own selection
                }}
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
            <Input
              type="date"
              className="h-8 w-[160px]"
              value={ticketDate}
              onChange={(e) => setTicketDate(e.target.value)}
            />
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

      {selected.size > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            {selected.size > 0 && <span className="text-sm font-semibold pl-1">{selected.size} selected</span>}
            <div className="ml-auto flex flex-wrap items-center gap-2">
            {selected.size > 0 && (<>
              <Select onValueChange={(v) => setPendingBulk({
                title: "Change Status",
                description: `Set status to "${v}" for ${selected.size} candidate${selected.size !== 1 ? "s" : ""}?`,
                action: () => bulkStatusMut.mutate(v as Status),
              })}>
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
                      setPendingBulk({
                        title: `Clear ${fd.label}`,
                        description: `Clear ${fd.label} for ${selected.size} candidate${selected.size !== 1 ? "s" : ""}?`,
                        action: () => bulkFieldMut.mutateAsync({ field: fd.key, value: null })
                          .then(() => { if (fd.key === "visa_status") bulkFieldMut.mutate({ field: "embassy_date", value: null }); }),
                      });
                      return;
                    }
                    // These have their own dedicated dialogs — no extra confirm needed
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
                    // All other field updates go through the confirmation dialog
                    else if (fd.key === "visa_status" && v === "Ready for embassy") {
                      const blocked = candidates.filter((c) => selected.has(c.id) && (c.status !== "processing" || c.tasheer_status !== "Done" || (c.wokala_status !== "Paid" && c.passport_accepted !== true)));
                      if (blocked.length > 0) { toast.error(`${blocked.length} candidate(s) must be Processing with Tasheer = Done and either Passport Accepted or Wokala = Paid`); }
                      else { setPendingBulk({ title: `Set ${fd.label}`, description: `Set ${fd.label} to "${v}" for ${selected.size} candidate${selected.size !== 1 ? "s" : ""}?`, action: () => bulkFieldMut.mutate({ field: fd.key, value: v }) }); }
                    }
                    else if (fd.key === "visa_status" && v === "Sent to Embassy") {
                      const today = new Date().toISOString().split("T")[0];
                      setPendingBulk({ title: `Set ${fd.label}`, description: `Set ${fd.label} to "${v}" for ${selected.size} candidate${selected.size !== 1 ? "s" : ""}?`, action: () => bulkFieldMut.mutateAsync({ field: "visa_status", value: v }).then(() => bulkFieldMut.mutate({ field: "embassy_date", value: today })) });
                    }
                    else { setPendingBulk({ title: `Set ${fd.label}`, description: `Set ${fd.label} to "${v}" for ${selected.size} candidate${selected.size !== 1 ? "s" : ""}?`, action: () => bulkFieldMut.mutate({ field: fd.key, value: v }) }); }
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
                size="sm" variant="destructive" className="gap-1"
                disabled={bulkDeleteMut.isPending}
                onClick={() => setPendingBulk({
                  title: "Delete Candidates",
                  description: `Permanently move ${selected.size} candidate${selected.size !== 1 ? "s" : ""} to Canceled? This cannot be undone.`,
                  action: () => bulkDeleteMut.mutate(),
                })}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
              <Button size="sm" variant="ghost" className="gap-1" onClick={clearSelection}>
                <X className="h-4 w-4" /> Clear
              </Button>
            </>)}
            {lastBulkOp && selected.size > 0 && (
              <Button size="sm" variant="outline" className="gap-1" disabled={undoBulkMut.isPending} onClick={() => undoBulkMut.mutate()}>
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </Button>
            )}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "processing" ? (
        <ProcessingTable
          key={tab}
          pageKey={tab}
          candidates={filtered}
          selected={selected}
          onToggleSelect={toggleSelect}
          onAction={(c) => setActionCandidates([c])}
          onUpdateField={(id, field, value) => {
            handleUpdateField(id, field, value);
            if (field === "coc_status" && value === "Done")
              fieldMut.mutate({ id, field: "lmis_status", value: "Placed" });
            if (field === "medical_status" && value === "Fit")
              fieldMut.mutate({ id, field: "lmis_status", value: "Not tested" });
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
          key={tab}
          pageKey={tab}
          candidates={filtered}
          selected={selected}
          onToggleSelect={toggleSelect}
          onView={(c) => setViewing(c)}
          onAction={(c) => setActionCandidates([c])}
          onEdit={openEdit}
          compact={tab === "arrived" || tab === "returned"}
          cancelMode={tab === "available"}
          showCvBadge={tab === "available"}
          onDelete={(id) =>
            tab === "available"
              ? fieldMut.mutate({ id, field: "status", value: "canceled" })
              : removeMut.mutate(id)
          }
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

      <CandidateDetailDialog candidate={viewing} onClose={() => setViewing(null)} agencyPhones={agencyPhones} />

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
                type="button" size="sm" variant="outline"
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
                <ClipboardPaste className="h-3.5 w-3.5" /> Paste Data
              </Button>
            </div>
          </DialogHeader>

          <div className="max-h-[62vh] overflow-y-auto pr-2 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <PhotoUpload label="Photo" value={form.photo_url} onChange={(url) => setForm((f) => ({ ...f, photo_url: url }))} />
              <PhotoUpload label="Full Size Photo" value={form.full_photo_url} onChange={(url) => setForm((f) => ({ ...f, full_photo_url: url }))} />
              <PhotoUpload label="Passport Scan" value={form.passport_scan_url} onChange={(url) => setForm((f) => ({ ...f, passport_scan_url: url }))} accept="image/*,application/pdf" />
            </div>

            <FormSection title="Names & IDs" required>
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name *" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} />
                <Field label="Last Name *" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} />
                <Field label="Candidate Code" placeholder="Auto-generated" value={form.candidate_code} onChange={(v) => setForm({ ...form, candidate_code: v })} />
              </div>
            </FormSection>

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

            <FormSection title="Languages & Experience">
              <div className="grid grid-cols-2 gap-3">
                <FormSelect label="English Level" value={form.english_level} onChange={(v) => setForm({ ...form, english_level: v })} options={["Poor", "Little", "Fair", "Good"]} />
                <FormSelect label="Arabic Level" value={form.arabic_level} onChange={(v) => setForm({ ...form, arabic_level: v })} options={["Poor", "Little", "Fair", "Good"]} />
                <FormSelect label="Work Experience *" value={form.experience} onChange={(v) => {
                  setForm({ ...form, experience: v });
                  if (v !== "Yes") setExpEntries([{ country: "", customCountry: "", years: "" }]);
                }} options={["Yes", "No"]} />
              </div>
              {form.experience === "Yes" && (
                <div className="mt-3 space-y-2">
                  {expEntries.map((entry, i) => (
                    <div key={i} className="grid grid-cols-2 gap-3 items-start">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Experience Country</Label>
                        <Select value={entry.country || undefined} onValueChange={(v) => {
                          const updated = [...expEntries];
                          updated[i] = { ...updated[i], country: v, customCountry: v !== "Other" ? "" : updated[i].customCountry };
                          setExpEntries(updated);
                        }}>
                          <SelectTrigger className="rounded-none h-9"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {assignCountries.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        {entry.country === "Other" && (
                          <input
                            type="text"
                            className="mt-1 w-full h-9 border border-input rounded-none px-3 text-sm bg-background"
                            placeholder="Enter country name"
                            value={entry.customCountry}
                            onChange={(e) => {
                              const updated = [...expEntries];
                              updated[i] = { ...updated[i], customCountry: e.target.value };
                              setExpEntries(updated);
                            }}
                          />
                        )}
                      </div>
                      <div className="flex gap-2 items-start">
                        <div className="flex-1 space-y-1.5">
                          <Label className="text-xs">Years of Experience</Label>
                          <Select value={entry.years || undefined} onValueChange={(v) => {
                            const updated = [...expEntries];
                            updated[i] = { ...updated[i], years: v };
                            setExpEntries(updated);
                          }}>
                            <SelectTrigger className="rounded-none h-9"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 20 }, (_, j) => String(j + 1)).map((y) => (
                                <SelectItem key={y} value={y}>{y} {y === "1" ? "year" : "years"}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {expEntries.length > 1 && (
                          <button type="button" onClick={() => setExpEntries(expEntries.filter((_, idx) => idx !== i))} className="mt-6 p-1 text-muted-foreground hover:text-destructive transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setExpEntries([...expEntries, { country: "", customCountry: "", years: "" }])}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Experience
                  </button>
                </div>
              )}
            </FormSection>

            <FormSection title="Physical">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Weight (kg)" type="number" value={String(form.weight)} onChange={(v) => setForm({ ...form, weight: v })} />
                <Field label="Height (cm)" type="number" value={String(form.height)} onChange={(v) => setForm({ ...form, height: v })} />
              </div>
            </FormSection>

            <FormSection title="Skills">
              {(() => {
                const skillSet = new Set((form.skills ?? "").split(",").map((s) => s.trim()).filter(Boolean));
                return (
                  <div className="flex flex-wrap gap-2">
                    {SKILLS_LIST.map((skill) => {
                      const checked = skillSet.has(skill);
                      return (
                        <label key={skill} className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-none border cursor-pointer text-xs transition-colors",
                          checked ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50",
                        )}>
                          <Checkbox checked={checked} onCheckedChange={(v) => {
                            const s = new Set(skillSet);
                            v ? s.add(skill) : s.delete(skill);
                            setForm({ ...form, skills: Array.from(s).join(", ") });
                          }} />
                          {skill}
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </FormSection>

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
              </div>
            </FormSection>

            <FormSection title="Narrative">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">AI-generated or type manually (max 200 chars)</span>
                  <Button
                    type="button" size="sm" variant="outline"
                    disabled={narrativeMut.isPending}
                    onClick={() => narrativeMut.mutate()}
                    className="h-7 gap-1.5 text-xs rounded-none"
                  >
                    {narrativeMut.isPending
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : form.narrative
                        ? <RefreshCw className="h-3 w-3" />
                        : <Sparkles className="h-3 w-3" />}
                    {narrativeMut.isPending ? "Writing…" : form.narrative ? "Regenerate" : "Write with AI"}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {narrativeMut.isPending ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Narrative</Label>
                      <div className="h-9 rounded-none border border-input bg-muted/30 animate-pulse" />
                    </div>
                  ) : (
                    <Field label="Narrative" value={form.narrative} onChange={(v) => setForm({ ...form, narrative: v })} suggestions={opts.narrative} maxLength={200} />
                  )}
                  <Field label="Narrative Phone" value={form.narrative_phone} onChange={(v) => setForm({ ...form, narrative_phone: v })} />
                </div>
              </div>
            </FormSection>

            <FormSection title="Notes">
              <div className="space-y-3">
                <FormSelect label="Availability" value={form.availability_type} onChange={(v) => setForm({ ...form, availability_type: v })}
                  options={["Available", "Private", "Unavailable"]} />
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

      {/* Tasheer Done — passport accepted dialog */}
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

      {/* Bulk action confirmation dialog */}
      <Dialog open={!!pendingBulk} onOpenChange={(o) => { if (!o) setPendingBulk(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{pendingBulk?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{pendingBulk?.description}</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingBulk(null)}>Cancel</Button>
            <Button
              onClick={() => {
                pendingBulk?.action();
                setPendingBulk(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
