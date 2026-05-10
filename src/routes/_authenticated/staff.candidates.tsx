import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Search, FileText, Pencil, Trash2, FileSignature, Files,
  Briefcase, GraduationCap, Users, Calendar, Wrench, HeartHandshake, Circle, BookOpen,
  Columns3, Download, UserCheck, X,
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuCheckboxItem, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import {
  upsertCandidate, deleteCandidate,
  bulkDeleteCandidates, bulkUpdateStatus, bulkAssignStaff,
} from "@/lib/candidates.functions";

type Status = Database["public"]["Enums"]["candidate_status"];
type Candidate = Database["public"]["Tables"]["candidates"]["Row"];

export const Route = createFileRoute("/_authenticated/staff/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Staff-Flow" }] }),
  component: StaffCandidatesPage,
});

const TABS: { key: Status; label: string }[] = [
  { key: "available", label: "Available" },
  { key: "processing", label: "Processing" },
  { key: "arrived", label: "Arrived" },
];

type ColKey =
  | "photo" | "candidate_code" | "full_name" | "gender" | "religion" | "marital_status"
  | "birth_place" | "living_town" | "occupation" | "passport_number" | "labour_id"
  | "office" | "passport_status" | "coc_status" | "musaned_status" | "medical_status"
  | "medical_date" | "status" | "selected_by" | "cv_sent_to" | "cv_sent_date"
  | "narrative" | "notes" | "created_at";

const COLUMNS: { key: ColKey; label: string; render: (c: Candidate) => React.ReactNode; csv: (c: Candidate) => string }[] = [
  { key: "photo", label: "Photo",
    render: (c) => (
      <Avatar className="h-9 w-9">
        {c.photo_url && <AvatarImage src={c.photo_url} alt={c.full_name} />}
        <AvatarFallback>{c.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
    ),
    csv: (c) => c.photo_url ?? "" },
  { key: "candidate_code", label: "Code", render: (c) => c.candidate_code ?? "—", csv: (c) => c.candidate_code ?? "" },
  { key: "full_name", label: "Full Name", render: (c) => <span className="font-medium">{c.full_name}</span>, csv: (c) => c.full_name },
  { key: "gender", label: "Gender", render: (c) => c.gender ?? "—", csv: (c) => c.gender ?? "" },
  { key: "religion", label: "Religion", render: (c) => c.religion ?? "—", csv: (c) => c.religion ?? "" },
  { key: "marital_status", label: "Marital", render: (c) => c.marital_status ?? "—", csv: (c) => c.marital_status ?? "" },
  { key: "birth_place", label: "Birth Place", render: (c) => c.birth_place ?? "—", csv: (c) => c.birth_place ?? "" },
  { key: "living_town", label: "Living Town", render: (c) => c.living_town ?? "—", csv: (c) => c.living_town ?? "" },
  { key: "occupation", label: "Occupation", render: (c) => c.occupation ?? "—", csv: (c) => c.occupation ?? "" },
  { key: "passport_number", label: "Passport #", render: (c) => c.passport_number ?? "—", csv: (c) => c.passport_number ?? "" },
  { key: "labour_id", label: "Labour ID", render: (c) => c.labour_id ?? "—", csv: (c) => c.labour_id ?? "" },
  { key: "office", label: "Office", render: (c) => c.office ?? "—", csv: (c) => c.office ?? "" },
  { key: "passport_status", label: "Passport Status", render: (c) => <StatusPill v={c.passport_status} />, csv: (c) => c.passport_status },
  { key: "coc_status", label: "COC", render: (c) => <StatusPill v={c.coc_status} />, csv: (c) => c.coc_status },
  { key: "musaned_status", label: "Musaned", render: (c) => <StatusPill v={c.musaned_status} />, csv: (c) => c.musaned_status },
  { key: "medical_status", label: "Medical", render: (c) => <StatusPill v={c.medical_status} />, csv: (c) => c.medical_status },
  { key: "medical_date", label: "Medical Date", render: (c) => fmtDate(c.medical_date), csv: (c) => c.medical_date ?? "" },
  { key: "status", label: "Availability",
    render: (c) => <StatusPill v={c.status} tone="primary" />,
    csv: (c) => c.status },
  { key: "selected_by", label: "Selected By", render: (c) => c.selected_by ?? "—", csv: (c) => c.selected_by ?? "" },
  { key: "cv_sent_to", label: "CV Sent To", render: (c) => c.cv_sent_to ?? "—", csv: (c) => c.cv_sent_to ?? "" },
  { key: "cv_sent_date", label: "CV Sent Date", render: (c) => fmtDate(c.cv_sent_date), csv: (c) => c.cv_sent_date ?? "" },
  { key: "narrative", label: "Narrative", render: (c) => <Trunc t={c.narrative} />, csv: (c) => c.narrative ?? "" },
  { key: "notes", label: "Notes", render: (c) => <Trunc t={c.notes} />, csv: (c) => c.notes ?? "" },
  { key: "created_at", label: "Created", render: (c) => new Date(c.created_at).toLocaleDateString(), csv: (c) => c.created_at },
];

const DEFAULT_VISIBLE: ColKey[] = [
  "photo", "candidate_code", "full_name", "occupation", "passport_number",
  "office", "passport_status", "musaned_status", "medical_status", "status", "created_at",
];

const initialForm = {
  full_name: "", serial_number: "", passport_number: "", dob: "",
  occupation: "", country: "", age: "" as string | number,
  gender: "", religion: "", marital_status: "", education: "", skills: "",
  status: "available" as Status, photo_url: "",
  birth_place: "", living_town: "", labour_id: "",
  office: "" as "" | Database["public"]["Enums"]["office_name"],
  passport_status: "pending" as Database["public"]["Enums"]["passport_status"],
  coc_status: "pending" as Database["public"]["Enums"]["doc_status"],
  musaned_status: "pending" as Database["public"]["Enums"]["doc_status"],
  medical_status: "pending" as Database["public"]["Enums"]["medical_status"],
  medical_date: "", selected_by: "", cv_sent_to: "", cv_sent_date: "",
  narrative: "", notes: "",
};

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
  const [search, setSearch] = useState("");
  const [passport, setPassport] = useState("");
  const [filters, setFilters] = useState({
    sort: "newest", job: "all", skill: "all", education: "all",
    age: "all", marital: "all", gender: "all", religion: "all",
    from: "", to: "",
  });
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(DEFAULT_VISIBLE));
  const toggleCol = (k: ColKey) =>
    setVisibleCols((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [form, setForm] = useState(initialForm);
  const [confirm, setConfirm] = useState<{ ids: string[] } | null>(null);

  const { data: candidates = [] } = useQuery({
    queryKey: ["staff-candidates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .is("deleted_at", null);
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

  const counts = useMemo(() => {
    const c: Record<string, number> = { available: 0, processing: 0, arrived: 0 };
    candidates.forEach((x) => { c[x.status] = (c[x.status] ?? 0) + 1; });
    return c;
  }, [candidates]);

  const opts = useMemo(() => {
    const uniq = (k: keyof Candidate) =>
      Array.from(new Set(candidates.map((c) => (c[k] as string | null) ?? "").filter(Boolean))).sort();
    return {
      job: uniq("occupation"), skill: uniq("skills"), education: uniq("education"),
      marital: uniq("marital_status"), gender: uniq("gender"), religion: uniq("religion"),
    };
  }, [candidates]);

  const filtered = useMemo(() => {
    let list = candidates.filter((c) => c.status === tab);
    if (search) list = list.filter((c) => c.full_name.toLowerCase().includes(search.toLowerCase()));
    if (passport) list = list.filter((c) => (c.passport_number ?? "").toLowerCase().includes(passport.toLowerCase()));
    if (filters.job !== "all") list = list.filter((c) => c.occupation === filters.job);
    if (filters.skill !== "all") list = list.filter((c) => c.skills === filters.skill);
    if (filters.education !== "all") list = list.filter((c) => c.education === filters.education);
    if (filters.marital !== "all") list = list.filter((c) => c.marital_status === filters.marital);
    if (filters.gender !== "all") list = list.filter((c) => c.gender === filters.gender);
    if (filters.religion !== "all") list = list.filter((c) => c.religion === filters.religion);
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
  }, [candidates, tab, search, passport, filters]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        age: form.age === "" ? null : Number(form.age),
        dob: form.dob || null,
        photo_url: form.photo_url || null,
        office: form.office === "" ? null : form.office,
        medical_date: form.medical_date || null,
        cv_sent_date: form.cv_sent_date || null,
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
      toast.success("Candidate moved to trash");
      qc.invalidateQueries({ queryKey: ["staff-candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => bulkDel({ data: { ids } }),
    onSuccess: (r) => {
      toast.success(`Moved ${r.count} candidate(s) to trash`);
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

  const openCreate = () => { setEditing(null); setForm({ ...initialForm, status: tab }); setOpen(true); };
  const openEdit = (c: Candidate) => {
    setEditing(c);
    setForm({
      full_name: c.full_name, serial_number: c.serial_number ?? "", passport_number: c.passport_number ?? "",
      dob: c.dob ?? "", occupation: c.occupation ?? "", country: c.country ?? "",
      age: c.age ?? "", gender: c.gender ?? "", religion: c.religion ?? "",
      marital_status: c.marital_status ?? "", education: c.education ?? "",
      skills: c.skills ?? "", status: c.status, photo_url: c.photo_url ?? "",
      birth_place: c.birth_place ?? "", living_town: c.living_town ?? "", labour_id: c.labour_id ?? "",
      office: (c.office ?? "") as typeof initialForm.office,
      passport_status: c.passport_status, coc_status: c.coc_status,
      musaned_status: c.musaned_status, medical_status: c.medical_status,
      medical_date: c.medical_date ?? "", selected_by: c.selected_by ?? "",
      cv_sent_to: c.cv_sent_to ?? "", cv_sent_date: c.cv_sent_date ?? "",
      narrative: c.narrative ?? "", notes: c.notes ?? "",
    });
    setOpen(true);
  };

  const visibleColList = COLUMNS.filter((c) => visibleCols.has(c.key));

  const exportCSV = (rows: Candidate[]) => {
    if (rows.length === 0) { toast.error("Nothing to export"); return; }
    const cols = visibleColList;
    const header = cols.map((c) => csvCell(c.label)).join(",");
    const body = rows.map((r) => cols.map((c) => csvCell(c.csv(r))).join(",")).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `candidates_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} row(s)`);
  };

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const someSelected = !allSelected && filtered.some((c) => selected.has(c.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Candidates</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="lg" className="gap-2">
                <Columns3 className="h-4 w-4" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[400px] overflow-y-auto">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMNS.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.key} checked={visibleCols.has(c.key)}
                  onCheckedChange={() => toggleCol(c.key)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="lg" className="gap-2">
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={selected.size === 0}
                onClick={() => exportCSV(filtered.filter((c) => selected.has(c.id)))}
              >
                Selected ({selected.size})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportCSV(filtered)}>
                All filtered ({filtered.length})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="lg" variant="secondary" className="gap-2"
            disabled={selected.size === 0}
            onClick={() => {
              const first = Array.from(selected)[0];
              if (first) navigate({ to: "/staff/cv-generator", search: { id: first } });
            }}
          >
            <FileSignature className="h-5 w-5" />
            GENERATE CV{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
          <Button
            size="lg" onClick={openCreate}
            className="gap-2 bg-[#5cb8c4] hover:bg-[#4ea8b4] text-white font-semibold tracking-wide rounded-md px-6 shadow-sm"
          >
            <Files className="h-5 w-5" /> ADD NEW CANDIDATE
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <FilterSelect icon={Calendar} value={filters.sort} onChange={(v) => setFilters({ ...filters, sort: v })}
              options={[{ value: "newest", label: "Date (Newest)" }, { value: "oldest", label: "Date (Oldest)" }]} />
            <FilterSelect icon={Briefcase} placeholder="Job" value={filters.job}
              onChange={(v) => setFilters({ ...filters, job: v })}
              options={[{ value: "all", label: "All Jobs" }, ...opts.job.map((o) => ({ value: o, label: o }))]} />
            <FilterSelect icon={Wrench} placeholder="Skill" value={filters.skill}
              onChange={(v) => setFilters({ ...filters, skill: v })}
              options={[{ value: "all", label: "All Skills" }, ...opts.skill.map((o) => ({ value: o, label: o }))]} />
            <FilterSelect icon={GraduationCap} placeholder="Education level" value={filters.education}
              onChange={(v) => setFilters({ ...filters, education: v })}
              options={[{ value: "all", label: "All Education" }, ...opts.education.map((o) => ({ value: o, label: o }))]} />
            <FilterSelect icon={Users} placeholder="Age" value={filters.age}
              onChange={(v) => setFilters({ ...filters, age: v })}
              options={[
                { value: "all", label: "All Ages" },
                { value: "18-25", label: "18-25" }, { value: "26-35", label: "26-35" },
                { value: "36-45", label: "36-45" }, { value: "46-99", label: "46+" },
              ]} />
            <FilterSelect icon={HeartHandshake} placeholder="Marital Status" value={filters.marital}
              onChange={(v) => setFilters({ ...filters, marital: v })}
              options={[{ value: "all", label: "All" }, ...opts.marital.map((o) => ({ value: o, label: o }))]} />
            <FilterSelect icon={Circle} placeholder="Gender" value={filters.gender}
              onChange={(v) => setFilters({ ...filters, gender: v })}
              options={[{ value: "all", label: "All" }, ...opts.gender.map((o) => ({ value: o, label: o }))]} />
            <FilterSelect icon={BookOpen} placeholder="Religion" value={filters.religion}
              onChange={(v) => setFilters({ ...filters, religion: v })}
              options={[{ value: "all", label: "All" }, ...opts.religion.map((o) => ({ value: o, label: o }))]} />
            <DateField label="From Date" value={filters.from} onChange={(v) => setFilters({ ...filters, from: v })} />
            <DateField label="To Date" value={filters.to} onChange={(v) => setFilters({ ...filters, to: v })} />
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <div className="relative w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Passport Number" value={passport} onChange={(e) => setPassport(e.target.value)} />
            </div>
            <div className="relative w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Laborer Name" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status tabs */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-8 border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "pb-3 text-base font-medium transition-colors",
                  tab === t.key
                    ? "text-primary border-b-2 border-primary -mb-px"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label} <span className="ml-1 text-xs opacity-70">({counts[t.key] ?? 0})</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold pl-1">{selected.size} selected</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Select onValueChange={(v) => bulkStatusMut.mutate(v as Status)}>
                <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Update status..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="arrived">Arrived</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
              <Select onValueChange={(v) => bulkAssignMut.mutate(v === "__none__" ? null : v)}>
                <SelectTrigger className="h-9 w-[200px]">
                  <UserCheck className="h-4 w-4 mr-1 text-primary" />
                  <SelectValue placeholder="Assign to staff..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Unassign —</SelectItem>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm" variant="destructive" className="gap-1"
                disabled={bulkDeleteMut.isPending}
                onClick={() => setConfirm({ ids: Array.from(selected) })}
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

      {/* Spreadsheet */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="w-10 p-2 border-b border-border">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => {
                      setSelected((prev) => {
                        const n = new Set(prev);
                        if (v) filtered.forEach((c) => n.add(c.id));
                        else filtered.forEach((c) => n.delete(c.id));
                        return n;
                      });
                    }}
                  />
                </th>
                {visibleColList.map((c) => (
                  <th key={c.key} className="text-left p-2 border-b border-border font-semibold whitespace-nowrap text-xs uppercase tracking-wide text-muted-foreground">
                    {c.label}
                  </th>
                ))}
                <th className="p-2 border-b border-border w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className={cn("border-b border-border hover:bg-muted/30", selected.has(c.id) && "bg-primary/5")}>
                  <td className="p-2">
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                  </td>
                  {visibleColList.map((col) => (
                    <td key={col.key} className="p-2 whitespace-nowrap">{col.render(c)}</td>
                  ))}
                  <td className="p-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                        <Link to="/staff/cv-generator" search={{ id: c.id }}>
                          <FileText className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => setConfirm({ ids: [c.id] })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={visibleColList.length + 2} className="p-12 text-center text-muted-foreground">
                    No candidates here yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit candidate" : "Add new candidate"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto pr-1">
            <Field label="Full Name *" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
            <Field label="Serial Number" value={form.serial_number} onChange={(v) => setForm({ ...form, serial_number: v })} />
            <Field label="Passport Number" value={form.passport_number} onChange={(v) => setForm({ ...form, passport_number: v })} />
            <Field label="Labour ID" value={form.labour_id} onChange={(v) => setForm({ ...form, labour_id: v })} />
            <Field label="Date of Birth" type="date" value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} />
            <Field label="Age" type="number" value={String(form.age)} onChange={(v) => setForm({ ...form, age: v })} />
            <Field label="Gender" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} />
            <Field label="Religion" value={form.religion} onChange={(v) => setForm({ ...form, religion: v })} />
            <Field label="Marital Status" value={form.marital_status} onChange={(v) => setForm({ ...form, marital_status: v })} />
            <Field label="Birth Place" value={form.birth_place} onChange={(v) => setForm({ ...form, birth_place: v })} />
            <Field label="Living Town" value={form.living_town} onChange={(v) => setForm({ ...form, living_town: v })} />
            <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
            <Field label="Occupation" value={form.occupation} onChange={(v) => setForm({ ...form, occupation: v })} />
            <Field label="Education" value={form.education} onChange={(v) => setForm({ ...form, education: v })} />
            <Field label="Skills" value={form.skills} onChange={(v) => setForm({ ...form, skills: v })} />
            <Field label="Photo URL" value={form.photo_url} onChange={(v) => setForm({ ...form, photo_url: v })} />

            <SelectField label="Office" value={form.office || "__none__"}
              onChange={(v) => setForm({ ...form, office: (v === "__none__" ? "" : v) as typeof form.office })}
              options={[{ value: "__none__", label: "—" },
                ...["saudi","kuwait","uae","qatar","bahrain","oman","other"].map((o) => ({ value: o, label: o.toUpperCase() }))]} />

            <SelectField label="Availability" value={form.status}
              onChange={(v) => setForm({ ...form, status: v as Status })}
              options={[
                { value: "available", label: "Available" }, { value: "processing", label: "Processing" },
                { value: "arrived", label: "Arrived" }, { value: "canceled", label: "Canceled" },
              ]} />
            <SelectField label="Passport Status" value={form.passport_status}
              onChange={(v) => setForm({ ...form, passport_status: v as typeof form.passport_status })}
              options={["pending","submitted","received","expired"].map((o) => ({ value: o, label: o }))} />
            <SelectField label="COC Status" value={form.coc_status}
              onChange={(v) => setForm({ ...form, coc_status: v as typeof form.coc_status })}
              options={["pending","in_progress","done","rejected"].map((o) => ({ value: o, label: o }))} />
            <SelectField label="Musaned Status" value={form.musaned_status}
              onChange={(v) => setForm({ ...form, musaned_status: v as typeof form.musaned_status })}
              options={["pending","in_progress","done","rejected"].map((o) => ({ value: o, label: o }))} />
            <SelectField label="Medical Status" value={form.medical_status}
              onChange={(v) => setForm({ ...form, medical_status: v as typeof form.medical_status })}
              options={["pending","fit","unfit"].map((o) => ({ value: o, label: o }))} />
            <Field label="Medical Date" type="date" value={form.medical_date} onChange={(v) => setForm({ ...form, medical_date: v })} />
            <Field label="Selected By" value={form.selected_by} onChange={(v) => setForm({ ...form, selected_by: v })} />
            <Field label="CV Sent To" value={form.cv_sent_to} onChange={(v) => setForm({ ...form, cv_sent_to: v })} />
            <Field label="CV Sent Date" type="date" value={form.cv_sent_date} onChange={(v) => setForm({ ...form, cv_sent_date: v })} />

            <div className="col-span-2 space-y-2">
              <Label>Narrative</Label>
              <Textarea rows={3} value={form.narrative} onChange={(e) => setForm({ ...form, narrative: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!form.full_name || saveMut.isPending}>
              {saveMut.isPending ? "Saving..." : editing ? "Save changes" : "Add candidate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm soft-delete */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {confirm?.ids.length} candidate(s)?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            They will be moved to trash and hidden from this list. You can restore them later.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirm) return;
                if (confirm.ids.length === 1) removeMut.mutate(confirm.ids[0]);
                else bulkDeleteMut.mutate(confirm.ids);
                setConfirm(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function csvCell(v: string) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function StatusPill({ v, tone }: { v: string | null; tone?: "primary" }) {
  if (!v) return <>—</>;
  const map: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    in_progress: "bg-warning/20 text-warning-foreground",
    done: "bg-success/20 text-success-foreground",
    received: "bg-success/20 text-success-foreground",
    submitted: "bg-info/20 text-info-foreground",
    rejected: "bg-destructive/20 text-destructive",
    expired: "bg-destructive/20 text-destructive",
    fit: "bg-success/20 text-success-foreground",
    unfit: "bg-destructive/20 text-destructive",
    available: "bg-success text-success-foreground",
    processing: "bg-warning text-foreground",
    arrived: "bg-info text-info-foreground",
    canceled: "bg-destructive text-destructive-foreground",
  };
  return (
    <Badge variant="secondary" className={cn("font-medium uppercase text-[10px]", map[v] ?? "", tone === "primary" && "px-2")}>
      {v.replace("_", " ")}
    </Badge>
  );
}

function Trunc({ t }: { t: string | null }) {
  if (!t) return <>—</>;
  return <span className="block max-w-[180px] truncate" title={t}>{t}</span>;
}

function FilterSelect({
  icon: Icon, value, onChange, options, placeholder,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="border-0 bg-transparent shadow-none w-auto h-auto p-0 gap-2 font-bold hover:text-primary">
        <Icon className="h-4 w-4 text-primary" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
      </SelectContent>
    </Select>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
      <Calendar className="h-4 w-4 text-primary" />
      {value ? <span>{new Date(value).toLocaleDateString()}</span> : <span className="text-muted-foreground font-bold">{label}</span>}
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="sr-only" />
    </label>
  );
}

function Field({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
        </SelectContent>
      </Select>
    </div>
  );
}
