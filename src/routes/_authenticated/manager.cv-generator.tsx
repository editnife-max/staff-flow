import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, FileText, User, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Send, ClipboardPaste, X, RotateCcw, Stethoscope, Briefcase, FileCheck,
  Globe, BookOpen, Users, Calendar, Trash2, Play, SlidersHorizontal, Lock,
  GitBranch, RefreshCw,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { ActionDialog as BulkActionDialog } from "@/components/action-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

export const Route = createFileRoute("/_authenticated/manager/cv-generator")({
  head: () => ({ meta: [{ title: "CV Page — Manager" }] }),
  validateSearch: z.object({ id: z.string().optional() }),
  component: ManagerCvGeneratorPage,
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

const CV_GENERATOR_COLS = [
  "CANDIDATE CODE", "PASSPORT NUMBER", "LABOUR ID",
  "AGE", "VIDEO", "MARITAL STATUS",
  "NARRATIVE PHONE", "NARRATIVE", "RELIGION",
  "CV SENT TO", "CV SENT DATE",
  "PASSPORT STATUS", "COC STATUS", "COUNTRY", "MEDICAL STATUS", "MEDICAL DATE",
  "EXPERIENCE", "NOTES", "AVAILABILITY", "SELECTED BY",
] as const;

// ── Candidate card ─────────────────────────────────────────────────────────────

function CvCandidateCard({
  candidate: c, selected, onToggleSelect, onAction, onRemoveFromAgency, overdueDays, visibleCols, onResend,
}: { candidate: Candidate; selected: boolean; onToggleSelect: () => void; onAction: () => void; onRemoveFromAgency: () => void; overdueDays?: number; visibleCols: readonly string[]; onResend?: () => void }) {
  const [viewing, setViewing] = useState(false);
  type FieldDef = { label: string; value: string; bold?: boolean; badge?: boolean; video?: boolean };
  const fields: FieldDef[] = [
    { label: "CANDIDATE CODE",  value: c.candidate_code ?? "—" },
    { label: "PASSPORT NUMBER", value: c.passport_number ?? "—" },
    { label: "LABOUR ID",       value: (c as any).labour_id ?? "—" },
    { label: "AGE",             value: String(calcAge(c.dob) ?? c.age ?? "—") },
    { label: "VIDEO",           value: c.video_url ?? "", video: true },
    { label: "MARITAL STATUS",  value: c.marital_status ?? "—" },
    { label: "NARRATIVE PHONE", value: (c as any).narrative_phone ?? "—" },
    { label: "NARRATIVE",       value: c.narrative ?? "—" },
    { label: "RELIGION",        value: c.religion ?? "—" },
    { label: "CV SENT TO",      value: c.cv_sent_to ?? "—" },
    { label: "CV SENT DATE",    value: c.cv_sent_date ? new Date(c.cv_sent_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "—" },
    { label: "PASSPORT STATUS", value: (c as any).passport_status ?? "—" },
    { label: "COC STATUS",      value: c.coc_status ?? "—",     badge: true },
    { label: "COUNTRY",         value: (c as any).musaned_status ?? "—" },
    { label: "MEDICAL STATUS",  value: c.medical_status ?? "—", badge: true },
    { label: "MEDICAL DATE",    value: c.medical_date ? new Date(c.medical_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "—" },
    { label: "EXPERIENCE",      value: (c.experience === "None" ? "No" : c.experience) ?? "—" },
    { label: "NOTES",           value: (c as any).notes ?? "—" },
    { label: "AVAILABILITY",    value: (() => { const v = (c as any).availability_type ?? "available"; return v.charAt(0).toUpperCase() + v.slice(1); })() },
    { label: "SELECTED BY",     value: c.selected_by ?? "—" },
  ];

  const bg = selected ? "var(--selected-bg)" : "var(--card)";

  return (
    <div
      className={cn("border border-border shadow-sm rounded-sm transition-colors", selected && "ring-1 ring-primary/50")}
      style={{ background: bg }}
    >
      {/* Status badge + checkbox + indicators — sticky left */}
      <div className="sticky left-0 z-10 w-fit flex items-center gap-2 px-4 pt-2.5 pb-1" style={{ background: bg }}>
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          aria-label="Select candidate"
        />
        <StatusBadge status="available" />
        {overdueDays != null ? (
          <button type="button" onClick={onResend} title="Click to resend CV to all other offices"
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 leading-none hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors cursor-pointer">
            <RefreshCw className="h-2.5 w-2.5" /> Resend · {overdueDays}d
          </button>
        ) : null}
      </div>

      {/* Main content row */}
      <div className="flex items-center pb-3 pt-1">
        {/* Sticky left: photo + full name */}
        <div className="sticky left-0 z-10 shrink-0 self-stretch flex items-center gap-4 pl-4 pr-3" style={{ background: bg }}>
          <Avatar className="h-14 w-14 shrink-0">
            {c.photo_url && <AvatarImage src={c.photo_url} alt={c.full_name} />}
            <AvatarFallback className="text-[11px]">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="shrink-0 w-[110px]">
            <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1 whitespace-nowrap">FULL NAME</div>
            <span className="text-sm font-semibold break-words line-clamp-2">{c.full_name || "—"}</span>
          </div>
        </div>

        {/* Scrollable field columns */}
        <div className="flex-1 flex items-start gap-2">
          {fields.filter((f) => visibleCols.includes(f.label)).map((f) => (
            <div key={f.label} className="shrink-0 w-[110px]">
              <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1 whitespace-nowrap">
                {f.label}
              </div>
              {f.video ? (
                f.value ? (
                  <a href={f.value} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline text-xs">
                    <Play className="h-3 w-3" /> Play
                  </a>
                ) : <div className="text-sm text-foreground">—</div>
              ) : f.badge && f.value && f.value !== "—" ? (
                <span className={cn(
                  "text-[11px] font-semibold px-1.5 py-0.5 rounded-sm whitespace-nowrap",
                  OPTION_COLORS[f.value] ?? "bg-zinc-100/50 text-foreground dark:bg-zinc-800 dark:text-zinc-300",
                )}>
                  {f.value}
                </span>
              ) : (
                <div className={cn("text-sm text-foreground break-words line-clamp-2", f.bold && "font-semibold")}>
                  {f.value || "—"}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Sticky right: actions */}
        <div className="sticky right-0 z-10 self-stretch shrink-0 flex flex-col justify-center items-center gap-1.5 px-4 border-l border-border" style={{ background: bg }}>
          <Button size="sm" onClick={() => setViewing(true)} className="w-full px-5 h-8 rounded text-xs font-semibold tracking-wide">
            VIEW
          </Button>
          <Button size="sm" variant="outline" onClick={onAction} className="w-full px-5 h-8 rounded text-xs font-semibold tracking-wide">
            ACTION
          </Button>
          {c.cv_sent_to && (
            <button
              type="button"
              onClick={onRemoveFromAgency}
              className="text-xs text-destructive hover:underline flex items-center gap-1"
              title={`Remove from ${c.cv_sent_to}`}
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
      </div>
      <CandidateDetailDialog candidate={viewing ? c : null} onClose={() => setViewing(false)} />
    </div>
  );
}

const MEDICAL_OPTIONS = ["Fit", "Booked", "Unfit", "No", "In progress", "Expired"];

// ── Page ──────────────────────────────────────────────────────────────────────

function ManagerCvGeneratorPage() {
  const { user } = useAuth();
  const qc       = useQueryClient();
  const search   = Route.useSearch();
  const [query,   setQuery]   = useState("");
  const [filters, setFilters] = useState({
    sort:          "newest",
    age:           [] as string[],
    gender:        [] as string[],
    religion:      [] as string[],
    medical:       [] as string[],
    coc:           [] as string[],
    narrative:     [] as string[],
    experience:    [] as string[],
    musaned:       [] as string[],
    cv_sent_to:    [] as string[],
    selected_by:   [] as string[],
    english_level: [] as string[],
    from:          "",
    to:            "",
  });
  const activeCount = Object.entries(filters).filter(([k, v]) =>
    k !== "sort" && (Array.isArray(v) ? v.length > 0 : !!v)
  ).length;
  const [page,        setPage]        = useState(1);
  const [pageSize,    setPageSize]    = useState(5);
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [sendOffice,       setSendOffice]        = useState("");
  const [showDistribute,   setShowDistribute]    = useState(false);
  const [actionCandidates, setActionCandidates] = useState<Candidate[]>([]);
  const [removeTarget,     setRemoveTarget]      = useState<Candidate | null>(null);
  const [hiddenCols,       setHiddenCols]        = useState<Set<string>>(new Set());
  const [showColPicker,    setShowColPicker]      = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);
  const fadeRef      = useRef<HTMLDivElement>(null);
  const mirrorRef    = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) setShowColPicker(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
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

  const toggleSelect = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSelection = () => setSelected(new Set());

  const removeFromAgencyMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("candidates")
        .update({ cv_sent_to: null, cv_sent_date: null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Candidate removed from agency");
      qc.invalidateQueries({ queryKey: ["mgr-cv-candidates"] });
      setRemoveTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendToOfficeMut = useMutation({
    mutationFn: async ({ ids, office }: { ids: string[]; office: string }) => {
      const { error } = await supabase.from("candidates").update({ cv_sent_to: office, cv_sent_date: new Date().toISOString().split("T")[0] }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, { ids, office }) => {
      toast.success(`CV sent to "${office}" for ${ids.length} candidate${ids.length > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["mgr-cv-candidates"] });
      clearSelection();
      setSendOffice("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: officesList = [] } = useQuery({
    queryKey: ["assignment-offices", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("assignment_offices").select("id, name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const resendMut = useMutation({
    mutationFn: async (candidateId: string) => {
      const cand = candidates.find(c => c.id === candidateId);
      if (!cand) throw new Error("Candidate not found");
      const seen = new Set([cand.cv_sent_to, ...((cand.cv_resent_offices as string[]) ?? [])].filter(Boolean) as string[]);
      const eligible = officesList.filter(o => !seen.has(o.name));
      const today = new Date().toISOString().split("T")[0];
      if (eligible.length === 0) {
        // All offices exhausted — cycle back to current office with reset history
        const { error } = await supabase.from("candidates")
          .update({ cv_sent_to: cand.cv_sent_to, cv_sent_date: today, cv_resent_offices: [], cv_resent_date: today } as any)
          .eq("id", candidateId);
        if (error) throw error;
        return { cycled: true };
      }
      const best = eligible.reduce((a, b) =>
        candidates.filter(c => c.cv_sent_to === a.name && !c.selected_by).length <=
        candidates.filter(c => c.cv_sent_to === b.name && !c.selected_by).length ? a : b
      );
      const history = [...new Set([...((cand.cv_resent_offices as string[]) ?? []), cand.cv_sent_to])].filter(Boolean);
      const { error } = await supabase.from("candidates")
        .update({ cv_sent_to: best.name, cv_sent_date: today, cv_resent_offices: history, cv_resent_date: today } as any)
        .eq("id", candidateId);
      if (error) throw error;
      return { cycled: false };
    },
    onSuccess: (result) => {
      toast.success(result?.cycled ? "All offices tried — reset to current office for a new cycle" : "CV redistributed to a new office");
      qc.invalidateQueries({ queryKey: ["mgr-cv-candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const distributeMut = useMutation({
    mutationFn: async (plan: Array<{ name: string; ids: string[]; overdueEntries: Array<{ id: string; oldOffice: string; cycleReset?: boolean }> }>) => {
      const today = new Date().toISOString().split("T")[0];
      for (const { name, ids, overdueEntries } of plan) {
        if (ids.length === 0) continue;
        const overdueSet = new Set(overdueEntries.map(o => o.id));
        const unsentIds = ids.filter(id => !overdueSet.has(id));
        if (unsentIds.length > 0) {
          const { error } = await supabase.from("candidates").update({ cv_sent_to: name, cv_sent_date: today }).in("id", unsentIds);
          if (error) throw error;
        }
        for (const { id, oldOffice, cycleReset } of overdueEntries) {
          const cand = candidates.find(c => c.id === id);
          // cycleReset: all offices were exhausted — clear history so next round cycles through all offices again
          const history = cycleReset ? [] : [...new Set([...((cand?.cv_resent_offices as string[]) ?? []), oldOffice])];
          const { error } = await supabase.from("candidates")
            .update({ cv_sent_to: name, cv_sent_date: today, cv_resent_offices: history, cv_resent_date: today } as any)
            .eq("id", id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => { toast.success("Candidates distributed to offices"); qc.invalidateQueries({ queryKey: ["mgr-cv-candidates"] }); setShowDistribute(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: candidates = [], refetch: refetchCandidates } = useQuery({
    queryKey: ["mgr-cv-candidates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
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

  // Manager profile — days threshold + CV page requirements
  const { data: managerProfile } = useQuery({
    queryKey: ["mgr-cv-profile", user?.id],
    enabled: !!user,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("cv_days_threshold, cv_page_requirements")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  const cvDaysThreshold = managerProfile?.cv_days_threshold ?? 7;

  const lockedFilters = useMemo(() => {
    const req = managerProfile?.cv_page_requirements as Record<string, string> | null;
    const lock = (k: string) => req?.[k] && req[k] !== "all" ? [req[k]] : [];
    return {
      medical:    lock("medical"),
      coc:        lock("coc"),
      narrative:  lock("narrative"),
      experience: lock("experience"),
    };
  }, [managerProfile]);

  // Apply locked filters whenever they change (also clears when a lock is removed)
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      medical:    lockedFilters.medical.length    ? lockedFilters.medical    : [],
      coc:        lockedFilters.coc.length        ? lockedFilters.coc        : [],
      narrative:  lockedFilters.narrative.length  ? lockedFilters.narrative  : [],
      experience: lockedFilters.experience.length ? lockedFilters.experience : [],
    }));
  }, [lockedFilters]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("mgr-cv-req-rt")
      .on<any>("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const row = payload.new;
          if (row) {
            qc.setQueryData(["mgr-cv-profile", user.id], (old: any) => ({
              ...old,
              cv_page_requirements: row.cv_page_requirements ?? null,
              cv_days_threshold: row.cv_days_threshold ?? 7,
            }));
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const opts = useMemo(() => {
    const uniq = (k: keyof typeof candidates[0]) =>
      Array.from(new Set(candidates.map((c) => (c[k] as string | null) ?? "").filter(Boolean))).sort();
    return { narrative: uniq("narrative") };
  }, [candidates]);

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
    if (filters.medical.length > 0)       list = list.filter((c) => filters.medical.includes(c.medical_status ?? ""));
    if (filters.coc.length > 0)           list = list.filter((c) => filters.coc.includes(c.coc_status ?? ""));
    if (filters.gender.length > 0)        list = list.filter((c) => filters.gender.includes(c.gender ?? ""));
    if (filters.religion.length > 0)      list = list.filter((c) => filters.religion.includes(c.religion ?? ""));
    if (filters.narrative.length > 0)     list = list.filter((c) => filters.narrative.includes(c.narrative ?? ""));
    if (filters.experience.length > 0)    list = list.filter((c) => filters.experience.includes(c.experience ?? ""));
    if (filters.musaned.length > 0)       list = list.filter((c) => filters.musaned.includes((c as any).musaned_status ?? ""));
    if (filters.cv_sent_to.length > 0)    list = list.filter((c) => filters.cv_sent_to.includes(c.cv_sent_to ?? ""));
    if (filters.selected_by.length > 0)   list = list.filter((c) => filters.selected_by.includes(c.selected_by ?? ""));
    if (filters.english_level.length > 0) list = list.filter((c) => filters.english_level.includes(c.english_level ?? ""));
    if (filters.age.length > 0) {
      list = list.filter((c) => filters.age.some((range) => {
        const [min, max] = range.split("-").map(Number);
        return c.age != null && c.age >= min && c.age <= max;
      }));
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

  // Managers see overdue indicator but NO locking — all candidates are selectable
  const candidateOverdue = useMemo(() => {
    const todayMs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
    const result = new Map<string, { overdueDays?: number }>();
    for (const c of filtered) {
      if (c.cv_sent_to && !c.selected_by && c.cv_sent_date) {
        const days = Math.floor((todayMs - new Date(c.cv_sent_date + "T00:00:00").getTime()) / 86_400_000);
        if (days >= cvDaysThreshold) result.set(c.id, { overdueDays: days });
      }
    }
    return result;
  }, [filtered, cvDaysThreshold]);

  const distributionPlan = useMemo(() => {
    if (officesList.length === 0) return null;
    const todayMs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
    const unsent = filtered.filter(c => !c.cv_sent_to);
    const overdue = filtered.filter(c => {
      if (!c.cv_sent_to || c.selected_by || !c.cv_sent_date) return false;
      return Math.floor((todayMs - new Date(c.cv_sent_date + "T00:00:00").getTime()) / 86_400_000) >= cvDaysThreshold;
    });
    if (unsent.length === 0 && overdue.length === 0) return null;

    // Live load map excluding overdue candidates that will be moved
    const overdueIdSet = new Set(overdue.map(c => c.id));
    const loads = new Map<string, number>(officesList.map(o => [
      o.name,
      candidates.filter(c => c.cv_sent_to === o.name && !c.selected_by && !overdueIdSet.has(c.id)).length,
    ]));

    // Assign each overdue candidate to the least-loaded eligible office (not in its history)
    // If all offices exhausted, return to original (current) office and reset history for next cycle
    const overdueByOffice = new Map<string, Array<{ id: string; oldOffice: string; cycleReset?: boolean }>>(officesList.map(o => [o.name, []]));
    for (const cand of overdue) {
      const seen = new Set([cand.cv_sent_to, ...((cand.cv_resent_offices as string[]) ?? [])].filter(Boolean) as string[]);
      const eligible = officesList.filter(o => !seen.has(o.name));
      if (eligible.length === 0) {
        // All offices tried — send back to current office and reset history so next cycle starts fresh
        const orig = cand.cv_sent_to!;
        if (overdueByOffice.has(orig)) {
          overdueByOffice.get(orig)!.push({ id: cand.id, oldOffice: orig, cycleReset: true });
          loads.set(orig, (loads.get(orig) ?? 0) + 1);
        }
        continue;
      }
      const best = eligible.reduce((a, b) => (loads.get(a.name) ?? 0) <= (loads.get(b.name) ?? 0) ? a : b);
      overdueByOffice.get(best.name)!.push({ id: cand.id, oldOffice: cand.cv_sent_to! });
      loads.set(best.name, (loads.get(best.name) ?? 0) + 1);
    }

    // Distribution ratio = how many Processing candidates each office has selected
    const processing = officesList.map(o => candidates.filter(c => c.status === "processing" && c.selected_by === o.name).length);
    const totalProc = processing.reduce((a, b) => a + b, 0);

    // Distribute unsent candidates proportionally by Processing selected_by share
    const weights = processing;
    const totalW = weights.reduce((a, b) => a + b, 0);
    const eff = totalW === 0 ? officesList.map(() => 1) : weights;
    const effTotal = eff.reduce((a, b) => a + b, 0);
    const n = unsent.length;
    const exact = eff.map(w => n * (w / effTotal));
    const floors = exact.map(Math.floor);
    let rem = n - floors.reduce((a, b) => a + b, 0);
    const fracs = exact.map((e, i) => ({ i, f: e - floors[i] })).sort((a, b) => b.f - a.f);
    const counts = [...floors];
    for (let r = 0; r < rem; r++) counts[fracs[r].i]++;
    let idx = 0;

    return officesList.map((o, i) => {
      const unsentSlice = unsent.slice(idx, idx + counts[i]);
      idx += counts[i];
      const od = overdueByOffice.get(o.name)!;
      const cycleCount = od.filter(e => e.cycleReset).length;
      const movedIn = od.length - cycleCount; // overdue arriving from OTHER offices
      return {
        name: o.name,
        processing: processing[i],
        pct: totalProc > 0 ? Math.round((processing[i] / totalProc) * 100) : Math.round(100 / officesList.length),
        leavingCount: overdue.filter(c => c.cv_sent_to === o.name).length, // overdue leaving this office
        cycleCount,                                    // exhausted-cycle candidates returning here
        newCount: unsentSlice.length,
        movedIn,                                       // overdue from other offices arriving here
        count: unsentSlice.length + od.length,
        overdueCount: od.length,
        ids: [...unsentSlice.map(c => c.id), ...od.map(a => a.id)],
        overdueEntries: od,
      };
    });
  }, [filtered, officesList, candidates, cvDaysThreshold]);

  useEffect(() => { setPage(1); }, [filtered.length, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedList  = filtered.slice((page - 1) * pageSize, page * pageSize);

  const allSel  = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const someSel = !allSel && filtered.some((c) => selected.has(c.id));

  return (
    <div className="mx-[79.6px] pb-20">
      <div className="shrink-0 mb-6">
        <PageHeader
          title="CV Page"
          description="Available candidates — manager view with full send privileges."
        />
      </div>

      {/* Filters */}
      <Card className="rounded-none mb-4 shrink-0">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <span className="rounded-none bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                {activeCount}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-5">
            <CvFilterSelect value={filters.sort} onChange={(v) => setFilters({ ...filters, sort: v })}
              icon={ArrowUpDown}
              options={[{ value: "newest", label: "Date (Newest)" }, { value: "oldest", label: "Date (Oldest)" }]} />
            <MultiFilterSelect placeholder="Age" values={filters.age} icon={Users}
              onChange={(v) => setFilters({ ...filters, age: v })}
              options={[{ value: "18-25", label: "18-25" }, { value: "26-35", label: "26-35" }, { value: "36-45", label: "36-45" }, { value: "46-99", label: "46+" }]} />
            <MultiFilterSelect placeholder="Gender" values={filters.gender} icon={User}
              onChange={(v) => setFilters({ ...filters, gender: v })}
              options={[{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }]} />
            <MultiFilterSelect placeholder="Religion" values={filters.religion} icon={BookOpen}
              onChange={(v) => setFilters({ ...filters, religion: v })}
              options={[{ value: "Muslim", label: "Muslim" }, { value: "Non-muslim", label: "Non-muslim" }]} />
            <MultiFilterSelect placeholder="Medical" values={filters.medical} icon={Stethoscope}
              onChange={(v) => setFilters({ ...filters, medical: v })}
              locked={lockedFilters.medical.length > 0}
              options={[{ value: "", label: "Not Selected" }, ...MEDICAL_OPTIONS.map((o) => ({ value: o, label: o }))]} />
            <MultiFilterSelect placeholder="Narrative" values={filters.narrative} icon={FileText}
              onChange={(v) => setFilters({ ...filters, narrative: v })}
              locked={lockedFilters.narrative.length > 0}
              options={opts.narrative.map((o) => ({ value: o, label: o }))} />
            <MultiFilterSelect placeholder="Experience" values={filters.experience} icon={Briefcase}
              onChange={(v) => setFilters({ ...filters, experience: v })}
              locked={lockedFilters.experience.length > 0}
              options={[{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }, { value: "None", label: "None" }]} />
            <MultiFilterSelect placeholder="COC" values={filters.coc} icon={FileCheck}
              onChange={(v) => setFilters({ ...filters, coc: v })}
              locked={lockedFilters.coc.length > 0}
              options={[{ value: "", label: "Not Selected" }, ...["Done","No","Booked","Placed","Yitazez","Pending Release"].map((o) => ({ value: o, label: o }))]} />
            <MultiFilterSelect placeholder="Country" values={filters.musaned} icon={Globe}
              onChange={(v) => setFilters({ ...filters, musaned: v })}
              options={assignCountries.map((c) => ({ value: c.name, label: c.name }))} />
            <MultiFilterSelect placeholder="Selected By" values={filters.selected_by} icon={ClipboardPaste}
              onChange={(v) => setFilters({ ...filters, selected_by: v })}
              options={agencyOptions.map((o) => ({ value: o, label: o }))} />
            <MultiFilterSelect placeholder="CV Sent To" values={filters.cv_sent_to} icon={Send}
              onChange={(v) => setFilters({ ...filters, cv_sent_to: v })}
              options={agencyOptions.map((o) => ({ value: o, label: o }))} />
            <MultiFilterSelect placeholder="English" values={filters.english_level} icon={BookOpen}
              onChange={(v) => setFilters({ ...filters, english_level: v })}
              options={["Poor","Little","Fair","Good"].map((o) => ({ value: o, label: o }))} />
            <CvDateField label="From" value={filters.from} onChange={(v) => setFilters({ ...filters, from: v })} />
            <CvDateField label="To" value={filters.to} onChange={(v) => setFilters({ ...filters, to: v })} />
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-7 text-xs rounded-none w-52"
                placeholder="Search by name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{filtered.length}</span> candidate{filtered.length !== 1 ? "s" : ""} found
            </span>
            <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs font-bold"
              onClick={() => { setFilters({ sort: "newest", age: [], gender: [], religion: [], musaned: [], cv_sent_to: [], selected_by: [], english_level: [], from: "", to: "", medical: lockedFilters.medical.length ? lockedFilters.medical : [], coc: lockedFilters.coc.length ? lockedFilters.coc : [], narrative: lockedFilters.narrative.length ? lockedFilters.narrative : [], experience: lockedFilters.experience.length ? lockedFilters.experience : [] }); setQuery(""); }}
              disabled={activeCount === 0 && !query}>
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Select-all + bulk action bar */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between shrink-0 mb-3 px-1">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <Checkbox
              checked={allSel ? true : someSel ? "indeterminate" : false}
              onCheckedChange={(v) => filtered.forEach((c) => { if (!!v !== selected.has(c.id)) toggleSelect(c.id); })}
            />
            Select all ({filtered.length})
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs rounded-none"
              disabled={officesList.length === 0}
              onClick={async () => { await refetchCandidates(); setShowDistribute(true); }}>
              <GitBranch className="h-3.5 w-3.5" /> Distribute to Offices
            </Button>
            {hiddenCols.size > 0 && (
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setHiddenCols(new Set())}>
                <RotateCcw className="h-3 w-3" /> Reset columns
              </Button>
            )}
            <div className="relative" ref={colPickerRef}>
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setShowColPicker((v) => !v)}>
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
                    <button type="button" onClick={() => setHiddenCols(new Set())} className="text-[11px] text-primary hover:underline disabled:opacity-40" disabled={hiddenCols.size === 0}>Reset</button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {CV_GENERATOR_COLS.map((label) => (
                      <label key={label} className="flex items-center gap-1.5 text-xs cursor-pointer py-1 hover:text-primary">
                        <Checkbox
                          checked={!hiddenCols.has(label)}
                          onCheckedChange={(v) => setHiddenCols((prev) => { const n = new Set(prev); v ? n.delete(label) : n.add(label); return n; })}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {selected.size > 0 && (
              <>
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
                    const ids = filtered.filter((c) => selected.has(c.id)).map((c) => c.id);
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Card list */}
      <div className="relative">
        <div ref={scrollRef} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-w-max space-y-1.5">
          {pagedList.map((c) => {
            const status = candidateOverdue.get(c.id);
            const visibleCols = (CV_GENERATOR_COLS as readonly string[]).filter((l) => !hiddenCols.has(l));
            return (
              <CvCandidateCard
                key={c.id}
                candidate={c}
                selected={selected.has(c.id)}
                onToggleSelect={() => toggleSelect(c.id)}
                onAction={() => setActionCandidates([c])}
                onRemoveFromAgency={() => setRemoveTarget(c)}
                overdueDays={status?.overdueDays}
                onResend={status?.overdueDays != null ? () => resendMut.mutate(c.id) : undefined}
                visibleCols={visibleCols}
              />
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-16">
              No available candidates match the current filters.
            </div>
          )}
        </div>
        </div>
        <div ref={fadeRef} aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent opacity-0 transition-opacity duration-200" />
      </div>

      {/* Pagination footer */}
      <div className={cn("sticky bottom-0 z-10 bg-background", filtered.length > 0 && "shadow-[0_-1px_3px_rgba(0,0,0,0.06)]")}>
        <div ref={mirrorRef} className="w-full" style={{ overflowX: filtered.length > 0 ? "scroll" : "hidden", overflowY: "hidden", height: filtered.length > 0 ? 16 : 0 }}><div style={{ height: 1 }} /></div>
        {filtered.length > 0 && (
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
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs font-bold"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                <ChevronUp className="h-3.5 w-3.5" /> Back to top
              </Button>
            </div>
          </div>
        )}
      </div>

      {actionCandidates.length > 0 && (
        <BulkActionDialog candidates={actionCandidates} onClose={() => setActionCandidates([])} />
      )}

      {/* Distribute to Offices dialog */}
      <Dialog open={showDistribute} onOpenChange={(o) => { if (!o) setShowDistribute(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" /> Distribute to Offices
            </DialogTitle>
          </DialogHeader>
          {!distributionPlan ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {officesList.length === 0 ? "No offices configured. Add offices in Assignments first." : "No unsent or overdue candidates in current filters."}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                {(() => {
                  const totalNew = distributionPlan.reduce((a, o) => a + o.newCount, 0);
                  const totalLeaving = distributionPlan.reduce((a, o) => a + o.leavingCount, 0);
                  const totalCycle = distributionPlan.reduce((a, o) => a + o.cycleCount, 0);
                  const totalMoved = totalLeaving - totalCycle;
                  const parts: string[] = [];
                  if (totalNew > 0) parts.push(`${totalNew} new`);
                  if (totalMoved > 0) parts.push(`${totalMoved} overdue → new office`);
                  if (totalCycle > 0) parts.push(`${totalCycle} overdue → back to same office`);
                  const total = totalNew + totalLeaving;
                  return `${total} candidate${total !== 1 ? "s" : ""} will be processed` +
                    (parts.length ? ` (${parts.join(", ")})` : ".");
                })()}
              </p>
              <table className="w-full text-xs border-collapse mb-2">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 font-semibold text-muted-foreground">Office</th>
                    <th className="text-right py-1.5 font-semibold text-muted-foreground">Processing</th>
                    <th className="text-right py-1.5 font-semibold text-muted-foreground">Share %</th>
                    <th className="text-right py-1.5 font-semibold text-warning">Leaving</th>
                    <th className="text-right py-1.5 font-semibold text-primary">Receiving</th>
                  </tr>
                </thead>
                <tbody>
                  {distributionPlan.map(o => (
                    <tr key={o.name} className="border-b border-border/40">
                      <td className="py-1.5 font-medium truncate max-w-[120px]">{o.name}</td>
                      <td className="text-right py-1.5 tabular-nums">{o.processing}</td>
                      <td className="text-right py-1.5 tabular-nums">{o.pct}%</td>
                      <td className="text-right py-1.5 tabular-nums text-warning">{o.leavingCount > 0 ? o.leavingCount : "—"}</td>
                      <td className="text-right py-1.5 tabular-nums font-semibold text-primary">
                        {o.count > 0 ? (
                          <span title={[o.newCount > 0 && `${o.newCount} new`, o.movedIn > 0 && `${o.movedIn} overdue in`, o.cycleCount > 0 && `${o.cycleCount} cycle reset`].filter(Boolean).join(", ")}>
                            {o.count}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDistribute(false)}>Cancel</Button>
            <Button
              disabled={!distributionPlan || distributeMut.isPending}
              onClick={() => distributionPlan && distributeMut.mutate(distributionPlan)}
            >
              {distributeMut.isPending ? "Distributing…" : "Confirm Distribute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removeTarget} onOpenChange={(o) => { if (!o) setRemoveTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" /> Remove from Agency
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{removeTarget?.full_name}</strong> from{" "}
            <strong>{removeTarget?.cv_sent_to}</strong>? Their CV sent record will be cleared.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={removeFromAgencyMut.isPending}
              onClick={() => removeTarget && removeFromAgencyMut.mutate(removeTarget.id)}
            >
              {removeFromAgencyMut.isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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

function CvFilterSelect({
  value, onChange, options, placeholder, icon: Icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  icon?: React.ElementType;
}) {
  const isReset = !value || value === "all";
  return (
    <div className="flex items-center gap-0.5">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="border-0 bg-transparent shadow-none h-auto w-auto px-0 gap-1 text-[13px] font-bold text-foreground hover:opacity-70 transition-opacity [&>svg]:shrink-0">
          {Icon && <Icon className="h-3 w-3 shrink-0" />}
          {isReset ? <span>{placeholder}</span> : <span>{options.find((o) => o.value === value)?.label ?? value}</span>}
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => {
            const color = OPTION_COLORS[o.label] ?? OPTION_COLORS[o.value];
            return (
              <SelectItem key={o.value} value={o.value} className="py-1 px-2 focus:bg-muted/50">
                {color ? <OptionPill label={o.label} /> : <span className="text-[14px] text-foreground">{o.label}</span>}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {!isReset && (
        <button type="button" onClick={() => onChange("all")}
          className="rounded-none p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Clear filter">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function MultiFilterSelect({
  values, onChange, options, placeholder, icon: Icon, locked,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  icon?: React.ElementType;
  locked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const isEmpty = values.length === 0;

  const toggle = (val: string) =>
    onChange(values.includes(val) ? values.filter((v) => v !== val) : [...values, val]);

  const filteredOpts = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const triggerLabel = isEmpty
    ? placeholder
    : values.length === 1
      ? (options.find((o) => o.value === values[0])?.label ?? values[0])
      : `${placeholder} (${values.length})`;

  if (locked) {
    return (
      <div className="flex items-center gap-1 text-[13px] font-bold text-muted-foreground cursor-not-allowed select-none">
        {Icon && <Icon className="h-3 w-3 shrink-0" />}
        <span>{triggerLabel}</span>
        <Lock className="h-3 w-3 shrink-0 opacity-60" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
        <PopoverTrigger asChild>
          <button type="button"
            className={cn("group flex items-center gap-1 bg-transparent border-0 text-[13px] font-bold transition-opacity px-0", isEmpty ? "text-foreground hover:opacity-70" : "text-primary")}>
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
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
              className="w-full h-6 text-[12px] px-2 border border-border rounded-none bg-background outline-none placeholder:text-muted-foreground" />
          </div>
          <div className="max-h-[220px] overflow-y-auto">
            {filteredOpts.map((o) => {
              const checked = values.includes(o.value);
              const color = OPTION_COLORS[o.label] ?? OPTION_COLORS[o.value];
              return (
                <button key={o.value} type="button"
                  className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors", checked ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50")}
                  onClick={() => toggle(o.value)}>
                  <Checkbox checked={checked} className="h-3.5 w-3.5 pointer-events-none" />
                  {color
                    ? <span className={cn("text-[13px] font-medium px-1.5 py-0.5", color)}>{o.label}</span>
                    : <span className="text-[13px] text-foreground">{o.label}</span>}
                </button>
              );
            })}
            {filteredOpts.length === 0 && (
              <p className="text-center text-[12px] text-muted-foreground py-2">No results</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {!isEmpty && (
        <button type="button" onClick={() => onChange([])}
          className="rounded-none p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Clear filter">
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
          <button type="button"
            className="flex items-center gap-1 bg-transparent border-0 text-[13px] font-bold text-foreground hover:opacity-70 transition-opacity px-0">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>{hasValue ? selected?.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : label}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-none" align="start" side="bottom" sideOffset={6} collisionPadding={16}>
          <CalendarPicker mode="single" selected={selected} onSelect={handleSelect} initialFocus />
        </PopoverContent>
      </Popover>
      {hasValue && (
        <button type="button" onClick={() => onChange("")}
          className="rounded-none p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Clear date">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
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

type Status = "available" | "processing" | "arrived" | "canceled" | "returned";

function CandidateDetailDialog({ candidate, onClose }: { candidate: Candidate | null; onClose: () => void }) {
  if (!candidate) return null;
  const statusStyles: Record<Status, string> = {
    available:  "bg-emerald-400 text-emerald-800",
    processing: "bg-amber-400 text-amber-800",
    arrived:    "bg-blue-400 text-blue-800",
    canceled:   "bg-red-400 text-red-800",
    returned:   "bg-orange-400 text-orange-800",
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
            <InfoRow label="Full Name"      value={candidate.full_name} />
            <InfoRow label="First Name"     value={candidate.first_name} />
            <InfoRow label="Last Name"      value={candidate.last_name} />
            <InfoRow label="Date of Birth"  value={candidate.dob} />
            <InfoRow label="Age"            value={calcAge(candidate.dob) ?? candidate.age} />
            <InfoRow label="Gender"         value={candidate.gender} />
            <InfoRow label="Religion"       value={candidate.religion} />
            <InfoRow label="Marital Status" value={candidate.marital_status} />
            <InfoRow label="Children"       value={candidate.children} />
            <InfoRow label="Birth Place"    value={candidate.birth_place} />
            <InfoRow label="Living Town"    value={candidate.living_town} />
            <InfoRow label="Country"        value={candidate.country} />
            <InfoRow label="Occupation"     value={candidate.occupation} />
            <InfoRow label="Education"      value={candidate.education} />
            <InfoRow label="Experience"     value={candidate.experience === "None" ? "No" : candidate.experience} />
          </DetailSection>
          <DetailSection title="Passport">
            <InfoRow label="Passport Number" value={candidate.passport_number} />
            <InfoRow label="Passport Status" value={candidate.passport_status} />
            <InfoRow label="Issue Date"      value={candidate.passport_issue_date} />
            <InfoRow label="Expiry Date"     value={candidate.passport_expiry_date} />
            <InfoRow label="Place of Issue"  value={candidate.place_of_issue} />
            <InfoRow label="Labour ID"       value={candidate.labour_id} />
          </DetailSection>
          <DetailSection title="Languages & Physical">
            <InfoRow label="Spoken Languages" value={candidate.spoken_languages} />
            <InfoRow label="English Level"    value={candidate.english_level} />
            <InfoRow label="Arabic Level"     value={candidate.arabic_level} />
            <InfoRow label="Weight (kg)"      value={candidate.weight} />
            <InfoRow label="Height (cm)"      value={candidate.height} />
          </DetailSection>
          <DetailSection title="Status">
            <InfoRow label="Medical Status"  value={candidate.medical_status} />
            <InfoRow label="Medical Date"    value={candidate.medical_date} />
            <InfoRow label="COC Status"      value={candidate.coc_status} />
            <InfoRow label="Country"         value={candidate.musaned_status} />
            <InfoRow label="Passport Status" value={candidate.passport_status} />
            <InfoRow label="Office"          value={candidate.office} />
            <InfoRow label="Selected By"     value={candidate.selected_by} />
            <InfoRow label="Contract Date"   value={candidate.contract_date} />
            <InfoRow label="CV Sent To"      value={candidate.cv_sent_to} />
            <InfoRow label="CV Sent Date"    value={candidate.cv_sent_date} />
            <InfoRow label="Narrative"       value={candidate.narrative} />
            <InfoRow label="Narrative Phone" value={candidate.narrative_phone} />
          </DetailSection>
          <DetailSection title="Logistics & Processing">
            <InfoRow label="Tasheer Status" value={candidate.tasheer_status} />
            <InfoRow label="Tasheer Date"   value={candidate.tasheer_date} />
            <InfoRow label="Wokala Status"  value={candidate.wokala_status} />
            <InfoRow label="Visa Status"    value={candidate.visa_status} />
            <InfoRow label="Ticket Status"  value={candidate.ticket_status} />
            <InfoRow label="Ticket Date"    value={candidate.ticket_date} />
            <InfoRow label="Arrival City"   value={candidate.arrival_city} />
            <InfoRow label="LMIS Status"    value={candidate.lmis_status} />
            <InfoRow label="Insurance"      value={candidate.insurance_status} />
          </DetailSection>
          {(candidate.skills || candidate.notes || candidate.remark) && (
            <DetailSection title="Other">
              {candidate.skills  && <div className="col-span-3"><InfoRow label="Skills"  value={candidate.skills} /></div>}
              {candidate.notes   && <div className="col-span-3"><InfoRow label="Notes"   value={candidate.notes} /></div>}
              {candidate.remark  && <div className="col-span-3"><InfoRow label="Remark"  value={candidate.remark} /></div>}
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
