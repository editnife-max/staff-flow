import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, FilePlus, FileSignature, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  bulkSoftDelete, bulkUpdateField, listCandidates, softDeleteCandidate,
  updateCandidateField, upsertCandidate,
} from "@/lib/candidates.functions";
import {
  COLUMNS, DEFAULT_VISIBLE, MEDICAL_OPTIONS, OFFICE_OPTIONS, STATUS_OPTIONS, STORAGE_KEY,
  type Candidate, type ColumnKey,
} from "@/components/candidates/types";
import { EditableCell } from "@/components/candidates/EditableCell";
import { EditableSelectCell } from "@/components/candidates/EditableSelectCell";
import { StatusPill } from "@/components/candidates/StatusPill";
import { ColumnVisibilityMenu } from "@/components/candidates/ColumnVisibilityMenu";
import { BulkActionBar } from "@/components/candidates/BulkActionBar";
import { exportCsv } from "@/components/candidates/csv";

export const Route = createFileRoute("/_authenticated/staff/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Staff-Flow" }] }),
  component: CandidatesPage,
});

type SortDir = "asc" | "desc" | null;

function loadVisible(): ColumnKey[] {
  if (typeof window === "undefined") return [...DEFAULT_VISIBLE];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_VISIBLE];
    const parsed = JSON.parse(raw) as ColumnKey[];
    const valid = parsed.filter((k) => COLUMNS.some((c) => c.key === k));
    return valid.length ? valid : [...DEFAULT_VISIBLE];
  } catch {
    return [...DEFAULT_VISIBLE];
  }
}

function CandidatesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const list = useServerFn(listCandidates);
  const upsert = useServerFn(upsertCandidate);
  const updateField = useServerFn(updateCandidateField);
  const softDelete = useServerFn(softDeleteCandidate);
  const bulkDelete = useServerFn(bulkSoftDelete);
  const bulkField = useServerFn(bulkUpdateField);

  // ── filters ───────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [medical, setMedical] = useState<string>("all");
  const [office, setOffice] = useState<string>("all");
  const [sortBy, setSortBy] = useState<ColumnKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── columns ───────────────────────────────────────────────
  const [visible, setVisible] = useState<ColumnKey[]>(() => loadVisible());
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(visible)); } catch { /* noop */ }
  }, [visible]);

  // ── selection ─────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const clearSel = () => setSelected(new Set());
  const toggle = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── data ──────────────────────────────────────────────────
  const queryKey = ["candidates", { search, status, medical, office, sortBy, sortDir }];
  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      list({
        data: {
          search: search.trim() || undefined,
          status: status !== "all" ? (status as never) : undefined,
          medical: medical !== "all" ? (medical as never) : undefined,
          office: office !== "all" ? (office as never) : undefined,
          sortBy,
          sortDir: sortDir ?? "desc",
        },
      }),
  });

  // counts for status pills (computed from current dataset)
  const counts = useMemo(() => {
    const c: Record<string, number> = { available: 0, processing: 0, arrived: 0, canceled: 0 };
    rows.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  // ── mutations ─────────────────────────────────────────────
  const fieldMut = useMutation({
    mutationFn: (v: { id: string; field: string; value: string | number | null }) =>
      updateField({ data: { id: v.id, field: v.field as never, value: v.value } }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<Candidate[]>(queryKey);
      qc.setQueryData<Candidate[]>(queryKey, (old) =>
        (old ?? []).map((r) => (r.id === vars.id ? { ...r, [vars.field]: vars.value } as Candidate : r)),
      );
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
      toast.error(e.message);
    },
    onSuccess: () => toast.success("Saved", { duration: 1200 }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["candidates"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => softDelete({ data: { id } }),
    onSuccess: () => { toast.success("Moved to trash"); qc.invalidateQueries({ queryKey: ["candidates"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: () => bulkDelete({ data: { ids: Array.from(selected) } }),
    onSuccess: (r) => {
      toast.success(`Moved ${r.count} to trash`);
      qc.invalidateQueries({ queryKey: ["candidates"] });
      clearSel();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkFieldMut = useMutation({
    mutationFn: (v: { field: "status" | "medical_status" | "office"; value: string }) =>
      bulkField({ data: { ids: Array.from(selected), field: v.field, value: v.value } }),
    onSuccess: (r) => {
      toast.success(`Updated ${r.count} record(s)`);
      qc.invalidateQueries({ queryKey: ["candidates"] });
      clearSel();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── add dialog ────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", passport_number: "", country: "", occupation: "" });
  const addMut = useMutation({
    mutationFn: () => upsert({ data: { data: { ...form, status: "available" } } }),
    onSuccess: () => {
      toast.success("Candidate added");
      qc.invalidateQueries({ queryKey: ["candidates"] });
      setOpen(false);
      setForm({ full_name: "", passport_number: "", country: "", occupation: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── sort handler ──────────────────────────────────────────
  const onSortClick = (key: ColumnKey) => {
    if (sortBy !== key) { setSortBy(key); setSortDir("asc"); return; }
    setSortDir((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"));
    if (sortDir === "desc") setSortBy("created_at");
  };

  const visibleCols = COLUMNS.filter((c) => visible.includes(c.key));

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = !allSelected && rows.some((r) => selected.has(r.id));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {rows.length} record{rows.length === 1 ? "" : "s"} ·
            {" "}{counts.available} available · {counts.processing} processing · {counts.arrived} arrived · {counts.canceled} canceled
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCsv(rows, visible)}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button
            variant="outline" size="sm" className="gap-2"
            disabled={selected.size !== 1}
            onClick={() => navigate({ to: "/staff/cv-generator", search: { id: Array.from(selected)[0] } })}
          >
            <FileSignature className="h-4 w-4" /> Generate CV
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
            <FilePlus className="h-4 w-4" /> Add Candidate
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9"
              placeholder="Search name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All availability</SelectItem>
              {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={medical} onValueChange={setMedical}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All medical</SelectItem>
              {MEDICAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={office} onValueChange={setOffice}>
            <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All offices</SelectItem>
              {OFFICE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <ColumnVisibilityMenu visible={visible} onChange={setVisible} />
          </div>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          onClear={clearSel}
          onBulkField={(f, v) => bulkFieldMut.mutate({ field: f, value: v })}
          onBulkDelete={() => {
            if (confirm(`Move ${selected.size} candidate(s) to trash?`)) bulkDeleteMut.mutate();
          }}
          busy={bulkDeleteMut.isPending}
        />
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/40 sticky top-0">
              <tr>
                <th className="w-10 px-2 py-2 text-left">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => {
                      setSelected((p) => {
                        const n = new Set(p);
                        if (v) rows.forEach((r) => n.add(r.id));
                        else rows.forEach((r) => n.delete(r.id));
                        return n;
                      });
                    }}
                  />
                </th>
                {visibleCols.map((c) => (
                  <th
                    key={c.key}
                    style={{ minWidth: c.width }}
                    className="px-2 py-2 text-left font-medium text-muted-foreground border-b cursor-pointer select-none"
                    onClick={() => onSortClick(c.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {sortBy === c.key && sortDir === "asc" && <ArrowUp className="h-3 w-3" />}
                      {sortBy === c.key && sortDir === "desc" && <ArrowDown className="h-3 w-3" />}
                      {(sortBy !== c.key || sortDir === null) && <ArrowUpDown className="h-3 w-3 opacity-30" />}
                    </span>
                  </th>
                ))}
                <th className="w-12 px-2 py-2 border-b" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={visibleCols.length + 2} className="text-center text-muted-foreground py-10">Loading…</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={visibleCols.length + 2} className="text-center text-muted-foreground py-10">No candidates match your filters.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className={cn("border-b hover:bg-muted/30", selected.has(r.id) && "bg-primary/5")}>
                  <td className="px-2 py-1">
                    <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                  </td>
                  {visibleCols.map((c) => (
                    <td key={c.key} className="px-1 py-1 align-middle">
                      {renderCell(r, c.key, (value) =>
                        fieldMut.mutate({ id: r.id, field: c.key, value }))}
                    </td>
                  ))}
                  <td className="px-2 py-1">
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Move "${r.full_name}" to trash?`)) deleteMut.mutate(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add candidate</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Full name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <Label>Passport #</Label>
              <Input value={form.passport_number} onChange={(e) => setForm({ ...form, passport_number: e.target.value })} />
            </div>
            <div>
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Occupation</Label>
              <Input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!form.full_name || addMut.isPending} onClick={() => addMut.mutate()}>
              <Plus className="h-4 w-4 mr-1" /> Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function renderCell(
  row: Candidate,
  key: ColumnKey,
  onSave: (value: string | number | null) => void,
) {
  const def = COLUMNS.find((c) => c.key === key)!;
  const value = (row as Record<string, unknown>)[key] as string | number | null | undefined;

  if (def.type === "readonly") {
    if (key === "created_at" && value) {
      return <span className="text-xs text-muted-foreground px-2">{new Date(String(value)).toLocaleDateString()}</span>;
    }
    return <span className="text-sm font-mono px-2">{value == null ? "—" : String(value)}</span>;
  }
  if (def.type === "select" && def.options) {
    if (key === "status" || key === "medical_status" || key === "passport_status" ||
        key === "coc_status" || key === "musaned_status") {
      return (
        <EditableSelectCell
          value={value == null ? null : String(value)}
          options={def.options}
          onSave={(v) => onSave(v)}
        />
      );
    }
    return (
      <EditableSelectCell
        value={value == null ? null : String(value)}
        options={def.options}
        onSave={(v) => onSave(v)}
        pill={false}
      />
    );
  }
  // text / number / date
  if (key === "full_name") {
    return (
      <div className="flex items-center gap-2">
        <EditableCell value={value as string} type={def.type as "text"} onSave={onSave} className="font-medium" />
      </div>
    );
  }
  if (key === "status") {
    return <StatusPill value={value as string} />;
  }
  return <EditableCell value={value as string | number | null} type={def.type as "text" | "number" | "date"} onSave={onSave} />;
}
