import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus, Trash2, KeyRound, ChevronRight, Users, CalendarDays,
  CalendarRange, Plane, FileCheck, MapPin, Ticket,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createStaffAccount, deleteStaffAccount, resetStaffPassword,
} from "@/lib/staff-accounts.functions";
import { updateCandidateField } from "@/lib/candidates.functions";

export const Route = createFileRoute("/_authenticated/manager/staff")({
  head: () => ({ meta: [{ title: "Staff — Staff-Flow" }] }),
  component: StaffPage,
});

const VISA_OPTIONS = [
  "Ready for embassy", "Sent to Embassy", "Privately Sent", "Issued",
  "Visa canceled", "Arrived KSA", "Returned", "Waiting Replacement",
];
const TICKET_OPTIONS = ["No", "Ready", "New Order", "Booked", "Exchange", "Urgent"];
const ARRIVAL_CITY_OPTIONS = ["RIYADH", "JEDDAH", "DAMMAM", "JOUF", "HAIL", "ABHA", "OTHERS"];

const FIELD_LABELS: Record<string, string> = {
  visa_status: "Visa",
  ticket_status: "Ticket",
  ticket_date: "Ticket Date",
  arrival_city: "Arrival City",
};

type StaffRow = {
  id: string;
  name: string;
  email: string | null;
  role_title: string | null;
  status: string;
  created_at: string;
};

type CandidateRow = {
  id: string;
  full_name: string;
  visa_status: string | null;
  ticket_status: string | null;
  ticket_date: string | null;
  arrival_city: string | null;
  updated_at: string;
  created_at: string;
  visa_updated_at: string | null;
  ticket_updated_at: string | null;
  ticket_date_updated_at: string | null;
  arrival_city_updated_at: string | null;
};

type FieldLogRow = {
  id: string;
  candidate_id: string;
  field: string;
  new_value: string | null;
  changed_by_name: string;
  changed_at: string;
};

function startOfWeek() {
  const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d;
}
function startOfMonth() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function fmtTs(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Inline editable cell ────────────────────────────────────────────────────
function EditCell({
  value, candidateId, field, type = "text", options, onSaved,
}: {
  value: string | null;
  candidateId: string;
  field: "visa_status" | "ticket_status" | "ticket_date" | "arrival_city";
  type?: "text" | "date";
  options?: string[];
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const doUpdate = useServerFn(updateCandidateField);

  async function save(val?: string) {
    const next = val ?? draft;
    setEditing(false);
    if (next === (value ?? "")) return;
    try {
      await doUpdate({ data: { id: candidateId, field, value: next || null } });
      toast.success("Saved");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (options) {
    return (
      <Select value={value ?? ""} onValueChange={(v) => save(v)}>
        <SelectTrigger className="h-8 text-xs px-2 border border-border bg-background hover:bg-muted/60 focus:ring-1 min-w-[130px] rounded-md">
          <SelectValue placeholder="— not set —" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  if (editing) {
    return (
      <Input
        autoFocus
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => save()}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className="h-8 text-xs px-2 min-w-[110px]"
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      className="h-8 text-left text-xs hover:bg-muted/60 border border-border rounded-md px-2 w-full min-w-[110px] transition-colors flex items-center"
    >
      {type === "date" ? fmtDate(value) : (value || <span className="text-muted-foreground/40 italic">— not set —</span>)}
    </button>
  );
}

// ─── Staff detail sheet ───────────────────────────────────────────────────────
function StaffDetailSheet({ staff, open, onClose }: {
  staff: StaffRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const { data = { candidates: [] as CandidateRow[], logs: [] as FieldLogRow[] }, isLoading } = useQuery({
    queryKey: ["staff-detail", staff?.id],
    enabled: open && !!staff,
    queryFn: async () => {
      const { data: cands, error: cErr } = await supabase
        .from("candidates")
        .select(`id, full_name, visa_status, ticket_status, ticket_date, arrival_city,
                 updated_at, created_at,
                 visa_updated_at, ticket_updated_at, ticket_date_updated_at, arrival_city_updated_at`)
        .eq("assigned_staff_id", staff!.id)
        .order("created_at", { ascending: false });
      if (cErr) throw cErr;

      const candidates = (cands ?? []) as CandidateRow[];
      if (candidates.length === 0) return { candidates, logs: [] as FieldLogRow[] };

      const { data: logRows, error: lErr } = await supabase
        .from("candidate_field_log")
        .select("id, candidate_id, field, new_value, changed_by_name, changed_at")
        .in("candidate_id", candidates.map((c) => c.id))
        .order("changed_at", { ascending: false });
      if (lErr) throw lErr;

      return { candidates, logs: (logRows ?? []) as FieldLogRow[] };
    },
  });

  const { candidates, logs: fieldLogs } = data;

  const weekStart = startOfWeek().toISOString();
  const monthStart = startOfMonth().toISOString();

  const total   = candidates.length;
  const weekly  = candidates.filter((c) => c.created_at >= weekStart).length;
  const monthly = candidates.filter((c) => c.created_at >= monthStart).length;

  const fieldStats = [
    {
      key: "visa",
      label: "Visa",
      icon: FileCheck,
      total:   candidates.filter((c) => c.visa_status).length,
      weekly:  candidates.filter((c) => c.visa_updated_at && c.visa_updated_at >= weekStart).length,
      monthly: candidates.filter((c) => c.visa_updated_at && c.visa_updated_at >= monthStart).length,
    },
    {
      key: "ticket",
      label: "Ticket",
      icon: Ticket,
      total:   candidates.filter((c) => c.ticket_status).length,
      weekly:  candidates.filter((c) => c.ticket_updated_at && c.ticket_updated_at >= weekStart).length,
      monthly: candidates.filter((c) => c.ticket_updated_at && c.ticket_updated_at >= monthStart).length,
    },
    {
      key: "ticket_date",
      label: "Ticket Date",
      icon: Plane,
      total:   candidates.filter((c) => c.ticket_date).length,
      weekly:  candidates.filter((c) => c.ticket_date_updated_at && c.ticket_date_updated_at >= weekStart).length,
      monthly: candidates.filter((c) => c.ticket_date_updated_at && c.ticket_date_updated_at >= monthStart).length,
    },
    {
      key: "arrival_city",
      label: "Arrival City",
      icon: MapPin,
      total:   candidates.filter((c) => c.arrival_city).length,
      weekly:  candidates.filter((c) => c.arrival_city_updated_at && c.arrival_city_updated_at >= weekStart).length,
      monthly: candidates.filter((c) => c.arrival_city_updated_at && c.arrival_city_updated_at >= monthStart).length,
    },
  ];

  function refresh() { qc.invalidateQueries({ queryKey: ["staff-detail", staff?.id] }); }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto p-0">
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b bg-muted/30">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-primary">
                {staff?.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <SheetTitle className="text-xl">{staff?.name}</SheetTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{staff?.email ?? "—"}</p>
              {staff?.role_title && (
                <Badge variant="secondary" className="mt-1.5 text-xs">{staff.role_title}</Badge>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="px-6 py-5 space-y-6">
          {/* Registration stats */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Registered Candidates
            </p>
            <div className="grid grid-cols-3 gap-3">
              <StatTile icon={Users}         label="Total"      value={total}   color="text-primary" />
              <StatTile icon={CalendarDays}  label="This Week"  value={weekly}  color="text-teal-500" />
              <StatTile icon={CalendarRange} label="This Month" value={monthly} color="text-violet-500" />
            </div>
          </div>

          {/* Processing field activity */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Processing Activity
            </p>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs py-2">Field</TableHead>
                    <TableHead className="text-xs py-2 text-center">Total set</TableHead>
                    <TableHead className="text-xs py-2 text-center">
                      <span className="flex items-center justify-center gap-1"><CalendarDays className="h-3 w-3" />This Week</span>
                    </TableHead>
                    <TableHead className="text-xs py-2 text-center">
                      <span className="flex items-center justify-center gap-1"><CalendarRange className="h-3 w-3" />This Month</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fieldStats.map((fs) => (
                    <TableRow key={fs.key}>
                      <TableCell className="py-2 text-xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <fs.icon className="h-3.5 w-3.5" />{fs.label}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        <span className="text-sm font-semibold">{fs.total}</span>
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        <span className={`text-sm font-semibold ${fs.weekly > 0 ? "text-teal-600" : "text-muted-foreground"}`}>{fs.weekly}</span>
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        <span className={`text-sm font-semibold ${fs.monthly > 0 ? "text-violet-600" : "text-muted-foreground"}`}>{fs.monthly}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Assigned candidates */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Assigned Candidates ({candidates.length})
            </p>

            {isLoading ? (
              <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>
            ) : candidates.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                No candidates assigned to this staff member yet.
              </div>
            ) : (
              <div className="space-y-3">
                {candidates.map((c) => {
                  const logs = fieldLogs.filter((l) => l.candidate_id === c.id);
                  return (
                    <div key={c.id} className="border rounded-md overflow-hidden">
                      {/* Candidate header */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b">
                        <span className="font-medium text-sm">{c.full_name}</span>
                        <span className="text-xs text-muted-foreground">Registered {fmtDate(c.created_at)}</span>
                      </div>

                      {/* Editable fields */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3 border-b">
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                            <FileCheck className="h-3 w-3" /> Visa
                          </p>
                          <EditCell value={c.visa_status} candidateId={c.id} field="visa_status" options={VISA_OPTIONS} onSaved={refresh} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                            <Ticket className="h-3 w-3" /> Ticket
                          </p>
                          <EditCell value={c.ticket_status} candidateId={c.id} field="ticket_status" options={TICKET_OPTIONS} onSaved={refresh} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                            <Plane className="h-3 w-3" /> Ticket Date
                          </p>
                          <EditCell value={c.ticket_date} candidateId={c.id} field="ticket_date" type="date" onSaved={refresh} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> Arrival City
                          </p>
                          <EditCell value={c.arrival_city} candidateId={c.id} field="arrival_city" options={ARRIVAL_CITY_OPTIONS} onSaved={refresh} />
                        </div>
                      </div>

                      {/* Change history */}
                      {logs.length > 0 ? (
                        <div className="px-4 py-3 space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Change History</p>
                          {logs.map((log) => (
                            <div key={log.id} className="flex items-start gap-2.5 text-xs">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                <span className="text-muted-foreground whitespace-nowrap">{fmtTs(log.changed_at)}</span>
                                <span className="font-semibold text-foreground">{FIELD_LABELS[log.field] ?? log.field}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-medium text-primary">
                                  {log.new_value ? (log.field === "ticket_date" ? fmtDate(log.new_value) : log.new_value) : <em className="text-muted-foreground/60">cleared</em>}
                                </span>
                                <span className="text-muted-foreground/60">by {log.changed_by_name}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-2.5 text-xs text-muted-foreground/50 italic">
                          No changes recorded yet.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatTile({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-1">
      <div className={`${color} mb-1`}><Icon className="h-5 w-5" /></div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
function StaffPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const create    = useServerFn(createStaffAccount);
  const remove    = useServerFn(deleteStaffAccount);
  const doResetPw = useServerFn(resetStaffPassword);

  const [open, setOpen]           = useState(false);
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [roleTitle, setRoleTitle] = useState("");

  const [resetTarget,   setResetTarget]   = useState<{ id: string; name: string } | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmPw,     setConfirmPw]     = useState("");

  const [selectedStaff, setSelectedStaff] = useState<StaffRow | null>(null);

  function closeReset() { setResetTarget(null); setResetPassword(""); setConfirmPw(""); }
  const resetValid = resetPassword.length >= 6 && resetPassword === confirmPw;

  const { data: staff = [] } = useQuery<StaffRow[]>({
    queryKey: ["staff", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as StaffRow[];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => create({ data: { name, email, password, roleTitle: roleTitle || null } }),
    onSuccess: () => {
      toast.success("Staff account created");
      qc.invalidateQueries({ queryKey: ["staff"] });
      setOpen(false);
      setName(""); setEmail(""); setPassword(""); setRoleTitle("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (staffId: string) => remove({ data: { staffId } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["staff"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMut = useMutation({
    mutationFn: () => doResetPw({ data: { staffId: resetTarget!.id, newPassword: resetPassword } }),
    onSuccess: () => { toast.success("Password reset successfully"); closeReset(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Create login accounts for your team. Click a row to view their candidates."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Create staff account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create a staff account</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>Password</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" /></div>
                <div className="space-y-2"><Label>Role title (optional)</Label><Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => createMut.mutate()}
                  disabled={!name || !email || password.length < 6 || createMut.isPending}
                >
                  {createMut.isPending ? "Creating..." : "Create account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => setSelectedStaff(s)}
                >
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1">
                      {s.name}
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.email ?? "—"}</TableCell>
                  <TableCell>{s.role_title ?? "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex bg-success/15 text-success px-2 py-0.5 text-xs">{s.status}</span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost" size="icon" title="Reset password"
                        onClick={() => setResetTarget({ id: s.id, name: s.name })}
                      >
                        <KeyRound className="h-4 w-4 text-amber-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeMut.mutate(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    No staff yet. Create the first account above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <StaffDetailSheet
        staff={selectedStaff}
        open={!!selectedStaff}
        onClose={() => setSelectedStaff(null)}
      />

      <Dialog open={!!resetTarget} onOpenChange={(o) => { if (!o) closeReset(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" /> Reset Password
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Set a new password for <strong>{resetTarget?.name}</strong>.
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>New password <span className="text-muted-foreground text-xs">(min 6 chars)</span></Label>
              <Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm password</Label>
              <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
              {confirmPw && !resetValid && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeReset}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!resetValid || resetMut.isPending}
              onClick={() => resetMut.mutate()}
            >
              {resetMut.isPending ? "Resetting…" : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
