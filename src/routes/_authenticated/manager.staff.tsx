import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus, Trash2, KeyRound, ChevronRight, Users, CalendarDays,
  CalendarRange, Plane, FileCheck, MapPin, Ticket, Clock,
} from "lucide-react";
import { useState, useRef } from "react";
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
  createStaffAccount, deleteStaffAccount, resetStaffPassword,
} from "@/lib/staff-accounts.functions";
import { updateCandidateField } from "@/lib/candidates.functions";

export const Route = createFileRoute("/_authenticated/manager/staff")({
  head: () => ({ meta: [{ title: "Staff — Staff-Flow" }] }),
  component: StaffPage,
});

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
};

function now() { return new Date(); }
function startOfWeek() {
  const d = now(); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d;
}
function startOfMonth() {
  const d = now(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function fmtTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ─── Inline editable cell ────────────────────────────────────────────────────
function EditCell({
  value, candidateId, field, type = "text", onSaved,
}: {
  value: string | null;
  candidateId: string;
  field: "visa_status" | "ticket_status" | "ticket_date" | "arrival_city";
  type?: "text" | "date";
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const doUpdate = useServerFn(updateCandidateField);
  const ref = useRef<HTMLInputElement>(null);

  function startEdit() { setDraft(value ?? ""); setEditing(true); setTimeout(() => ref.current?.focus(), 0); }

  async function save() {
    setEditing(false);
    if (draft === (value ?? "")) return;
    try {
      await doUpdate({ data: { id: candidateId, field, value: draft || null } });
      toast.success("Saved");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (editing) {
    return (
      <Input
        ref={ref}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className="h-7 text-xs px-1.5 min-w-[90px]"
      />
    );
  }

  return (
    <button
      onClick={startEdit}
      className="text-left text-xs hover:bg-muted/60 rounded px-1.5 py-0.5 w-full min-w-[70px] transition-colors"
    >
      {type === "date" ? fmtDate(value) : (value || <span className="text-muted-foreground/50 italic">—</span>)}
    </button>
  );
}

// ─── Staff detail sheet ───────────────────────────────────────────────────────
function StaffDetailSheet({
  staff,
  open,
  onClose,
}: {
  staff: StaffRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const { data: candidates = [], isLoading } = useQuery<CandidateRow[]>({
    queryKey: ["staff-candidates", staff?.id],
    enabled: open && !!staff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, full_name, visa_status, ticket_status, ticket_date, arrival_city, updated_at, created_at")
        .eq("assigned_staff_id", staff!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CandidateRow[];
    },
  });

  const weekStart = startOfWeek().toISOString();
  const monthStart = startOfMonth().toISOString();
  const total = candidates.length;
  const weekly = candidates.filter((c) => c.created_at >= weekStart).length;
  const monthly = candidates.filter((c) => c.created_at >= monthStart).length;

  function refresh() { qc.invalidateQueries({ queryKey: ["staff-candidates", staff?.id] }); }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-0">
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
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatTile icon={Users} label="Total Candidates" value={total} color="text-primary" />
            <StatTile icon={CalendarDays} label="This Week" value={weekly} color="text-teal-500" />
            <StatTile icon={CalendarRange} label="This Month" value={monthly} color="text-violet-500" />
          </div>

          {/* Candidates table */}
          <div>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Assigned Candidates
            </h3>

            {isLoading ? (
              <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>
            ) : candidates.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                No candidates assigned to this staff member yet.
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs">Candidate</TableHead>
                      <TableHead className="text-xs">
                        <span className="flex items-center gap-1"><FileCheck className="h-3 w-3" /> Visa</span>
                      </TableHead>
                      <TableHead className="text-xs">
                        <span className="flex items-center gap-1"><Ticket className="h-3 w-3" /> Ticket</span>
                      </TableHead>
                      <TableHead className="text-xs">
                        <span className="flex items-center gap-1"><Plane className="h-3 w-3" /> Ticket Date</span>
                      </TableHead>
                      <TableHead className="text-xs">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Arrival City</span>
                      </TableHead>
                      <TableHead className="text-xs">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Updated</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((c) => (
                      <TableRow key={c.id} className="hover:bg-muted/20">
                        <TableCell className="font-medium text-sm py-2.5 max-w-[140px]">
                          <span className="truncate block" title={c.full_name}>{c.full_name}</span>
                          <span className="text-xs text-muted-foreground">{fmtDate(c.created_at)}</span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <EditCell
                            value={c.visa_status}
                            candidateId={c.id}
                            field="visa_status"
                            onSaved={refresh}
                          />
                        </TableCell>
                        <TableCell className="py-2.5">
                          <EditCell
                            value={c.ticket_status}
                            candidateId={c.id}
                            field="ticket_status"
                            onSaved={refresh}
                          />
                        </TableCell>
                        <TableCell className="py-2.5">
                          <EditCell
                            value={c.ticket_date}
                            candidateId={c.id}
                            field="ticket_date"
                            type="date"
                            onSaved={refresh}
                          />
                        </TableCell>
                        <TableCell className="py-2.5">
                          <EditCell
                            value={c.arrival_city}
                            candidateId={c.id}
                            field="arrival_city"
                            onSaved={refresh}
                          />
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {fmtTimestamp(c.updated_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatTile({
  icon: Icon, label, value, color,
}: {
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

      {/* Staff detail sheet */}
      <StaffDetailSheet
        staff={selectedStaff}
        open={!!selectedStaff}
        onClose={() => setSelectedStaff(null)}
      />

      {/* Reset password dialog */}
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
