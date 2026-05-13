import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Search, FilePlus, FileText, Pencil, Trash2, FileSignature,
  Users, Calendar, Circle, BookOpen,
  Stethoscope, FileEdit, BriefcaseBusiness, BadgeCheck, Globe, Send, Activity,
  UserPlus, UserCheck, X,
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
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import {
  upsertCandidate, deleteCandidate, updateCandidateField,
  bulkDeleteCandidates, bulkUpdateStatus, bulkAssignStaff,
} from "@/lib/candidates.functions";

type Status = "available" | "processing" | "arrived" | "canceled";
type Candidate = Database["public"]["Tables"]["candidates"]["Row"] & {
  created_by_user_id?: string | null;
  created_by_name?: string | null;
};

export const Route = createFileRoute("/_authenticated/manager/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Staff-Flow" }] }),
  component: ManagerCandidatesPage,
});

const TABS: { key: Status; label: string }[] = [
  { key: "available", label: "Available" },
  { key: "processing", label: "Processing" },
  { key: "arrived", label: "Arrived" },
  { key: "canceled", label: "Canceled" },
];

const MEDICAL_OPTIONS = ["Fit", "Booked", "Unfit", "No", "In progress", "Expired"];
const AVAILABILITY_OPTIONS: Status[] = ["available", "processing", "arrived", "canceled"];
const COC_OPTIONS = ["Done", "No", "Booked", "Placed", "Yitazez", "Pending release"];
const MUSANED_OPTIONS = ["Saudi", "Kuwait"];
const OFFICE_OPTIONS = ["Riyadh", "Jeddah", "Dammam", "Other"];
const PASSPORT_OPTIONS = ["Pending", "Submitted", "Received", "Expired"];

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

const firstName = (s: string | null | undefined) =>
  (s ?? "").trim().split(/\s+/)[0] || "";

function ManagerCandidatesPage() {
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
  const [filters, setFilters] = useState({
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
    added_by: "all",
    from: "",
    to: "",
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [form, setForm] = useState(initialForm);

  const { data: candidates = [] } = useQuery({
    queryKey: ["manager-candidates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates").select("*");
      if (error) throw error;
      return data as Candidate[];
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
    const c: Record<string, number> = { available: 0, processing: 0, arrived: 0, canceled: 0 };
    candidates.forEach((x) => { c[x.status] = (c[x.status] ?? 0) + 1; });
    return c;
  }, [candidates]);

  const updateField = useServerFn(updateCandidateField);
  const fieldMut = useMutation({
    mutationFn: async (input: { id: string; field: string; value: string | null }) =>
      updateField({ data: input as never }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manager-candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const opts = useMemo(() => {
    const uniq = (k: keyof Candidate) =>
      Array.from(new Set(candidates.map((c) => (c[k] as string | null) ?? "").filter(Boolean))).sort();
    return {
      narrative: uniq("narrative"),
      cv_sent_to: uniq("cv_sent_to"),
      musaned: uniq("musaned_status"),
      availability: uniq("status"),
    };
  }, [candidates]);

  const addedByOptions = useMemo(() => {
    const fromStaff = staffList.map((s) => firstName(s.name)).filter(Boolean);
    const fromCands = candidates
      .map((c) => firstName(c.created_by_name))
      .filter(Boolean);
    return Array.from(new Set([...fromStaff, ...fromCands])).sort();
  }, [staffList, candidates]);

  const filtered = useMemo(() => {
    let list = candidates.filter((c) => c.status === tab);
    if (passport) list = list.filter((c) => (c.passport_number ?? "").toLowerCase().includes(passport.toLowerCase()));
    if (filters.gender !== "all") list = list.filter((c) => c.gender === filters.gender);
    if (filters.religion !== "all") list = list.filter((c) => c.religion === filters.religion);
    if (filters.medical !== "all") list = list.filter((c) => c.medical_status === filters.medical);
    if (filters.narrative !== "all") list = list.filter((c) => c.narrative === filters.narrative);
    if (filters.experience !== "all") list = list.filter((c) => c.experience === filters.experience);
    if (filters.coc !== "all") list = list.filter((c) => c.coc_status === filters.coc);
    if (filters.musaned !== "all") list = list.filter((c) => c.musaned_status === filters.musaned);
    if (filters.cv_sent_to !== "all") list = list.filter((c) => c.cv_sent_to === filters.cv_sent_to);
    if (filters.availability !== "all") list = list.filter((c) => c.status === filters.availability);
    if (filters.added_by !== "all")
      list = list.filter((c) => firstName(c.created_by_name) === filters.added_by);
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
    mutationFn: async () => bulkDel({ data: { ids: Array.from(selected) } }),
    onSuccess: (r) => {
      toast.success(`Deleted ${r.count} candidate(s)`);
      qc.invalidateQueries({ queryKey: ["manager-candidates"] });
      clearSelection();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkStatusMut = useMutation({
    mutationFn: async (status: Status) =>
      bulkStatus({ data: { ids: Array.from(selected), status } }),
    onSuccess: (r) => {
      toast.success(`Updated ${r.count} candidate(s)`);
      qc.invalidateQueries({ queryKey: ["manager-candidates"] });
      clearSelection();
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

  const openCreate = () => { setEditing(null); setForm({ ...initialForm, status: tab }); setOpen(true); };
  const openEdit = (c: Candidate) => {
    setEditing(c);
    setForm({
      full_name: c.full_name, serial_number: c.serial_number ?? "", passport_number: c.passport_number ?? "",
      dob: c.dob ?? "", occupation: c.occupation ?? "", country: c.country ?? "",
      age: c.age ?? "", gender: c.gender ?? "", religion: c.religion ?? "",
      marital_status: c.marital_status ?? "", education: c.education ?? "",
      skills: c.skills ?? "", status: c.status as Status, photo_url: c.photo_url ?? "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Candidates</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="gap-2 text-xs h-8"
            disabled={selected.size === 0}
            onClick={() => {
              const first = Array.from(selected)[0];
              if (first) navigate({ to: "/staff/cv-generator", search: { id: first } });
            }}
          >
            <FileSignature className="h-4 w-4" />
            GENERATE CV{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
          <Button size="sm" className="gap-2 text-xs h-8" onClick={openCreate}>
            <FilePlus className="h-4 w-4" /> ADD NEW CANDIDATE
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <FilterSelect icon={Calendar} value={filters.sort} onChange={(v) => setFilters({ ...filters, sort: v })}
              options={[{ value: "newest", label: "Date (Newest)" }, { value: "oldest", label: "Date (Oldest)" }]} />
            <FilterSelect icon={Users} placeholder="Age" value={filters.age}
              onChange={(v) => setFilters({ ...filters, age: v })}
              options={[
                { value: "all", label: "-----" },
                { value: "18-25", label: "18-25" }, { value: "26-35", label: "26-35" },
                { value: "36-45", label: "36-45" }, { value: "46-99", label: "46+" },
              ]} />
            <FilterSelect icon={Circle} placeholder="Gender" value={filters.gender}
              onChange={(v) => setFilters({ ...filters, gender: v })}
              options={[{ value: "all", label: "-----" }, { value: "Male", label: "Male" }, { value: "Female", label: "Female" }]} />
            <FilterSelect icon={BookOpen} placeholder="Religion" value={filters.religion}
              onChange={(v) => setFilters({ ...filters, religion: v })}
              options={[{ value: "all", label: "-----" }, { value: "Muslim", label: "Muslim" }, { value: "Non-muslim", label: "Non-muslim" }]} />
            <FilterSelect icon={Stethoscope} placeholder="Medical" value={filters.medical}
              onChange={(v) => setFilters({ ...filters, medical: v })}
              options={[{ value: "all", label: "-----" }, ...MEDICAL_OPTIONS.map((o) => ({ value: o, label: o }))]} />
            <FilterSelect icon={FileEdit} placeholder="Narrative" value={filters.narrative}
              onChange={(v) => setFilters({ ...filters, narrative: v })}
              options={[{ value: "all", label: "-----" }, ...opts.narrative.map((o) => ({ value: o, label: o }))]} />
            <FilterSelect icon={BriefcaseBusiness} placeholder="Experience" value={filters.experience}
              onChange={(v) => setFilters({ ...filters, experience: v })}
              options={[{ value: "all", label: "-----" }, { value: "Experienced", label: "Experienced" }, { value: "Non-Experienced", label: "Non-Experienced" }]} />
            <FilterSelect icon={BadgeCheck} placeholder="COC" value={filters.coc}
              onChange={(v) => setFilters({ ...filters, coc: v })}
              options={[{ value: "all", label: "-----" }, ...["Done","No","Booked","Placed","Yitazez","Pending Release"].map((o) => ({ value: o, label: o }))]} />
            <FilterSelect icon={Globe} placeholder="Musaned" value={filters.musaned}
              onChange={(v) => setFilters({ ...filters, musaned: v })}
              options={[{ value: "all", label: "-----" }, ...opts.musaned.map((o) => ({ value: o, label: o }))]} />
            <FilterSelect icon={Send} placeholder="CV Sent To" value={filters.cv_sent_to}
              onChange={(v) => setFilters({ ...filters, cv_sent_to: v })}
              options={[{ value: "all", label: "-----" }, ...opts.cv_sent_to.map((o) => ({ value: o, label: o }))]} />
            <FilterSelect icon={Activity} placeholder="Availability" value={filters.availability}
              onChange={(v) => setFilters({ ...filters, availability: v })}
              options={[
                { value: "all", label: "-----" },
                ...(["available", "processing", "arrived", "canceled"] as const)
                  .filter((s) => opts.availability.includes(s))
                  .map((o) => ({ value: o, label: o.charAt(0).toUpperCase() + o.slice(1) })),
              ]} />
            <FilterSelect icon={UserPlus} placeholder="Added By" value={filters.added_by}
              onChange={(v) => setFilters({ ...filters, added_by: v })}
              options={[{ value: "all", label: "-----" }, ...addedByOptions.map((o) => ({ value: o, label: o }))]} />
            <DateField label="From Date" value={filters.from} onChange={(v) => setFilters({ ...filters, from: v })} />
            <DateField label="To Date" value={filters.to} onChange={(v) => setFilters({ ...filters, to: v })} />
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <div className="relative w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-9 h-8 text-xs" placeholder="Passport Number" value={passport} onChange={(e) => setPassport(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-8 border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "pb-2 text-xs font-medium transition-colors",
                  tab === t.key
                    ? "text-primary border-b-2 border-primary -mb-px"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label} <span className="ml-1 text-[10px] opacity-70">({counts[t.key] ?? 0})</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

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

      {filtered.length > 0 && (() => {
        const allSelected = filtered.every((c) => selected.has(c.id));
        const someSelected = !allSelected && filtered.some((c) => selected.has(c.id));
        return (
          <label className="flex items-center gap-2 px-1 text-sm font-medium cursor-pointer w-fit">
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
            Select all ({filtered.length})
          </label>
        );
      })()}
      <div className="space-y-2">
        {filtered.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            selected={selected.has(c.id)}
            onToggleSelect={() => toggleSelect(c.id)}
            onEdit={() => openEdit(c)}
            onDelete={() => removeMut.mutate(c.id)}
            onUpdateField={(field, value) => fieldMut.mutate({ id: c.id, field, value })}
          />
        ))}
        {filtered.length === 0 && (
          <Card><CardContent className="p-12 text-center text-muted-foreground">No candidates here yet.</CardContent></Card>
        )}
      </div>

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
                  <SelectItem value="arrived">Arrived</SelectItem>
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

type EditableField =
  | "notes" | "narrative" | "occupation" | "living_town" | "selected_by"
  | "medical_status" | "status" | "office" | "passport_status"
  | "musaned_status" | "coc_status";

function CandidateCard({
  candidate, selected, onToggleSelect, onEdit, onDelete, onUpdateField,
}: {
  candidate: Candidate;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateField: (field: EditableField, value: string | null) => void;
}) {
  const statusStyles: Record<Status, string> = {
    available: "bg-success text-success-foreground",
    processing: "bg-warning text-foreground",
    arrived: "bg-info text-info-foreground",
    canceled: "bg-destructive text-destructive-foreground",
  };
  const statusLabel: Record<Status, string> = {
    available: "AVAILABLE", processing: "PROCESSING", arrived: "ARRIVED", canceled: "CANCELED",
  };
  const statusKey = (candidate.status in statusStyles ? candidate.status : "available") as Status;

  type FieldDef =
    | { label: string; value: string; bold?: boolean }
    | { label: string; value: string; edit: "text"; field: EditableField }
    | { label: string; value: string; edit: "select"; field: EditableField; options: string[] };

  const fields: FieldDef[] = [
    { label: "FULL NAME", value: candidate.full_name, bold: true },
    { label: "ADDED BY", value: firstName(candidate.created_by_name) || "—" },
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
    { label: "CV SENT TO", value: candidate.cv_sent_to ?? "—" },
    { label: "CV SENT DATE", value: candidate.cv_sent_date ? new Date(candidate.cv_sent_date).toLocaleDateString() : "—" },
    { label: "NARRATIVE", value: candidate.narrative ?? "", edit: "text", field: "narrative" },
    { label: "NOTES", value: candidate.notes ?? "", edit: "text", field: "notes" },
  ];

  return (
    <Card className={cn("relative overflow-visible transition-colors", selected && "ring-2 ring-primary")}>
      <span className={cn(
        "absolute -top-2 left-3 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide",
        statusStyles[statusKey],
      )}>
        {statusLabel[statusKey]}
      </span>
      <CardContent className="p-2.5">
        <div className="grid grid-cols-[20px_40px_1fr_auto] gap-3 items-center">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Select candidate" />
          <Avatar className="h-10 w-10">
            {candidate.photo_url && <AvatarImage src={candidate.photo_url} alt={candidate.full_name} />}
            <AvatarFallback className="text-[10px]">{candidate.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="overflow-x-auto no-scrollbar">
            <table className="text-[11px] border-collapse">
              <thead>
                <tr>
                  {fields.map((f) => (
                    <th key={f.label} className="text-left text-[9px] font-medium tracking-wider text-muted-foreground uppercase whitespace-nowrap pr-6 pb-1">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {fields.map((f) => (
                    <td key={f.label} className={cn("whitespace-nowrap pr-6 align-top", "bold" in f && f.bold && "font-semibold")}>
                      {"edit" in f && f.edit === "text" ? (
                        <InlineText
                          value={f.value}
                          onSave={(v) => onUpdateField(f.field, v)}
                        />
                      ) : "edit" in f && f.edit === "select" ? (
                        <InlineSelect
                          value={f.value}
                          options={f.options}
                          onSave={(v) => onUpdateField(f.field, v)}
                        />
                      ) : (
                        ("value" in f ? f.value : "—") || "—"
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <Button asChild size="sm" className="h-6 w-16 text-[10px] px-2">
              <Link to="/staff/cv-generator" search={{ id: candidate.id }}>
                <FileText className="h-3 w-3 mr-1" /> VIEW
              </Link>
            </Button>
            <button onClick={onEdit} className="text-[10px] text-primary hover:underline flex items-center gap-1">
              <Pencil className="h-2.5 w-2.5" /> Edit
            </button>
            <button onClick={onDelete} className="text-[10px] text-destructive hover:underline flex items-center gap-1">
              <Trash2 className="h-2.5 w-2.5" /> Delete
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InlineText({ value, onSave }: { value: string; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(value); setEditing(true); }}
        className="text-left rounded px-1 -mx-1 py-0.5 hover:bg-muted/60 hover:ring-1 hover:ring-border min-w-[40px] block"
      >
        {value || <span className="text-muted-foreground">—</span>}
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
      className="rounded border border-primary bg-background px-1 py-0.5 text-[11px] outline-none min-w-[80px]"
    />
  );
}

function InlineSelect({
  value, options, onSave,
}: { value: string; options: string[]; onSave: (v: string | null) => void }) {
  return (
    <Select value={value || undefined} onValueChange={(v) => onSave(v)}>
      <SelectTrigger className="h-6 w-auto min-w-[90px] gap-1 border-transparent bg-transparent px-1 py-0 text-[11px] shadow-none hover:border-border hover:bg-muted/60 focus:ring-0">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="text-xs capitalize">{o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  const isReset = value === "all" || !value;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="border-0 bg-transparent shadow-none w-auto h-auto p-0 gap-2 text-xs font-bold hover:text-primary">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {isReset ? (
          <span className="text-foreground">{placeholder}</span>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
      <Calendar className="h-3.5 w-3.5 text-primary" />
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
