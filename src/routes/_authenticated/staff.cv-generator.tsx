import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, FileText, User, ArrowUpDown, ChevronDown, ChevronUp,
  Send, ClipboardPaste, X, RotateCcw, Stethoscope, Briefcase, FileCheck,
  Globe, BookOpen, Users, Calendar, SlidersHorizontal,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { ActionDialog as BulkActionDialog } from "@/components/action-dialog";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, calcAge } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/staff/cv-generator")({
  head: () => ({ meta: [{ title: "CV Page — Staff-Flow" }] }),
  validateSearch: z.object({ id: z.string().optional() }),
  component: CvGeneratorPage,
});

type CvTemplate = Database["public"]["Tables"]["cv_templates"]["Row"];
type Candidate  = Database["public"]["Tables"]["candidates"]["Row"];

const OPTION_COLORS: Record<string, string> = {
  Fit:              "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  Done:             "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  Unfit:            "bg-red-100/50 text-[#181A27] dark:bg-red-900/40 dark:text-red-300",
  Booked:           "bg-blue-100/50 text-[#181A27] dark:bg-blue-900/40 dark:text-blue-300",
  "In progress":    "bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
  Expired:          "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
  No:               "bg-zinc-100/50 text-[#181A27] dark:bg-zinc-800 dark:text-zinc-400",
  Placed:           "bg-violet-100/50 text-[#181A27] dark:bg-violet-900/40 dark:text-violet-300",
  Yitazez:          "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
  "Pending release":"bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
};

// ── Candidate card ─────────────────────────────────────────────────────────────

function CvCandidateCard({
  candidate: c, selected, onToggleSelect, onAction, overdueDays, lockedDaysLeft,
}: { candidate: Candidate; selected: boolean; onToggleSelect: () => void; onAction: () => void; overdueDays?: number; lockedDaysLeft?: number }) {
  type FieldDef = { label: string; value: string; bold?: boolean; badge?: boolean };
  const fields: FieldDef[] = [
    { label: "FULL NAME",      value: c.full_name,                                                   bold: true },
    { label: "CANDIDATE CODE", value: c.candidate_code ?? "—" },
    { label: "GENDER",         value: c.gender ?? "—" },
    { label: "AGE",            value: String(calcAge(c.dob) ?? c.age ?? "—") },
    { label: "RELIGION",       value: c.religion ?? "—" },
    { label: "MARITAL STATUS", value: c.marital_status ?? "—" },
    { label: "BIRTH PLACE",    value: c.birth_place ?? "—" },
    { label: "LIVING TOWN",    value: c.living_town ?? "—" },
    { label: "OCCUPATION",     value: c.occupation ?? "—" },
    { label: "NATIONALITY",    value: c.country ?? "—" },
    { label: "PASSPORT #",     value: c.passport_number ?? "—" },
    { label: "DOB",            value: c.dob ?? "—" },
    { label: "OFFICE",         value: c.office ?? "—" },
    { label: "COC STATUS",     value: c.coc_status ?? "—",     badge: true },
    { label: "MEDICAL STATUS", value: c.medical_status ?? "—", badge: true },
    { label: "MEDICAL DATE",   value: c.medical_date ? new Date(c.medical_date).toLocaleDateString() : "—" },
    { label: "SELECTED BY",    value: c.selected_by ?? "—" },
    { label: "CV SENT TO",     value: c.cv_sent_to ?? "—" },
    { label: "CV SENT DATE",   value: c.cv_sent_date ? new Date(c.cv_sent_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "—" },
  ];

  return (
    <div className={cn(
      "bg-white border border-border shadow-sm rounded-sm transition-colors",
      selected && "ring-1 ring-primary/50 bg-primary/5",
      lockedDaysLeft != null && "opacity-60",
    )}>
      {/* Status badge + checkbox + indicators row */}
      <div className="flex items-center gap-2 px-4 pt-2.5 pb-1">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          disabled={lockedDaysLeft != null}
          aria-label="Select candidate"
        />
        <StatusBadge status="available" />
        {lockedDaysLeft != null ? (
          <span className="ml-auto rounded-none px-1.5 py-0.5 text-[10px] font-semibold bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            Locked · {lockedDaysLeft}d left
          </span>
        ) : overdueDays != null ? (
          <span className="ml-auto rounded-none px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
            Resend · {overdueDays}d
          </span>
        ) : null}
      </div>

      {/* Main content row */}
      <div className="flex items-center gap-4 pl-4 pb-3 pt-1">
        {/* Photo */}
        <div className="shrink-0">
          <Avatar className="h-14 w-14">
            {c.photo_url && <AvatarImage src={c.photo_url} alt={c.full_name} />}
            <AvatarFallback className="text-[11px]">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>

        {/* Fields */}
        <div className="flex-1">
          <div className="flex gap-6 items-start py-1">
            {fields.map((f) => (
              <div key={f.label} className="shrink-0 w-[90px]">
                <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1 whitespace-nowrap">
                  {f.label}
                </div>
                {f.badge && f.value && f.value !== "—" ? (
                  <span className={cn(
                    "text-[11px] font-semibold px-1.5 py-0.5 rounded-sm whitespace-nowrap",
                    OPTION_COLORS[f.value] ?? "bg-zinc-100/50 text-[#181A27]",
                  )}>
                    {f.value}
                  </span>
                ) : (
                  <div className={cn(
                    "text-sm text-foreground break-words",
                    f.bold && "font-semibold",
                  )}>
                    {f.value || "—"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions — sticky right */}
        <div className={cn(
          "sticky right-0 z-10 self-stretch shrink-0 flex flex-col justify-center items-end gap-1.5 pr-4 pl-3",
          "shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.07)]",
          selected ? "bg-primary/5" : "bg-white",
        )}>
          <Button
            size="sm"
            onClick={onAction}
            className="bg-[#5cb8c4] hover:bg-[#4aa8b4] text-white px-5 h-8 rounded text-xs font-semibold tracking-wide"
          >
            VIEW
          </Button>
        </div>
      </div>
    </div>
  );
}

const MEDICAL_OPTIONS = ["Fit", "Booked", "Unfit", "No", "In progress", "Expired"];

const CV_REQ_KEY = "cv-page-requirements";

function getCvReqDefaults() {
  const defaults = {
    age: "all", gender: "all", religion: "all", medical: "Fit",
    narrative: "all", experience: "all", coc: "Done",
    musaned: "all", selected_by: "all", cv_sent_to: "all",
    english_level: "all",
  };
  try {
    const saved = localStorage.getItem(CV_REQ_KEY);
    if (!saved) return defaults;
    const req = JSON.parse(saved);
    return {
      age:          req.age          ?? defaults.age,
      gender:       req.gender       ?? defaults.gender,
      religion:     req.religion     ?? defaults.religion,
      medical:      req.medical      ?? defaults.medical,
      narrative:    req.narrative    ?? defaults.narrative,
      experience:   req.experience   ?? defaults.experience,
      coc:          req.coc          ?? defaults.coc,
      musaned:      req.musaned      ?? defaults.musaned,
      selected_by:  req.selected_by  ?? defaults.selected_by,
      cv_sent_to:   req.cv_sent_to   ?? defaults.cv_sent_to,
      english_level:req.english_level?? defaults.english_level,
    };
  } catch { return defaults; }
}

const initialFilters = {
  sort: "newest",
  ...getCvReqDefaults(),
  from: "",
  to: "",
};

// ── Page ──────────────────────────────────────────────────────────────────────

function CvGeneratorPage() {
  const { user } = useAuth();
  const qc       = useQueryClient();
  const search   = Route.useSearch();
  const [query,       setQuery]       = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [filters,     setFilters]     = useState(initialFilters);
  const activeCount = Object.entries(filters).filter(([k, v]) => k !== "sort" && v && v !== "all").length;
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [sendOffice,       setSendOffice]        = useState("");
  const [actionCandidates, setActionCandidates] = useState<Candidate[]>([]);

  const toggleSelect = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSelection = () => setSelected(new Set());

  const sendToOfficeMut = useMutation({
    mutationFn: async ({ ids, office }: { ids: string[]; office: string }) => {
      const { error } = await supabase.from("candidates").update({ cv_sent_to: office, cv_sent_date: new Date().toISOString().split("T")[0] }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, { ids, office }) => {
      toast.success(`CV sent to "${office}" for ${ids.length} candidate${ids.length > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["cv-candidates"] });
      clearSelection();
      setSendOffice("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["cv-candidates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["cv-templates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cv_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as CvTemplate[];
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
      return [...new Set(names)].filter((n): n is string => !!n).sort();
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

  const { data: cvDaysThreshold = 7 } = useQuery({
    queryKey: ["staff-manager-cv-threshold", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("manager_id")
        .eq("user_id", user!.id)
        .eq("role", "staff")
        .maybeSingle();
      if (!roleRow?.manager_id) return 7;
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("cv_days_threshold")
        .eq("id", roleRow.manager_id)
        .maybeSingle();
      return profileRow?.cv_days_threshold ?? 7;
    },
  });

  const opts = useMemo(() => {
    const uniq = (k: keyof typeof candidates[0]) =>
      Array.from(new Set(candidates.map((c) => (c[k] as string | null) ?? "").filter(Boolean))).sort();
    return {
      narrative: uniq("narrative"),
    };
  }, [candidates]);

  // Open directly if id param given (e.g. from HR Pool VIEW button)
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current || !search.id || candidates.length === 0) return;
    initialised.current = true;
    const c = candidates.find((x) => x.id === search.id);
    if (c) setActionCandidates([c]);
  }, [search.id, candidates]);

  const filtered = useMemo(() => {
    let list = candidates.filter((c) => c.status === "available");
    if (query) list = list.filter((c) => c.full_name.toLowerCase().includes(query.toLowerCase()));
    if (filters.medical !== "all")      list = list.filter((c) => c.medical_status === filters.medical);
    if (filters.coc !== "all")          list = list.filter((c) => c.coc_status === filters.coc);
    if (filters.gender !== "all")       list = list.filter((c) => c.gender === filters.gender);
    if (filters.religion !== "all")     list = list.filter((c) => c.religion === filters.religion);
    if (filters.narrative !== "all")    list = list.filter((c) => c.narrative === filters.narrative);
    if (filters.experience !== "all")   list = list.filter((c) => c.experience === filters.experience);
    if (filters.musaned !== "all")      list = list.filter((c) => c.musaned_status === filters.musaned);
    if (filters.cv_sent_to !== "all")    list = list.filter((c) => c.cv_sent_to === filters.cv_sent_to);
    if (filters.selected_by !== "all")  list = list.filter((c) => c.selected_by === filters.selected_by);
    if (filters.english_level !== "all") list = list.filter((c) => c.english_level === filters.english_level);
    if (filters.age !== "all") {
      const [min, max] = filters.age.split("-").map(Number);
      list = list.filter((c) => c.age != null && c.age >= min && c.age <= max);
    }
    if (filters.from) list = list.filter((c) => c.created_at >= filters.from);
    if (filters.to)   list = list.filter((c) => c.created_at <= filters.to + "T23:59:59");
    const todayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
    const overdueDaysFor = (c: typeof list[0]) => {
      if (!c.cv_sent_to || c.selected_by || !c.cv_sent_date) return -1;
      return Math.floor((todayMs - new Date(c.cv_sent_date + "T00:00:00").getTime()) / 86_400_000);
    };
    list.sort((a, b) => {
      const aDays = overdueDaysFor(a);
      const bDays = overdueDaysFor(b);
      const aOverdue = aDays >= cvDaysThreshold;
      const bOverdue = bDays >= cvDaysThreshold;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      return filters.sort === "newest"
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at);
    });
    return list;
  }, [candidates, query, filters, cvDaysThreshold]);

  const candidateStatus = useMemo(() => {
    const todayMs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
    const result = new Map<string, { overdueDays?: number; lockedDaysLeft?: number }>();
    for (const c of filtered) {
      if (c.cv_sent_to && !c.selected_by && c.cv_sent_date) {
        const days = Math.floor((todayMs - new Date(c.cv_sent_date + "T00:00:00").getTime()) / 86_400_000);
        if (days >= cvDaysThreshold) {
          result.set(c.id, { overdueDays: days });
        } else {
          result.set(c.id, { lockedDaysLeft: cvDaysThreshold - days });
        }
      }
    }
    return result;
  }, [filtered, cvDaysThreshold]);

  const selectableFiltered = useMemo(
    () => filtered.filter((c) => !candidateStatus.get(c.id)?.lockedDaysLeft),
    [filtered, candidateStatus],
  );

  const allSel  = selectableFiltered.length > 0 && selectableFiltered.every((c) => selected.has(c.id));
  const someSel = !allSel && selectableFiltered.some((c) => selected.has(c.id));

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] mx-[79.6px]">
      <div className="shrink-0 mb-6">
        <PageHeader
          title="CV Page"
          description="Available candidates with Medical Fit and COC Done."
        />
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-2 mb-6 shrink-0">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 rounded-none"
            placeholder="Search candidates…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
          {filtered.length} candidates
        </span>
      </div>

      {/* Filters */}
      <Card className="rounded-none mb-6 shrink-0">
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
              size="sm" variant="ghost" className="h-7 gap-1 text-xs"
              onClick={() => setFilters(initialFilters)}
              disabled={activeCount === 0}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
          {showFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <CvFilterSelect value={filters.sort} onChange={(v) => setFilters({ ...filters, sort: v })}
                icon={ArrowUpDown}
                options={[{ value: "newest", label: "Date (Newest)" }, { value: "oldest", label: "Date (Oldest)" }]} />
              <CvFilterSelect placeholder="Age" value={filters.age} icon={Users}
                onChange={(v) => setFilters({ ...filters, age: v })}
                options={[
                  { value: "all", label: "-----" },
                  { value: "18-25", label: "18-25" }, { value: "26-35", label: "26-35" },
                  { value: "36-45", label: "36-45" }, { value: "46-99", label: "46+" },
                ]} />
              <CvFilterSelect placeholder="Gender" value={filters.gender} icon={User}
                onChange={(v) => setFilters({ ...filters, gender: v })}
                options={[{ value: "all", label: "-----" }, { value: "Male", label: "Male" }, { value: "Female", label: "Female" }]} />
              <CvFilterSelect placeholder="Religion" value={filters.religion} icon={BookOpen}
                onChange={(v) => setFilters({ ...filters, religion: v })}
                options={[{ value: "all", label: "-----" }, { value: "Muslim", label: "Muslim" }, { value: "Non-muslim", label: "Non-muslim" }]} />
              <CvFilterSelect placeholder="Medical" value={filters.medical} icon={Stethoscope}
                onChange={(v) => setFilters({ ...filters, medical: v })}
                options={[{ value: "all", label: "-----" }, ...MEDICAL_OPTIONS.map((o) => ({ value: o, label: o }))]} />
              <CvFilterSelect placeholder="Narrative" value={filters.narrative} icon={FileText}
                onChange={(v) => setFilters({ ...filters, narrative: v })}
                options={[{ value: "all", label: "-----" }, ...opts.narrative.map((o) => ({ value: o, label: o }))]} />
              <CvFilterSelect placeholder="Experience" value={filters.experience} icon={Briefcase}
                onChange={(v) => setFilters({ ...filters, experience: v })}
                options={[{ value: "all", label: "-----" }, { value: "Yes", label: "Yes" }, { value: "No", label: "No" }, { value: "None", label: "None" }]} />
              <CvFilterSelect placeholder="COC" value={filters.coc} icon={FileCheck}
                onChange={(v) => setFilters({ ...filters, coc: v })}
                options={[{ value: "all", label: "-----" }, ...["Done","No","Booked","Placed","Yitazez","Pending Release"].map((o) => ({ value: o, label: o }))]} />
              <CvFilterSelect placeholder="Country" value={filters.musaned} icon={Globe}
                onChange={(v) => setFilters({ ...filters, musaned: v })}
                options={[{ value: "all", label: "-----" }, ...assignCountries.map((c) => ({ value: c.name, label: c.name }))]} />
              <CvFilterSelect placeholder="Selected By" value={filters.selected_by} icon={ClipboardPaste}
                onChange={(v) => setFilters({ ...filters, selected_by: v })}
                options={[{ value: "all", label: "-----" }, ...agencyOptions.map((o) => ({ value: o, label: o }))]} />
              <CvFilterSelect placeholder="CV Sent To" value={filters.cv_sent_to} icon={Send}
                onChange={(v) => setFilters({ ...filters, cv_sent_to: v })}
                options={[{ value: "all", label: "-----" }, ...agencyOptions.map((o) => ({ value: o, label: o }))]} />
              <CvFilterSelect placeholder="English Level" value={filters.english_level} icon={BookOpen}
                onChange={(v) => setFilters({ ...filters, english_level: v })}
                options={[{ value: "all", label: "-----" }, ...["Poor","Little","Fair","Good"].map((o) => ({ value: o, label: o }))]} />
              <CvDateField label="From Date" value={filters.from} onChange={(v) => setFilters({ ...filters, from: v })} />
              <CvDateField label="To Date" value={filters.to} onChange={(v) => setFilters({ ...filters, to: v })} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Select-all + bulk action bar */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between shrink-0 mb-3 px-1">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <Checkbox
              checked={allSel ? true : someSel ? "indeterminate" : false}
              onCheckedChange={(v) => selectableFiltered.forEach((c) => { if (!!v !== selected.has(c.id)) toggleSelect(c.id); })}
            />
            Select all ({selectableFiltered.length}{selectableFiltered.length < filtered.length ? ` of ${filtered.length}` : ""})
          </label>
          {selected.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground shrink-0">{selected.size} selected</span>
              <Select value={sendOffice} onValueChange={setSendOffice}>
                <SelectTrigger className="h-8 w-44 rounded-none text-xs">
                  <SelectValue placeholder="Send CV to office…" />
                </SelectTrigger>
                <SelectContent>
                  {agencyOptions.map((o) => (
                    <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-8 rounded-none"
                disabled={!sendOffice || sendToOfficeMut.isPending}
                onClick={() => {
                  const ids = filtered
                    .filter((c) => selected.has(c.id) && !candidateStatus.get(c.id)?.lockedDaysLeft)
                    .map((c) => c.id);
                  if (ids.length === 0) {
                    toast.info("Selected candidates are still within the requirement period — cannot resend yet");
                    return;
                  }
                  sendToOfficeMut.mutate({ ids, office: sendOffice });
                }}
              >
                <Send className="h-3.5 w-3.5" />
                {sendToOfficeMut.isPending ? "Sending…" : "Send CV"}
              </Button>
              <Button
                size="sm"
                className="gap-2 text-xs h-8 rounded-none"
                onClick={() => {
                  const sel = filtered.filter((c) => selected.has(c.id));
                  if (sel.length > 0) setActionCandidates(sel);
                }}
              >
                <FileText className="h-4 w-4" />
                Action ({selected.size})
              </Button>
              <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs rounded-none" onClick={clearSelection}>
                <X className="h-4 w-4" /> Clear
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Card list */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max space-y-2">
          {filtered.map((c) => {
            const status = candidateStatus.get(c.id);
            return (
              <CvCandidateCard
                key={c.id}
                candidate={c}
                selected={selected.has(c.id)}
                onToggleSelect={() => toggleSelect(c.id)}
                onAction={() => setActionCandidates([c])}
                overdueDays={status?.overdueDays}
                lockedDaysLeft={status?.lockedDaysLeft}
              />
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-16">
              No candidates with Medical Fit and COC Done.
            </div>
          )}
        </div>
      </div>

      {actionCandidates.length > 0 && (
        <BulkActionDialog candidates={actionCandidates} onClose={() => setActionCandidates([])} />
      )}
    </div>
  );
}

function CvFilterSelect({
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
          ) : (
            <span>{options.find((o) => o.value === value)?.label ?? value}</span>
          )}
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!isReset && (
        <button type="button" onClick={() => onChange("all")}
          className="h-7 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground border border-l-0 border-border bg-muted/40 hover:bg-muted transition-colors rounded-none">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function CvDateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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
        <PopoverContent className="w-auto p-0 rounded-none" align="start" side="bottom" sideOffset={6} collisionPadding={16}>
          <CalendarPicker mode="single" selected={selected} onSelect={handleSelect} initialFocus />
        </PopoverContent>
      </Popover>
      {hasValue && (
        <button type="button" onClick={() => onChange("")}
          className="h-7 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground border border-l-0 border-border bg-muted/40 hover:bg-muted transition-colors rounded-none">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
