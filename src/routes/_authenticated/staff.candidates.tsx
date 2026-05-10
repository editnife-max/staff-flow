import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Search, FilePlus, FileText, Pencil, Trash2, FileSignature,
  Briefcase, GraduationCap, Users, Calendar, Wrench, HeartHandshake, Circle, BookOpen,
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
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import {
  upsertCandidate, deleteCandidate,
  bulkDeleteCandidates, bulkUpdateStatus, bulkAssignStaff,
} from "@/lib/candidates.functions";
import { UserCheck, X } from "lucide-react";

type Status = Database["public"]["Enums"]["candidate_status"];
type Candidate = Database["public"]["Tables"]["candidates"]["Row"];

export const Route = createFileRoute("/_authenticated/staff/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Staff-Flow" }] }),
  component: StaffCandidatesPage,
});

const TABS: { key: Status; label: string }[] = [
  { key: "available", label: "Available" },
  { key: "processing", label: "Processing" },
  { key: "arrived", label: "Employee" },
];

const initialForm = {
  full_name: "",
  serial_number: "",
  passport_number: "",
  dob: "",
  occupation: "",
  country: "",
  age: "" as string | number,
  gender: "",
  religion: "",
  marital_status: "",
  education: "",
  skills: "",
  status: "available" as Status,
  photo_url: "",
};

function StaffCandidatesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const upsert = useServerFn(upsertCandidate);
  const remove = useServerFn(deleteCandidate);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [tab, setTab] = useState<Status>("available");
  const [search, setSearch] = useState("");
  const [passport, setPassport] = useState("");
  const [filters, setFilters] = useState({
    sort: "newest",
    job: "all",
    skill: "all",
    education: "all",
    age: "all",
    marital: "all",
    gender: "all",
    religion: "all",
    from: "",
    to: "",
  });

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

  const counts = useMemo(() => {
    const c: Record<string, number> = { available: 0, processing: 0, arrived: 0 };
    candidates.forEach((x) => { c[x.status] = (c[x.status] ?? 0) + 1; });
    return c;
  }, [candidates]);

  const opts = useMemo(() => {
    const uniq = (k: keyof Candidate) =>
      Array.from(new Set(candidates.map((c) => (c[k] as string | null) ?? "").filter(Boolean))).sort();
    return {
      job: uniq("occupation"),
      skill: uniq("skills"),
      education: uniq("education"),
      marital: uniq("marital_status"),
      gender: uniq("gender"),
      religion: uniq("religion"),
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

  const openCreate = () => { setEditing(null); setForm({ ...initialForm, status: tab }); setOpen(true); };
  const openEdit = (c: Candidate) => {
    setEditing(c);
    setForm({
      full_name: c.full_name, serial_number: c.serial_number ?? "", passport_number: c.passport_number ?? "",
      dob: c.dob ?? "", occupation: c.occupation ?? "", country: c.country ?? "",
      age: c.age ?? "", gender: c.gender ?? "", religion: c.religion ?? "",
      marital_status: c.marital_status ?? "", education: c.education ?? "",
      skills: c.skills ?? "", status: c.status, photo_url: c.photo_url ?? "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Candidates</h1>
        <div className="flex items-center gap-2">
          <Button
            size="lg"
            variant="secondary"
            className="gap-2"
            disabled={selected.size === 0}
            onClick={() => {
              const first = Array.from(selected)[0];
              if (first) navigate({ to: "/staff/cv-generator", search: { id: first } });
            }}
          >
            <FileSignature className="h-5 w-5" />
            GENERATE CV{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
          <Button size="lg" className="gap-2" onClick={openCreate}>
            <FilePlus className="h-5 w-5" /> ADD NEW CANDIDATE
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

      {/* Candidate cards */}
      <div className="space-y-4">
        {filtered.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            selected={selected.has(c.id)}
            onToggleSelect={() => toggleSelect(c.id)}
            onEdit={() => openEdit(c)}
            onDelete={() => removeMut.mutate(c.id)}
          />
        ))}
        {filtered.length === 0 && (
          <Card><CardContent className="p-12 text-center text-muted-foreground">No candidates here yet.</CardContent></Card>
        )}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit candidate" : "Add new candidate"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
            <Field label="Full Name *" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
            <Field label="Serial Number" value={form.serial_number} onChange={(v) => setForm({ ...form, serial_number: v })} />
            <Field label="Passport Number" value={form.passport_number} onChange={(v) => setForm({ ...form, passport_number: v })} />
            <Field label="Date of Birth" type="date" value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} />
            <Field label="Occupation" value={form.occupation} onChange={(v) => setForm({ ...form, occupation: v })} />
            <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
            <Field label="Age" type="number" value={String(form.age)} onChange={(v) => setForm({ ...form, age: v })} />
            <Field label="Gender" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} />
            <Field label="Religion" value={form.religion} onChange={(v) => setForm({ ...form, religion: v })} />
            <Field label="Marital Status" value={form.marital_status} onChange={(v) => setForm({ ...form, marital_status: v })} />
            <Field label="Education" value={form.education} onChange={(v) => setForm({ ...form, education: v })} />
            <Field label="Skills" value={form.skills} onChange={(v) => setForm({ ...form, skills: v })} />
            <Field label="Photo URL" value={form.photo_url} onChange={(v) => setForm({ ...form, photo_url: v })} />
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="arrived">Employee (Arrived)</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
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
    </div>
  );
}

function CandidateCard({
  candidate, selected, onToggleSelect, onEdit, onDelete,
}: {
  candidate: Candidate;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusStyles: Record<Status, string> = {
    available: "bg-success text-success-foreground",
    processing: "bg-warning text-foreground",
    arrived: "bg-info text-info-foreground",
    canceled: "bg-destructive text-destructive-foreground",
  };
  const statusLabel: Record<Status, string> = {
    available: "AVAILABLE", processing: "PROCESSING", arrived: "EMPLOYEE", canceled: "CANCELED",
  };
  return (
    <Card className={cn("relative overflow-visible transition-colors", selected && "ring-2 ring-primary")}>
      <span className={cn(
        "absolute -top-2 left-4 rounded px-2 py-0.5 text-xs font-semibold tracking-wide",
        statusStyles[candidate.status],
      )}>
        {statusLabel[candidate.status]}
      </span>
      <CardContent className="p-5">
        <div className="grid grid-cols-[28px_80px_1fr_auto] gap-6 items-center">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Select candidate" />
          <Avatar className="h-16 w-16">
            {candidate.photo_url && <AvatarImage src={candidate.photo_url} alt={candidate.full_name} />}
            <AvatarFallback>{candidate.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-sm">
            <CardField label="NAME" value={candidate.full_name} bold />
            <CardField label="SERIAL NUMBER" value={candidate.serial_number ?? "—"} />
            <CardField label="PASSPORT NUMBER" value={candidate.passport_number ?? "—"} />
            <CardField label="DATE OF BIRTH" value={candidate.dob ? new Date(candidate.dob).toLocaleDateString() : "—"} />
            <CardField label="OCCUPATION" value={candidate.occupation ?? "—"} />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button asChild size="sm" className="w-24">
              <Link to="/staff/cv-generator" search={{ id: candidate.id }}>
                <FileText className="h-4 w-4 mr-1" /> VIEW
              </Link>
            </Button>
            <button onClick={onEdit} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button onClick={onDelete} className="text-xs text-destructive hover:underline flex items-center gap-1">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          CREATION DATE · {new Date(candidate.created_at).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

function CardField({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-medium tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1", bold && "font-semibold")}>{value}</div>
    </div>
  );
}

function FilterSelect({
  icon: Icon, value, onChange, options, placeholder,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="border-0 bg-transparent shadow-none w-auto h-auto p-0 gap-2 font-bold hover:text-primary">
        <Icon className="h-4 w-4 text-primary" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
      <Calendar className="h-4 w-4 text-primary" />
      {value ? <span>{new Date(value).toLocaleDateString()}</span> : <span className="text-muted-foreground">{label}</span>}
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
