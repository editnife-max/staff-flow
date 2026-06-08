import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import React, { useState, useRef, useEffect } from "react";
import {
  Search, SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp,
  ArrowUpDown, Users, User, BookOpen, Briefcase, Heart, Send,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, calcAge } from "@/lib/utils";
import { X } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { getStaffList, sendCandidatesNotification } from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/agency/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Agency Portal" }] }),
  component: AgencyCandidatesPage,
});

type Candidate = {
  id: string;
  full_name: string;
  photo_url: string | null;
  occupation: string | null;
  country: string | null;
  gender: string | null;
  dob: string | null;
  age: number | null;
  religion: string | null;
  marital_status: string | null;
  experience: string | null;
  education: string | null;
  english_level: string | null;
  arabic_level: string | null;
  medical_status: string | null;
  passport_status: string | null;
  coc_status: string | null;
  selected_by: string | null;
  cv_sent_to: string | null;
  status: string;
};


const initialFilters = {
  sort:       "newest",
  gender:     "all",
  religion:   "all",
  experience: "all",
  marital:    "all",
  ageFrom:    "",
  ageTo:      "",
};

function AgencyCandidatesPage() {
  const [search, setSearch]           = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters]         = useState(initialFilters);
  const [selected, setSelected]       = useState<Set<string>>(new Set());

  // Send-to-staff dialog
  const [sendOpen, setSendOpen]       = useState(false);
  const [staffId, setStaffId]         = useState("");
  const [message, setMessage]         = useState("");

  const fetchStaff = useServerFn(getStaffList);
  const doSend     = useServerFn(sendCandidatesNotification);

  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ["agency-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select(
          "id,full_name,photo_url,occupation,country,gender,dob,age,religion,marital_status," +
          "experience,education,english_level,arabic_level,medical_status,passport_status," +
          "coc_status,selected_by,cv_sent_to,status"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Candidate[];
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: () => fetchStaff({}),
    enabled: sendOpen,
  });

  const ageFromNum = filters.ageFrom !== "" ? Number(filters.ageFrom) : null;
  const ageToNum   = filters.ageTo   !== "" ? Number(filters.ageTo)   : null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const sync = () => {
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
      if (fadeRef.current) fadeRef.current.style.opacity = (!atEnd && el.scrollWidth > el.clientWidth) ? "1" : "0";
    };
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", sync); ro.disconnect(); };
  }, []);

  const filtered = candidates
    .filter((c) => !search || c.full_name.toLowerCase().includes(search.toLowerCase()))
    .filter((c) => filters.gender     === "all" || c.gender          === filters.gender)
    .filter((c) => filters.religion   === "all" || c.religion        === filters.religion)
    .filter((c) => filters.experience === "all" || c.experience      === filters.experience)
    .filter((c) => filters.marital    === "all" || c.marital_status  === filters.marital)
    .filter((c) => ageFromNum === null || (c.age != null && c.age >= ageFromNum))
    .filter((c) => ageToNum   === null || (c.age != null && c.age <= ageToNum))
    .sort((a, b) =>
      filters.sort === "oldest"
        ? (a as any).created_at?.localeCompare((b as any).created_at ?? "") ?? 0
        : ((b as any).created_at ?? "").localeCompare((a as any).created_at ?? "")
    );

  const activeCount = Object.entries(filters).filter(([k, v]) => k !== "sort" && v && v !== "all").length;

  function resetFilters() { setFilters(initialFilters); setSearch(""); }

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id)));
  }

  function closeSend() { setSendOpen(false); setStaffId(""); setMessage(""); }

  const sendMut = useMutation({
    mutationFn: () => doSend({
      data: { staffUserId: staffId, candidateIds: [...selected], message: message || undefined },
    }),
    onSuccess: () => {
      toast.success(`${selected.size} candidate${selected.size !== 1 ? "s" : ""} sent to staff`);
      setSelected(new Set());
      closeSend();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Candidates"
        description={`${filtered.length} candidate${filtered.length !== 1 ? "s" : ""} sent to your agency`}
      />

      {/* Filter panel */}
      <Card className="rounded-none mb-3">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-3">
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
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-7 text-xs rounded-none w-52"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              disabled={activeCount === 0 && !search}
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <FilterSelect
                value={filters.sort} onChange={(v) => setFilters({ ...filters, sort: v })}
                icon={ArrowUpDown}
                options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }]}
              />
              <FilterSelect
                placeholder="Gender" value={filters.gender} icon={User}
                onChange={(v) => setFilters({ ...filters, gender: v })}
                options={[{ value: "all", label: "-----" }, { value: "Female", label: "Female" }, { value: "Male", label: "Male" }]}
              />
              <FilterSelect
                placeholder="Religion" value={filters.religion} icon={BookOpen}
                onChange={(v) => setFilters({ ...filters, religion: v })}
                options={[{ value: "all", label: "-----" }, { value: "Muslim", label: "Muslim" }, { value: "Non-Muslim", label: "Non-Muslim" }]}
              />
              <FilterSelect
                placeholder="Experience" value={filters.experience} icon={Briefcase}
                onChange={(v) => setFilters({ ...filters, experience: v })}
                options={[{ value: "all", label: "-----" }, { value: "Experience", label: "Experience" }, { value: "Non-Experience", label: "Non-Experience" }]}
              />
              <FilterSelect
                placeholder="Marital Status" value={filters.marital} icon={Heart}
                onChange={(v) => setFilters({ ...filters, marital: v })}
                options={[{ value: "all", label: "-----" }, { value: "Single", label: "Single" }, { value: "Married", label: "Married" }]}
              />
              <div className={cn(
                "flex items-center gap-1 h-7 px-2 border rounded-none text-[13px] font-medium transition-colors",
                (filters.ageFrom || filters.ageTo)
                  ? "bg-black/10 border-black/20 text-[#181A27] dark:bg-white/10 dark:border-white/20 dark:text-white"
                  : "bg-muted/40 border-border text-muted-foreground",
              )}>
                <Users className="h-3 w-3 shrink-0" />
                <input
                  type="number"
                  placeholder="Age from"
                  value={filters.ageFrom}
                  onChange={(e) => setFilters({ ...filters, ageFrom: e.target.value })}
                  className="w-14 bg-transparent outline-none text-xs placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min={0}
                />
                <span className="text-muted-foreground">–</span>
                <input
                  type="number"
                  placeholder="Age to"
                  value={filters.ageTo}
                  onChange={(e) => setFilters({ ...filters, ageTo: e.target.value })}
                  className="w-14 bg-transparent outline-none text-xs placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min={0}
                />
                {(filters.ageFrom || filters.ageTo) && (
                  <button type="button" onClick={() => setFilters({ ...filters, ageFrom: "", ageTo: "" })}
                    className="p-0.5 text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selection toolbar */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3 mb-2 px-[5px]">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={selected.size > 0 && selected.size === filtered.length}
              onCheckedChange={toggleAll}
              aria-label="Select all"
            />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>
          {selected.size > 0 && (
            <>
              <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => setSendOpen(true)}>
                <Send className="h-3.5 w-3.5" />
                Send to Staff ({selected.size})
              </Button>
              <button type="button" onClick={() => setSelected(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground">
                Clear
              </button>
            </>
          )}
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <Card className="rounded-none"><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card className="rounded-none"><CardContent className="p-8 text-center text-sm text-muted-foreground">No candidates found.</CardContent></Card>
      ) : (
        <div className="relative">
          <div ref={scrollRef} className="overflow-x-auto">
            <div className="min-w-max space-y-2">
              {filtered.map((c) => (
                <AgencyCandidateCard
                  key={c.id}
                  candidate={c}
                  selected={selected.has(c.id)}
                  onToggle={() => toggleSelect(c.id)}
                />
              ))}
            </div>
          </div>
          <div ref={fadeRef} aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent opacity-0 transition-opacity duration-200" />
        </div>
      )}

      {/* Send to staff dialog */}
      <Dialog open={sendOpen} onOpenChange={(o) => { if (!o) closeSend(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Send to Staff</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Staff member</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff…" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.length === 0
                    ? <SelectItem value="none" disabled>No staff available</SelectItem>
                    : staffList.map((s) => (
                        <SelectItem key={s.id} value={s.user_id}>{s.name}</SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                placeholder="Add a note for the staff member…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Sending {selected.size} candidate{selected.size !== 1 ? "s" : ""}.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeSend}>Cancel</Button>
            <Button
              onClick={() => sendMut.mutate()}
              disabled={!staffId || sendMut.isPending}
            >
              {sendMut.isPending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const BADGE_COLORS: Record<string, string> = {
  Fit:           "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  Unfit:         "bg-red-100/50 text-[#181A27] dark:bg-red-900/40 dark:text-red-300",
  Booked:        "bg-blue-100/50 text-[#181A27] dark:bg-blue-900/40 dark:text-blue-300",
  "In progress": "bg-amber-100/50 text-[#181A27] dark:bg-amber-900/40 dark:text-amber-300",
  Expired:       "bg-orange-100/50 text-[#181A27] dark:bg-orange-900/40 dark:text-orange-300",
  Done:          "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
  No:            "bg-zinc-100/50 text-[#181A27] dark:bg-zinc-800 dark:text-zinc-400",
  Yes:           "bg-emerald-100/50 text-[#181A27] dark:bg-emerald-900/40 dark:text-emerald-300",
};

function AgencyCandidateCard({
  candidate: c, selected, onToggle,
}: { candidate: Candidate; selected: boolean; onToggle: () => void }) {
  type FieldDef = { label: string; value: string; bold?: boolean; badge?: boolean };
  const fields: FieldDef[] = [
    { label: "FULL NAME",  value: c.full_name,                                         bold: true },
    { label: "OCCUPATION", value: c.occupation ?? "—" },
    { label: "COUNTRY",    value: c.country ?? "—" },
    { label: "AGE",        value: String(calcAge(c.dob) ?? c.age ?? "—") },
    { label: "GENDER",     value: c.gender ?? "—" },
    { label: "RELIGION",   value: c.religion ?? "—" },
    { label: "MARITAL",    value: c.marital_status ?? "—" },
    { label: "EXPERIENCE", value: c.experience ?? "—" },
    { label: "EDUCATION",  value: c.education ?? "—" },
    { label: "ENGLISH",    value: c.english_level ?? "—" },
    { label: "ARABIC",     value: c.arabic_level ?? "—" },
    { label: "MEDICAL",    value: c.medical_status ?? "—",  badge: true },
    { label: "COC",        value: c.coc_status ?? "—",      badge: true },
    { label: "PASSPORT",   value: c.passport_status ?? "—", badge: true },
  ];

  return (
    <div className={cn(
      "bg-white border border-border shadow-sm rounded-sm transition-colors flex items-center",
      selected && "ring-1 ring-primary/50 bg-primary/5",
    )}>
      {/* Fixed left — checkbox + status badge */}
      <div
        className={cn("sticky left-0 z-10 self-stretch shrink-0 flex flex-col items-center justify-center gap-2 px-4", selected ? "bg-primary/5" : "bg-white")}
      >
        <Checkbox checked={selected} onCheckedChange={onToggle} aria-label="Select candidate" />
        <StatusBadge status={c.status} />
      </div>

      {/* Avatar */}
      <div className="shrink-0 px-4 py-3">
        <Avatar className="h-14 w-14">
          {c.photo_url && <AvatarImage src={c.photo_url} alt={c.full_name} />}
          <AvatarFallback className="text-[11px]">{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      </div>

      {/* Fields */}
      <div className="flex items-start gap-6 py-3 pr-4">
        {fields.map((f) => (
          <div key={f.label} className="shrink-0 w-[90px]">
            <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1 whitespace-nowrap">
              {f.label}
            </div>
            {f.badge && f.value && f.value !== "—" ? (
              <span className={cn(
                "text-[11px] font-semibold px-1.5 py-0.5 rounded-sm whitespace-nowrap",
                BADGE_COLORS[f.value] ?? "bg-zinc-100/50 text-[#181A27]",
              )}>
                {f.value}
              </span>
            ) : (
              <div className={cn(
                "text-sm text-foreground break-words",
                f.bold && "font-semibold",
              )}>
                {f.value}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterSelect({
  value, onChange, options, placeholder, icon: Icon,
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string; icon?: React.ElementType;
}) {
  const isReset = value === "all" || !value;
  return (
    <div className="flex items-center gap-0.5">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn(
          "border shadow-none w-auto h-7 px-2 gap-1.5 transition-colors rounded-none text-[13px] font-medium [&>svg]:shrink-0",
          isReset
            ? "bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            : "bg-black/10 border-black/20 text-[#181A27] dark:bg-white/10 dark:border-white/20 dark:text-white",
        )}>
          {Icon && <Icon className="h-3 w-3 shrink-0" />}
          {isReset ? <span>{placeholder}</span> : <SelectValue />}
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="py-1 px-2 focus:bg-muted/50">
              <span className={cn("text-[13px]", o.value === "all" ? "text-muted-foreground" : "text-[#181A27] dark:text-white")}>
                {o.label}
              </span>
            </SelectItem>
          ))}
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
