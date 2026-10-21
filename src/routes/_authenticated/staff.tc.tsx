import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, FilePlus, RotateCcw, FileText,
  ArrowUpDown, Users, User, BookOpen, Stethoscope, Briefcase, FileCheck,
  Globe, ScanSearch, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn, calcAge } from "@/lib/utils";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { StatusBadge } from "@/components/status-badge";
import { ActionDialog } from "@/components/action-dialog";
import { FilterSelect, MultiFilterSelect } from "@/components/candidates/atoms";
import { CandidateCardList, ProcessingEditDialog } from "@/components/candidates/candidate-views";
import { CandidateDetailDialog } from "@/components/candidates/dialogs";
import { FormSelect, FormInput, PhotoUpload, FormSection } from "@/components/candidates/forms";
import {
  getCandidates, upsertCandidate, updateCandidateField,
  searchCandidates, nextCandidateCode,
} from "@/lib/candidates.functions";
import type { Database } from "@/integrations/supabase/types";
import type { Candidate, Status } from "@/components/candidates/types";
import { MEDICAL_OPTIONS, COC_OPTIONS, PASSPORT_OPTIONS } from "@/components/candidates/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SKILLS_LIST = [
  "Cooking", "Cleaning", "Childcare", "Eldercare", "Ironing",
  "Driving", "Gardening", "Sewing", "Babysitting", "Pet Care", "Nursing",
];

export const Route = createFileRoute("/_authenticated/staff/tc")({
  head: () => ({ meta: [{ title: "Training Centre — Staff-Flow" }] }),
  validateSearch: z.object({
    view: z.enum(["entered", "trained"]).optional(),
  }),
  component: TcPage,
});

const VIEW_TABS = [
  { key: "entered" as const, label: "Entered Girls" },
  { key: "trained" as const, label: "Trained Girls" },
];

const initialFilters = {
  sort:       "newest",
  age:        [] as string[],
  gender:     [] as string[],
  religion:   [] as string[],
  medical:    [] as string[],
  narrative:  [] as string[],
  experience: [] as string[],
  coc:        [] as string[],
  musaned:    [] as string[],
  cv_sent_to: [] as string[],
};

const initialForm = {
  first_name: "", last_name: "",
  photo_url: "", full_photo_url: "", passport_scan_url: "",
  serial_number: "", candidate_code: "",
  gender: "", dob: "", religion: "", birth_place: "", living_town: "",
  marital_status: "", children: "" as string | number,
  education: "", occupation: "House Maid", country: "Ethiopian",
  passport_number: "", labour_id: "",
  passport_issue_date: "", passport_expiry_date: "", place_of_issue: "ADDIS ABABA",
  spoken_languages: "", english_level: "", arabic_level: "",
  experience: "", experience_country: "", experience_years: "",
  weight: "" as string | number, height: "" as string | number,
  passport_status: "", medical_status: "", coc_status: "",
  coc_agency_name: "", coc_agency_phone: "",
  musaned_status: "", status: "available" as Status, office: "", selected_by: "",
  narrative: "", narrative_phone: "",
  skills: "Ironing, Cleaning", remark: "", notes: "",
  video_url: "", lmis_id_url: "", lmis_passport_url: "",
  availability_type: "TC",
};

function TcPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { view: viewParam } = Route.useSearch();

  const activeView = viewParam ?? "entered";

  const [filters, setFilters] = useState(initialFilters);
  const [passport, setPassport] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionCandidates, setActionCandidates] = useState<Candidate[]>([]);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalQ, setGlobalQ] = useState("");
  const [globalResults, setGlobalResults] = useState<Awaited<ReturnType<typeof searchCandidates>>>([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [form, setForm] = useState(initialForm);
  const [processingEdit, setProcessingEdit] = useState<Candidate | null>(null);
  const [viewing, setViewing] = useState<Candidate | null>(null);
  const [addTrainedOpen, setAddTrainedOpen] = useState(false);
  const [trainedPickQ, setTrainedPickQ] = useState("");
  const [trainedPick, setTrainedPick] = useState<Candidate | null>(null);
  const [trainedVideoUrl, setTrainedVideoUrl] = useState("");

  const toggleSelect = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const fetchCandidates = useServerFn(getCandidates);
  const upsert          = useServerFn(upsertCandidate);
  const updateField     = useServerFn(updateCandidateField);
  const doSearch        = useServerFn(searchCandidates);
  const getNextCode     = useServerFn(nextCandidateCode);

  // ⌘K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setGlobalSearchOpen((o) => !o); }
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
      catch {}
      finally { setGlobalSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [globalQ, globalSearchOpen, doSearch]);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: allCandidates = [], isLoading: candidatesLoading } = useQuery<Candidate[]>({
    queryKey: ["staff-candidates", user?.id],
    queryFn:  () => fetchCandidates({}).then((r) => r as unknown as Candidate[]),
    enabled:  !!user,
    staleTime: 30_000,
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
      const { data, error } = await supabase
        .from("foreign_agencies").select("name, country, contact_phone").order("name");
      if (error) throw error;
      return data as { name: string; country: string; contact_phone: string | null }[];
    },
  });

  const { data: agencyOptions = [] } = useQuery({
    queryKey: ["agency-names", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("foreign_agencies").select("name").order("name");
      if (error) throw error;
      return (data ?? []).map((a) => a.name);
    },
  });

  // ── Derived ──────────────────────────────────────────────────────────────
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

  // TC candidates are marked by availability_type === "TC"; split by video presence
  const basePool = useMemo(
    () => allCandidates.filter((c) =>
      c.availability_type === "TC" &&
      (activeView === "trained" ? !!c.video_url : !c.video_url)
    ),
    [allCandidates, activeView],
  );

  const opts = useMemo(() => ({
    narrative: Array.from(new Set(basePool.map((c) => c.narrative ?? "").filter(Boolean))).sort(),
  }), [basePool]);

  const filtered = useMemo(() => {
    let list = [...basePool].sort((a, b) =>
      filters.sort === "oldest"
        ? a.created_at.localeCompare(b.created_at)
        : b.created_at.localeCompare(a.created_at),
    );

    if (passport) {
      const q = passport.toLowerCase();
      list = list.filter((c) =>
        (c.full_name ?? "").toLowerCase().includes(q) ||
        (c.labour_id ?? "").toLowerCase().includes(q) ||
        (c.passport_number ?? "").toLowerCase().includes(q) ||
        (c.candidate_code ?? "").toLowerCase().includes(q),
      );
    }
    if (filters.age.length > 0) {
      list = list.filter((c) => {
        const age = calcAge(c.dob) ?? c.age;
        if (age == null) return false;
        return filters.age.some((r) => { const [mn, mx] = r.split("-").map(Number); return age >= mn && age <= mx; });
      });
    }
    if (filters.gender.length    > 0) list = list.filter((c) => filters.gender.includes(c.gender ?? ""));
    if (filters.religion.length  > 0) list = list.filter((c) => filters.religion.includes(c.religion ?? ""));
    if (filters.medical.length   > 0) list = list.filter((c) => filters.medical.includes(c.medical_status ?? ""));
    if (filters.narrative.length > 0) list = list.filter((c) => filters.narrative.includes(c.narrative ?? ""));
    if (filters.experience.length > 0)
      list = list.filter((c) => filters.experience.includes(c.experience === "None" ? "No" : (c.experience ?? "")));
    if (filters.coc.length     > 0) list = list.filter((c) => filters.coc.includes(c.coc_status ?? ""));
    if (filters.musaned.length > 0) list = list.filter((c) => filters.musaned.includes(c.musaned_status ?? ""));
    if (filters.cv_sent_to.length > 0) list = list.filter((c) => filters.cv_sent_to.includes(c.cv_sent_to ?? ""));

    return list;
  }, [basePool, filters, passport]);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((v) => Array.isArray(v) ? v.length > 0 : false).length,
    [filters],
  );

  // ── Field mutation ───────────────────────────────────────────────────────
  const fieldMut = useMutation({
    mutationFn: async (input: { id: string; field: string; value: string | null }) =>
      updateField({ data: input as never }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["staff-candidates", user?.id] });
      const previous = qc.getQueryData<Candidate[]>(["staff-candidates", user?.id]);
      qc.setQueryData<Candidate[]>(["staff-candidates", user?.id], (old) =>
        old?.map((c) => c.id === input.id ? { ...c, [input.field]: input.value } : c) ?? [],
      );
      return { previous };
    },
    onError: (e: Error, _, ctx) => {
      if (ctx?.previous) qc.setQueryData(["staff-candidates", user?.id], ctx.previous);
      toast.error(e.message);
    },
  });

  const handleUpdateField = useCallback((id: string, field: string, value: string | null) => {
    fieldMut.mutate({ id, field, value });
    if (field === "visa_status" && value === "Arrived KSA")
      fieldMut.mutate({ id, field: "status", value: "arrived" });
    if (field === "visa_status" && value === "Visa canceled") {
      fieldMut.mutate({ id, field: "status", value: "canceled" });
      fieldMut.mutate({ id, field: "notes", value: "Visa canceled" });
    }
    const current = () => qc.getQueryData<Candidate[]>(["staff-candidates", user?.id])?.find((c) => c.id === id);
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
  }, [fieldMut, qc, user?.id]);

  // ── Upsert ───────────────────────────────────────────────────────────────
  const upsertMut = useMutation({
    mutationFn: (f: typeof initialForm) => {
      const payload = {
        ...f,
        full_name: [f.first_name, f.last_name].filter(Boolean).join(" ") || f.first_name || f.last_name || "",
        availability_type: "TC",
      };
      return upsert({ data: { id: editing?.id, data: payload as never } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-candidates"] });
      setOpen(false);
      setEditing(null);
      setForm(initialForm);
      toast.success(editing ? "Candidate updated" : "Candidate added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = async () => {
    setEditing(null);
    try {
      const result = await getNextCode({});
      setForm({ ...initialForm, candidate_code: result?.code ?? "" });
    } catch {
      setForm(initialForm);
    }
    setOpen(true);
  };

  const openEdit = (c: Candidate) => {
    setEditing(c);
    setForm({
      ...initialForm,
      first_name:           (c as any).first_name           ?? "",
      last_name:            (c as any).last_name            ?? "",
      photo_url:            c.photo_url                     ?? "",
      full_photo_url:       (c as any).full_photo_url       ?? "",
      passport_scan_url:    (c as any).passport_scan_url    ?? "",
      serial_number:        c.serial_number                 ?? "",
      candidate_code:       c.candidate_code                ?? "",
      gender:               c.gender                        ?? "",
      dob:                  c.dob                           ?? "",
      religion:             c.religion                      ?? "",
      birth_place:          c.birth_place                   ?? "",
      living_town:          c.living_town                   ?? "",
      marital_status:       c.marital_status                ?? "",
      children:             c.children                      ?? "",
      education:            c.education                     ?? "",
      occupation:           c.occupation                    ?? "House Maid",
      country:              c.country                       ?? "Ethiopian",
      passport_number:      c.passport_number               ?? "",
      labour_id:            c.labour_id                     ?? "",
      passport_issue_date:  (c as any).passport_issue_date  ?? "",
      passport_expiry_date: (c as any).passport_expiry_date ?? "",
      place_of_issue:       c.place_of_issue                ?? "ADDIS ABABA",
      spoken_languages:     c.spoken_languages              ?? "",
      english_level:        c.english_level                 ?? "",
      arabic_level:         c.arabic_level                  ?? "",
      experience:           c.experience                    ?? "",
      experience_country:   c.experience_country            ?? "",
      experience_years:     c.experience_years              ?? "",
      weight:               c.weight                        ?? "",
      height:               c.height                        ?? "",
      passport_status:      c.passport_status               ?? "",
      medical_status:       c.medical_status                ?? "",
      coc_status:           c.coc_status                    ?? "",
      coc_agency_name:      (c as any).coc_agency_name      ?? "",
      coc_agency_phone:     (c as any).coc_agency_phone     ?? "",
      musaned_status:       c.musaned_status                ?? "",
      status:               c.status                         as Status,
      office:               c.office                        ?? "",
      selected_by:          c.selected_by                   ?? "",
      narrative:            c.narrative                     ?? "",
      narrative_phone:      c.narrative_phone               ?? "",
      skills:               c.skills                        ?? "",
      remark:               c.remark                        ?? "",
      notes:                c.notes                         ?? "",
      video_url:            c.video_url                     ?? "",
      lmis_id_url:          (c as any).lmis_id_url           ?? "",
      lmis_passport_url:    (c as any).lmis_passport_url     ?? "",
      availability_type:    "TC",
    });
    setOpen(true);
  };

  const closeForm = () => { setOpen(false); setEditing(null); setForm(initialForm); };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 px-6 py-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Training Centre</h1>
        <div className="flex items-center gap-2">
          {activeView === "entered" && (
            <Button size="sm" className="gap-2 text-xs h-8 rounded-none" onClick={openCreate}>
              <FilePlus className="h-4 w-4" /> ADD NEW CANDIDATE
            </Button>
          )}
          <Button
            size="sm" variant="outline"
            className="gap-1.5 text-xs h-8 rounded-none"
            onClick={() => setGlobalSearchOpen(true)}
          >
            <ScanSearch className="h-3.5 w-3.5" />
            Search
            <kbd className="ml-1 text-[10px] bg-muted px-1 py-0.5 rounded font-mono">⌘K</kbd>
          </Button>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 border-b">
        {VIEW_TABS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => {
              setSelected(new Set());
              navigate({ to: "/staff/tc", search: { view: v.key }, replace: true });
            }}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeView === v.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Global search */}
      <Dialog
        open={globalSearchOpen}
        onOpenChange={(o) => { setGlobalSearchOpen(o); if (!o) { setGlobalQ(""); setGlobalResults([]); } }}
      >
        <DialogContent
          className="p-0 max-w-lg overflow-hidden [&>button:last-child]:hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false} className="rounded-lg">
            <CommandInput
              placeholder="Search name, passport, code, labour ID…"
              value={globalQ} onValueChange={setGlobalQ} autoFocus
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
                    <CommandItem key={r.id} value={r.id}
                      onSelect={() => setGlobalSearchOpen(false)}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        {r.photo_url && <AvatarImage src={r.photo_url} />}
                        <AvatarFallback className="text-[10px]">{(r.full_name ?? "?")[0]}</AvatarFallback>
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

      {/* Filter panel */}
      <Card className="rounded-none">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <span className="rounded-none bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                {activeFilterCount}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-5">
            <FilterSelect value={filters.sort} onChange={(v) => setFilters({ ...filters, sort: v })}
              icon={ArrowUpDown}
              options={[{ value: "newest", label: "Date (Newest)" }, { value: "oldest", label: "Date (Oldest)" }]} />
            <MultiFilterSelect placeholder="Age" values={filters.age} icon={Users}
              onChange={(v) => setFilters({ ...filters, age: v })}
              options={[
                { value: "18-25", label: "18-25" }, { value: "26-35", label: "26-35" },
                { value: "36-45", label: "36-45" }, { value: "46-99", label: "46+" },
              ]} />
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
              options={[{ value: "", label: "Not Selected" }, ...["Done","No","Booked","Placed","Yitazez","Pending release"].map((o) => ({ value: o, label: o }))]} />
            <MultiFilterSelect placeholder="Country" values={filters.musaned} icon={Globe}
              onChange={(v) => setFilters({ ...filters, musaned: v })}
              options={[{ value: "", label: "Not Selected" }, ...assignCountries.map((c) => ({ value: c.name, label: c.name }))]} />
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
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
              candidate{filtered.length !== 1 ? "s" : ""} found
            </span>
            <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs font-bold text-black"
              onClick={() => { setFilters(initialFilters); setPassport(""); }}
              disabled={activeFilterCount === 0 && !passport}
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Candidate list with country tabs */}
      {candidatesLoading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
      ) : (
        <CandidateCardList
          key={activeView}
          pageKey={`tc-${activeView}`}
          candidates={filtered}
          selected={selected}
          onToggleSelect={toggleSelect}
          onView={(c) => setViewing(c)}
          onAction={(c) => setActionCandidates([c])}
          onEdit={(c) => c.status === "processing" ? setProcessingEdit(c) : openEdit(c)}
          onDelete={(id) => fieldMut.mutate({ id, field: "status", value: "canceled" })}
          onUpdateField={handleUpdateField}
          countryMeta={countryMeta}
          officesByCountry={officesByCountry}
          agencyOptions={agencyOptions}
          agencyPhones={agencyPhones}
          narrativeSuggestions={opts.narrative}
        />
      )}

      {/* Processing edit */}
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

      {/* Action dialog */}
      {actionCandidates.length > 0 && (
        <ActionDialog
          candidates={actionCandidates}
          onClose={() => { setActionCandidates([]); setSelected(new Set()); }}
        />
      )}

      {/* Detail view */}
      <CandidateDetailDialog
        candidate={viewing}
        onClose={() => setViewing(null)}
        agencyPhones={agencyPhones}
      />

      {/* Add to Trained dialog */}
      <Dialog open={addTrainedOpen} onOpenChange={(o) => { if (!o) { setAddTrainedOpen(false); setTrainedPick(null); setTrainedPickQ(""); setTrainedVideoUrl(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Girl to Trained</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Select from Entered Girls</p>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 text-xs rounded-none"
                  placeholder="Search name, code, passport…"
                  value={trainedPickQ}
                  onChange={(e) => setTrainedPickQ(e.target.value)}
                />
              </div>
              <div className="border rounded-none max-h-52 overflow-y-auto">
                {(() => {
                  const enteredGirls = allCandidates.filter((c) => c.availability_type === "TC" && !c.video_url);
                  const q = trainedPickQ.toLowerCase();
                  const visible = enteredGirls.filter((c) =>
                    !q ||
                    (c.full_name ?? "").toLowerCase().includes(q) ||
                    (c.candidate_code ?? "").toLowerCase().includes(q) ||
                    (c.passport_number ?? "").toLowerCase().includes(q) ||
                    (c.labour_id ?? "").toLowerCase().includes(q),
                  );
                  if (visible.length === 0)
                    return <p className="text-xs text-muted-foreground text-center py-6">No entered girls found</p>;
                  return visible.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setTrainedPick(c)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted transition-colors",
                        trainedPick?.id === c.id && "bg-primary/10 font-medium",
                      )}
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        {c.photo_url && <AvatarImage src={c.photo_url} />}
                        <AvatarFallback className="text-[10px]">{(c.full_name ?? "?")[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm">{c.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[c.candidate_code, c.country].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </button>
                  ));
                })()}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-1">Training Video URL</p>
              <Input
                className="h-8 text-xs rounded-none"
                placeholder="https://…"
                value={trainedVideoUrl}
                onChange={(e) => setTrainedVideoUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddTrainedOpen(false)}>Cancel</Button>
            <Button
              disabled={!trainedPick || !trainedVideoUrl.trim()}
              onClick={() => {
                if (!trainedPick) return;
                handleUpdateField(trainedPick.id, "video_url", trainedVideoUrl.trim());
                toast.success(`${trainedPick.full_name ?? "Candidate"} moved to Trained Girls`);
                setAddTrainedOpen(false);
                setTrainedPick(null);
                setTrainedPickQ("");
                setTrainedVideoUrl("");
              }}
            >
              Move to Trained
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) closeForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Candidate" : "Add New Candidate"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Photos */}
            <div className="flex gap-4 flex-wrap">
              <PhotoUpload label="Profile Photo" value={form.photo_url}         onChange={(url) => setForm({ ...form, photo_url: url })} />
              <PhotoUpload label="Full Photo"    value={form.full_photo_url}     onChange={(url) => setForm({ ...form, full_photo_url: url })} />
              <PhotoUpload label="Passport Scan" value={form.passport_scan_url}  onChange={(url) => setForm({ ...form, passport_scan_url: url })} accept="image/*,application/pdf" />
              <PhotoUpload label="ID Card"       value={form.lmis_id_url}        onChange={(url) => setForm({ ...form, lmis_id_url: url })}        accept="image/*,application/pdf" />
              <PhotoUpload label="Passport PDF"  value={form.lmis_passport_url}  onChange={(url) => setForm({ ...form, lmis_passport_url: url })}  accept="image/*,application/pdf" />
            </div>

            {/* Names & IDs */}
            <FormSection title="Names & IDs" required>
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="First Name *"   value={form.first_name}     onChange={(v) => setForm({ ...form, first_name: v })} />
                <FormInput label="Last Name *"    value={form.last_name}      onChange={(v) => setForm({ ...form, last_name: v })} />
                <FormInput label="Candidate Code" value={form.candidate_code} onChange={(v) => setForm({ ...form, candidate_code: v })} />
                <FormInput label="Serial Number"  value={form.serial_number}  onChange={(v) => setForm({ ...form, serial_number: v })} />
              </div>
            </FormSection>

            {/* Personal */}
            <FormSection title="Personal" required>
              <div className="grid grid-cols-2 gap-3">
                <FormSelect label="Gender *"        value={form.gender}         onChange={(v) => setForm({ ...form, gender: v })}         options={["Female", "Male"]} />
                <FormInput  label="Date of Birth *" value={form.dob}            onChange={(v) => setForm({ ...form, dob: v })}            type="date" />
                <FormSelect label="Religion *"      value={form.religion}       onChange={(v) => setForm({ ...form, religion: v })}       options={["Muslim", "Non-muslim"]} />
                <FormInput  label="Birth Place *"   value={form.birth_place}    onChange={(v) => setForm({ ...form, birth_place: v })} />
                <FormInput  label="Living Town *"   value={form.living_town}    onChange={(v) => setForm({ ...form, living_town: v })} />
                <FormSelect label="Marital Status *" value={form.marital_status} onChange={(v) => setForm({ ...form, marital_status: v })} options={["Single", "Married", "Divorced", "Widowed"]} />
                <FormInput  label="Children"        value={String(form.children)} onChange={(v) => setForm({ ...form, children: v })}   type="number" />
                <FormSelect label="Education *"     value={form.education}      onChange={(v) => setForm({ ...form, education: v })}      options={["Illiterate", "Primary", "Secondary", "High School", "Diploma", "Degree", "Master's", "PhD"]} />
              </div>
            </FormSection>

            {/* Passport */}
            <FormSection title="Passport" required>
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Passport Number *" value={form.passport_number}      onChange={(v) => setForm({ ...form, passport_number: v })} />
                <FormInput label="Labour ID *"        value={form.labour_id}            onChange={(v) => setForm({ ...form, labour_id: v.toUpperCase() })} placeholder="EF/EM + 8 chars" />
                <FormInput label="Issue Date *"       value={form.passport_issue_date}  onChange={(v) => setForm({ ...form, passport_issue_date: v })}  type="date" />
                <FormInput label="Expiry Date *"      value={form.passport_expiry_date} onChange={(v) => setForm({ ...form, passport_expiry_date: v })} type="date" />
                <div className="col-span-2">
                  <FormInput label="Place of Issue"   value={form.place_of_issue}       onChange={(v) => setForm({ ...form, place_of_issue: v })} />
                </div>
              </div>
            </FormSection>

            {/* Languages & Experience */}
            <FormSection title="Languages & Experience">
              <div className="grid grid-cols-2 gap-3">
                <FormSelect label="English Level"    value={form.english_level}  onChange={(v) => setForm({ ...form, english_level: v })}  options={["Poor", "Little", "Fair", "Good"]} />
                <FormSelect label="Arabic Level"     value={form.arabic_level}   onChange={(v) => setForm({ ...form, arabic_level: v })}   options={["Poor", "Little", "Fair", "Good"]} />
                <FormSelect label="Work Experience *" value={form.experience}    onChange={(v) => setForm({ ...form, experience: v, experience_country: v !== "Yes" ? "" : form.experience_country, experience_years: v !== "Yes" ? "" : form.experience_years })} options={["Yes", "No"]} />
              </div>
              {form.experience === "Yes" && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <FormSelect label="Experience Country" value={form.experience_country} onChange={(v) => setForm({ ...form, experience_country: v })} options={assignCountries.map((c) => c.name)} />
                  <FormInput  label="Years of Experience" value={form.experience_years}  onChange={(v) => setForm({ ...form, experience_years: v })} type="number" />
                </div>
              )}
            </FormSection>

            {/* Physical */}
            <FormSection title="Physical">
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Weight (kg)" value={String(form.weight)} onChange={(v) => setForm({ ...form, weight: v })} type="number" />
                <FormInput label="Height (cm)" value={String(form.height)} onChange={(v) => setForm({ ...form, height: v })} type="number" />
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
                        <label key={skill} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-none border cursor-pointer text-xs transition-colors", checked ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50")}>
                          <Checkbox checked={checked} onCheckedChange={(v) => { const s = new Set(skillSet); v ? s.add(skill) : s.delete(skill); setForm({ ...form, skills: Array.from(s).join(", ") }); }} />
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
                <FormSelect label="Medical Status *"  value={form.medical_status}  onChange={(v) => setForm({ ...form, medical_status: v })}  options={MEDICAL_OPTIONS} />
                <div>
                  <FormSelect label="COC Status *" value={form.coc_status} onChange={(v) => setForm({ ...form, coc_status: v })} options={COC_OPTIONS} />
                  {form.coc_status === "Placed" && (
                    <div className="mt-2 space-y-1.5">
                      <input placeholder="Agency Name" value={form.coc_agency_name} onChange={(e) => setForm({ ...form, coc_agency_name: e.target.value })} className="w-full rounded-none border border-input bg-background px-3 h-8 text-xs outline-none focus:ring-1 focus:ring-ring" />
                      <input placeholder="Phone Number" value={form.coc_agency_phone} onChange={(e) => setForm({ ...form, coc_agency_phone: e.target.value })} className="w-full rounded-none border border-input bg-background px-3 h-8 text-xs outline-none focus:ring-1 focus:ring-ring" />
                    </div>
                  )}
                </div>
                <FormSelect label="Country *" value={form.musaned_status} onChange={(v) => setForm({ ...form, musaned_status: v })} options={assignCountries.map((c) => c.name)} />
              </div>
            </FormSection>

            {/* Narrative */}
            <FormSection title="Narrative">
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Narrative"       value={form.narrative}       onChange={(v) => setForm({ ...form, narrative: v })}       suggestions={opts.narrative} />
                <FormInput label="Narrative Phone" value={form.narrative_phone} onChange={(v) => setForm({ ...form, narrative_phone: v })} />
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
                  <input type="url" value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://…" className="w-full rounded-none border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
                </div>
              </div>
            </FormSection>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeForm}>Cancel</Button>
            <Button
              disabled={upsertMut.isPending}
              onClick={() => {
                if (!form.first_name?.trim() && !form.last_name?.trim()) { toast.error("First Name or Last Name is required"); return; }
                if (!form.gender || !form.dob || !form.religion) { toast.error("Gender, Date of Birth and Religion are required"); return; }
                if (!form.birth_place?.trim() || !form.living_town?.trim()) { toast.error("Birth Place and Living Town are required"); return; }
                if (!form.marital_status || !form.education) { toast.error("Marital Status and Education are required"); return; }
                if (!form.passport_number?.trim() || !form.passport_expiry_date) { toast.error("Passport Number and Expiry Date are required"); return; }
                if (!form.labour_id?.trim() || !form.passport_issue_date) { toast.error("Labour ID and Issue Date are required"); return; }
                if (!/^(EF|EM)[A-Z0-9]{8}$/i.test(form.labour_id.trim())) { toast.error("Labour ID must be 10 characters starting with EF or EM followed by 8 characters"); return; }
                if (!form.experience) { toast.error("Work Experience is required"); return; }
                if (!form.passport_status || !form.medical_status || !form.coc_status || !form.musaned_status) { toast.error("Passport Status, Medical Status, COC Status and Country are required"); return; }
                upsertMut.mutate(form);
              }}
            >
              {upsertMut.isPending ? "Saving…" : editing ? "Save Changes" : "Add Candidate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
