import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Clock, Users, Wifi, WifiOff, CalendarClock, ShieldCheck, ShieldX,
  RefreshCw, AlertTriangle, Columns3, FileKey,
} from "lucide-react";
import { toast } from "sonner";
import { getTeamActivity } from "@/lib/staff-sessions.functions";
import {
  excuseLateDay, unsuspendStaff, backfillStaffAbsents,
  backfillTeamAbsents, getStaffAttendance, getTodayLateStaff,
} from "@/lib/staff-attendance.functions";
import { getStaffOverrides, setStaffOverride, clearStaffOverride } from "@/lib/staff-overrides.functions";
import type { StaffOverride, OverrideMode } from "@/lib/staff-overrides.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/manager/staff-activity")({
  head: () => ({ meta: [{ title: "Staff Activity — Staff-Flow" }] }),
  component: StaffActivityPage,
});

type Period = "today" | "week" | "month" | "year";

type TeamMember = {
  staffId: string;
  staffUserId: string;
  name: string;
  isOnline: boolean;
  isSuspended: boolean;
  lastSeen: string | null;
  firstLoginToday: string | null;
  sessionsToday: number;
  hoursToday: number;
  hoursWeek: number;
  hoursMonth: number;
  hoursYear: number;
  candidatesToday: number;
  candidatesWeek: number;
  candidatesMonth: number;
  candidatesYear: number;
  workDaysMonth: number;
};

type AttendanceRow = {
  id: string;
  date: string;
  first_login_at: string | null;
  is_late: boolean;
  absent: boolean;
  reason: string | null;
  excused: boolean;
  excused_at: string | null;
};

type DetailView = "late-login" | "column-overrides" | "page-access";

const OVERRIDABLE_COLUMNS = [
  { key: "medical_status",   label: "Medical Status" },
  { key: "coc_status",       label: "COC" },
  { key: "narrative",        label: "Narrative" },
  { key: "experience",       label: "Experience" },
  { key: "tasheer_status",   label: "Tasheer" },
  { key: "wokala_status",    label: "Wokala" },
  { key: "visa_status",      label: "Visa Status" },
  { key: "insurance_status", label: "Insurance" },
  { key: "lmis_status",      label: "LMIS" },
  { key: "ticket_status",    label: "Ticket" },
  { key: "musaned_status",   label: "Country" },
  { key: "selected_by",      label: "Assigned To" },
  { key: "cv_sent_to",       label: "CV Sent To" },
  { key: "criteria",         label: "Criteria" },
];

const OVERRIDABLE_PAGES = [
  { key: "candidates",   label: "HR Pool" },
  { key: "cv_generator", label: "CV Page" },
  { key: "attendance",   label: "My Attendance" },
  { key: "tc",           label: "TC" },
  { key: "available",    label: "Available tab" },
  { key: "processing",   label: "Processing tab" },
  { key: "arrived",      label: "Arrival tab" },
  { key: "returned",     label: "Return tab" },
  { key: "canceled",     label: "Cancellation tab" },
];

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function hoursForPeriod(m: TeamMember, period: Period): number {
  if (period === "today") return m.hoursToday;
  if (period === "week") return m.hoursWeek;
  if (period === "month") return m.hoursMonth;
  return m.hoursYear;
}

function candidatesForPeriod(m: TeamMember, period: Period): number {
  if (period === "today") return m.candidatesToday;
  if (period === "week") return m.candidatesWeek;
  if (period === "month") return m.candidatesMonth;
  return m.candidatesYear;
}

// ─── Late Login Panel ─────────────────────────────────────────────────────────
function LateLoginPanel({ member }: { member: TeamMember }) {
  const qc = useQueryClient();
  const doBackfillStaff  = useServerFn(backfillStaffAbsents);
  const doGetAttendance  = useServerFn(getStaffAttendance);

  const { data: attendance = [], refetch: refetchAttendance } = useQuery<AttendanceRow[]>({
    queryKey: ["staff-attendance", member.staffUserId],
    staleTime: 0,
    queryFn: async () => {
      await doBackfillStaff({ data: { staffUserId: member.staffUserId } });
      return doGetAttendance({ data: { staffUserId: member.staffUserId } });
    },
  });

  const doExcuse = useServerFn(excuseLateDay);
  const excuseMut = useMutation({
    mutationFn: (attendanceId: string) => doExcuse({ data: { attendanceId } }),
    onSuccess: () => {
      toast.success("Day excused");
      refetchAttendance();
      qc.invalidateQueries({ queryKey: ["team-activity"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doUnsuspend  = useServerFn(unsuspendStaff);
  const unsuspendMut = useMutation({
    mutationFn: async () => {
      const result = await doUnsuspend({ data: { staffId: member.staffId } });
      if (!result.ok) throw new Error(result.error ?? "Failed to remove suspension");
    },
    onSuccess: () => {
      toast.success("Suspension removed — incident count reset to 0");
      refetchAttendance();
      qc.invalidateQueries({ queryKey: ["team-activity"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const incidentRows   = attendance.filter((r) => r.is_late || r.absent);
  const unexcusedCount = attendance.filter((r) => !r.excused && (r.is_late || r.absent)).length;
  const MAX_INCIDENTS  = 3;

  return (
    <div className="space-y-4">
      {member.isSuspended && (
        <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldX className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">Account suspended</span>
          </div>
          <Button
            size="sm" variant="outline"
            className="h-7 text-xs px-3 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
            disabled={unsuspendMut.isPending}
            onClick={() => unsuspendMut.mutate()}
          >
            <ShieldCheck className="h-3 w-3 mr-1" />
            {unsuspendMut.isPending ? "Removing…" : "Remove suspension"}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wide">Last 30 Days</span>
        <span className={cn(
          "font-semibold",
          unexcusedCount >= MAX_INCIDENTS ? "text-destructive" :
          unexcusedCount >= MAX_INCIDENTS - 1 ? "text-amber-600" :
          "text-foreground",
        )}>
          {unexcusedCount} / {MAX_INCIDENTS} incidents
        </span>
      </div>

      {incidentRows.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No late logins or absent days in the past 30 days.</p>
      ) : (
        <div className="space-y-2">
          {incidentRows.map((rec) => {
            const loginTime = rec.first_login_at
              ? new Date(new Date(rec.first_login_at).getTime() + 3 * 60 * 60 * 1000)
                  .toISOString().slice(11, 16)
              : null;
            return (
              <div key={rec.id} className="rounded-md border border-border bg-muted/20 px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold">{fmtDate(rec.date)}</span>
                    {loginTime ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />{loginTime} EAT
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No login</span>
                    )}
                    {rec.excused ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-sm text-xs font-medium">
                        <ShieldCheck className="h-3 w-3" /> Excused
                      </span>
                    ) : rec.absent ? (
                      <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-600 px-2 py-0.5 rounded-sm text-xs font-medium">
                        <ShieldX className="h-3 w-3" /> No Login
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-sm text-xs font-medium">
                        <ShieldX className="h-3 w-3" /> Late
                      </span>
                    )}
                  </div>
                  {!rec.excused && (
                    <Button
                      size="sm" variant="outline"
                      className="h-7 text-xs px-3 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                      disabled={excuseMut.isPending}
                      onClick={() => excuseMut.mutate(rec.id)}
                    >
                      Excuse
                    </Button>
                  )}
                </div>
                {rec.reason && (
                  <p className="text-xs text-muted-foreground italic leading-snug">"{rec.reason}"</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type ModeOption = {
  mode: OverrideMode;
  label: string;
  activeClass: string;
  inactiveClass: string;
};

// ─── Override toggle row ──────────────────────────────────────────────────────
function OverrideRow({
  label, current, onSet, onClear, pendingKey, activeKey, options,
}: {
  label: string;
  current: OverrideMode | null;
  onSet: (mode: OverrideMode) => void;
  onClear: () => void;
  pendingKey: string | null;
  activeKey: string;
  options: ModeOption[];
}) {
  const isLoading = pendingKey === activeKey;
  const handleClick = (mode: OverrideMode) => {
    if (current === mode) onClear();
    else onSet(mode);
  };

  const activeBadge = options.find((o) => o.mode === current);

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border/60 last:border-0">
      <span className="text-sm font-medium flex-1 min-w-0 truncate">{label}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        {activeBadge && (
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", activeBadge.activeClass)}>
            {activeBadge.label}
          </span>
        )}
        {options.map((opt) => (
          <Button
            key={opt.mode}
            size="sm"
            variant={current === opt.mode ? "default" : "outline"}
            className={cn(
              "h-7 text-xs px-3",
              current === opt.mode ? opt.activeClass + " text-white border-0" : opt.inactiveClass,
            )}
            disabled={isLoading}
            onClick={() => handleClick(opt.mode)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

const COLUMN_MODE_OPTIONS: ModeOption[] = [
  { mode: "view",  label: "Viewer", activeClass: "bg-blue-600 hover:bg-blue-700",   inactiveClass: "text-blue-700 border-blue-300 hover:bg-blue-50" },
  { mode: "edit",  label: "Editor", activeClass: "bg-teal-600 hover:bg-teal-700",   inactiveClass: "text-teal-700 border-teal-300 hover:bg-teal-50" },
  { mode: "grant", label: "Grant",  activeClass: "bg-emerald-600 hover:bg-emerald-700", inactiveClass: "text-emerald-700 border-emerald-300 hover:bg-emerald-50" },
  { mode: "deny",  label: "Deny",   activeClass: "bg-red-600 hover:bg-red-700",     inactiveClass: "text-red-700 border-red-300 hover:bg-red-50" },
];

const PAGE_MODE_OPTIONS: ModeOption[] = [
  { mode: "view",  label: "Viewer", activeClass: "bg-blue-600 hover:bg-blue-700",   inactiveClass: "text-blue-700 border-blue-300 hover:bg-blue-50" },
  { mode: "edit",  label: "Editor", activeClass: "bg-teal-600 hover:bg-teal-700",   inactiveClass: "text-teal-700 border-teal-300 hover:bg-teal-50" },
  { mode: "grant", label: "Allow",  activeClass: "bg-emerald-600 hover:bg-emerald-700", inactiveClass: "text-emerald-700 border-emerald-300 hover:bg-emerald-50" },
  { mode: "deny",  label: "Deny",   activeClass: "bg-red-600 hover:bg-red-700",     inactiveClass: "text-red-700 border-red-300 hover:bg-red-50" },
];

// ─── Column Overrides Panel ───────────────────────────────────────────────────
function ColumnOverridesPanel({ member, overrides, onRefresh }: {
  member: TeamMember;
  overrides: StaffOverride[];
  onRefresh: () => void;
}) {
  const doSet   = useServerFn(setStaffOverride);
  const doClear = useServerFn(clearStaffOverride);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const colOverrides = overrides.filter((o) => o.type === "column_edit");
  const getMode = (target: string): OverrideMode | null =>
    colOverrides.find((o) => o.target === target)?.mode ?? null;

  const handleSet = async (target: string, mode: OverrideMode) => {
    setPendingKey(target);
    try {
      await doSet({ data: { staffUserId: member.staffUserId, type: "column_edit", target, mode } });
      onRefresh();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save override");
    } finally {
      setPendingKey(null);
    }
  };

  const handleClear = async (target: string) => {
    setPendingKey(target);
    try {
      await doClear({ data: { staffUserId: member.staffUserId, type: "column_edit", target } });
      onRefresh();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to clear override");
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-xs space-y-1 text-muted-foreground">
        <p><span className="font-semibold text-blue-700">Viewer</span> — can see the column but cannot edit it.</p>
        <p><span className="font-semibold text-teal-700">Editor</span> — can see and edit the column.</p>
        <p><span className="font-semibold text-emerald-700">Grant</span> — let this user edit a column that is globally restricted.</p>
        <p><span className="font-semibold text-red-700">Deny</span> — hide the column &amp; prevent editing even if their role normally allows it.</p>
      </div>
      <div>
        {OVERRIDABLE_COLUMNS.map((col) => (
          <OverrideRow
            key={col.key}
            label={col.label}
            current={getMode(col.key)}
            onSet={(mode) => handleSet(col.key, mode)}
            onClear={() => handleClear(col.key)}
            pendingKey={pendingKey}
            activeKey={col.key}
            options={COLUMN_MODE_OPTIONS}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Page Access Panel ────────────────────────────────────────────────────────
function PageAccessPanel({ member, overrides, onRefresh }: {
  member: TeamMember;
  overrides: StaffOverride[];
  onRefresh: () => void;
}) {
  const doSet   = useServerFn(setStaffOverride);
  const doClear = useServerFn(clearStaffOverride);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const pageOverrides = overrides.filter((o) => o.type === "page_access");
  const getMode = (target: string): OverrideMode | null =>
    pageOverrides.find((o) => o.target === target)?.mode ?? null;

  const handleSet = async (target: string, mode: OverrideMode) => {
    setPendingKey(target);
    try {
      await doSet({ data: { staffUserId: member.staffUserId, type: "page_access", target, mode } });
      onRefresh();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save override");
    } finally {
      setPendingKey(null);
    }
  };

  const handleClear = async (target: string) => {
    setPendingKey(target);
    try {
      await doClear({ data: { staffUserId: member.staffUserId, type: "page_access", target } });
      onRefresh();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to clear override");
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-xs space-y-1 text-muted-foreground">
        <p>Current access is derived from the staff role configuration.</p>
        <p><span className="font-semibold text-blue-700">Viewer</span> — read-only access to the page.</p>
        <p><span className="font-semibold text-teal-700">Editor</span> — full editing access to the page.</p>
        <p><span className="font-semibold text-emerald-700">Allow</span> — grant access even if role denies.</p>
        <p><span className="font-semibold text-red-700">Deny</span> — block access even if role allows.</p>
      </div>
      <div>
        {OVERRIDABLE_PAGES.map((page) => (
          <OverrideRow
            key={page.key}
            label={page.label}
            current={getMode(page.key)}
            onSet={(mode) => handleSet(page.key, mode)}
            onClear={() => handleClear(page.key)}
            pendingKey={pendingKey}
            activeKey={page.key}
            options={PAGE_MODE_OPTIONS}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Staff Detail Dialog ──────────────────────────────────────────────────────
function StaffDetailDialog({ member, open, onClose }: {
  member: TeamMember | null;
  open: boolean;
  onClose: () => void;
}) {
  const [view, setView] = useState<DetailView>("late-login");
  const doGetOverrides  = useServerFn(getStaffOverrides);

  const { data: overrides = [], refetch: refetchOverrides } = useQuery<StaffOverride[]>({
    queryKey: ["staff-overrides", member?.staffUserId],
    enabled: open && !!member?.staffUserId && view !== "late-login",
    staleTime: 0,
    queryFn: () => doGetOverrides({ data: { staffUserId: member!.staffUserId } }),
  });

  const handleClose = () => {
    setView("late-login");
    onClose();
  };

  const NAV: { key: DetailView; label: string; Icon: React.ElementType }[] = [
    { key: "late-login",       label: "Late Login History",      Icon: CalendarClock },
    { key: "column-overrides", label: "Column Editing Overrides", Icon: Columns3 },
    { key: "page-access",      label: "Page Access Overrides",    Icon: FileKey },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {member?.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className={cn(
                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                member?.isOnline ? "bg-emerald-500" : "bg-zinc-400",
              )} />
            </div>
            <div>
              <DialogTitle className="text-base">{member?.name}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {member?.isOnline ? "Online now" : `Last seen: ${formatLastSeen(member?.lastSeen ?? null)}`}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Nav buttons */}
        <div className="flex border-b border-border shrink-0 bg-muted/20">
          {NAV.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2.5 px-2 text-[11px] font-medium transition-colors border-b-2",
                view === key
                  ? "border-primary text-primary bg-background"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="leading-tight text-center">{label}</span>
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {member && (
            <>
              {view === "late-login" && <LateLoginPanel member={member} />}
              {view === "column-overrides" && (
                <ColumnOverridesPanel
                  member={member}
                  overrides={overrides}
                  onRefresh={refetchOverrides}
                />
              )}
              {view === "page-access" && (
                <PageAccessPanel
                  member={member}
                  overrides={overrides}
                  onRefresh={refetchOverrides}
                />
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Member Card ──────────────────────────────────────────────────────────────
function MemberCard({ member, period, onClick, onUnsuspend, unsuspending }: {
  member: TeamMember;
  period: Period;
  onClick: () => void;
  onUnsuspend?: () => void;
  unsuspending?: boolean;
}) {
  const hours      = hoursForPeriod(member, period);
  const candidates = candidatesForPeriod(member, period);

  return (
    <Card
      className="relative cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {member.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
              member.isOnline ? "bg-emerald-500" : "bg-zinc-400",
            )} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm leading-tight truncate">{member.name}</p>
              {member.isSuspended ? (
                <Badge className="bg-destructive/15 text-destructive border-0 text-[10px] px-1.5 py-0 font-medium">
                  Suspended
                </Badge>
              ) : member.isOnline ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 border-0 text-[10px] px-1.5 py-0 font-medium">
                  Online
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                  Offline
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {member.isOnline ? "Online now" : `Last seen: ${formatLastSeen(member.lastSeen)}`}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Hours</p>
            <p className="text-lg font-bold text-foreground leading-tight">{hours.toFixed(1)}</p>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Candidates</p>
            <p className="text-lg font-bold text-foreground leading-tight">{candidates}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {member.firstLoginToday && (
            <span>First login: <span className="text-foreground font-medium">{formatTime(member.firstLoginToday)}</span></span>
          )}
          <span>Work days (month): <span className="text-foreground font-medium">{member.workDaysMonth}</span></span>
        </div>

        {member.isSuspended && onUnsuspend && (
          <div className="mt-3 pt-3 border-t border-border">
            <Button
              size="sm" variant="outline"
              className="w-full h-7 text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50 rounded-none gap-1.5"
              disabled={unsuspending}
              onClick={(e) => { e.stopPropagation(); onUnsuspend(); }}
            >
              <ShieldCheck className="h-3 w-3" />
              {unsuspending ? "Removing…" : "Remove suspension"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function StaffActivityPage() {
  const [period, setPeriod]                   = useState<Period>("today");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [syncing, setSyncing]                 = useState(false);
  const qc                                    = useQueryClient();
  const doGetTeamActivity                     = useServerFn(getTeamActivity);
  const doBackfill                            = useServerFn(backfillTeamAbsents);
  const doGetTodayLate                        = useServerFn(getTodayLateStaff);
  const doUnsuspendCard                       = useServerFn(unsuspendStaff);

  const unsuspendCardMut = useMutation({
    mutationFn: (staffId: string) => doUnsuspendCard({ data: { staffId } }),
    onSuccess: () => {
      toast.success("Suspension removed — incident count reset to 0");
      qc.invalidateQueries({ queryKey: ["team-activity"] });
      qc.invalidateQueries({ queryKey: ["staff-attendance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: _backfillDone } = useQuery({
    queryKey: ["backfill-absents"],
    queryFn: () => doBackfill(),
    staleTime: 0,
  });

  const { data: todayLate = [] } = useQuery({
    queryKey: ["today-late-staff"],
    queryFn: () => doGetTodayLate(),
    staleTime: 0,
    refetchInterval: 60_000,
  });

  const { data: team, isLoading } = useQuery({
    queryKey: ["team-activity"],
    queryFn: () => doGetTeamActivity(),
    refetchInterval: 15_000,
  });

  async function syncAbsences() {
    setSyncing(true);
    try {
      await doBackfill();
      qc.invalidateQueries({ queryKey: ["staff-attendance"] });
      toast.success("Absences registered for all staff");
    } catch {
      toast.error("Failed to sync absences");
    } finally {
      setSyncing(false);
    }
  }

  const members: TeamMember[]  = Array.isArray(team) ? team : [];
  const selectedMember         = selectedStaffId ? (members.find((m) => m.staffId === selectedStaffId) ?? null) : null;
  const onlineCount            = members.filter((m) => m.isOnline).length;
  const totalHoursToday        = members.reduce((acc, m) => acc + m.hoursToday, 0);

  const sorted = [...members].sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Activity</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time attendance and productivity overview</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-emerald-500/15 text-emerald-700 border-0 gap-1.5 text-sm px-3 py-1.5">
            <Wifi className="h-3.5 w-3.5" />
            {onlineCount} Online Now
          </Badge>
          <Badge variant="secondary" className="gap-1.5 text-sm px-3 py-1.5">
            <Clock className="h-3.5 w-3.5" />
            {totalHoursToday.toFixed(1)}h team today
          </Badge>
          <Badge variant="secondary" className="gap-1.5 text-sm px-3 py-1.5">
            <Users className="h-3.5 w-3.5" />
            {members.length} total staff
          </Badge>
          <Button
            variant="outline" size="sm" className="gap-1.5"
            disabled={syncing} onClick={syncAbsences}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Sync Absences"}
          </Button>
        </div>
      </div>

      {todayLate.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Late Login — No Login Yet Today ({todayLate.length} staff past 09:00 AM)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {todayLate.map((s) => {
                const member = members.find((m) => m.staffUserId === s.staffUserId) ?? null;
                return (
                  <button
                    key={s.attendanceId}
                    onClick={() => member && setSelectedStaffId(member.staffId)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white dark:bg-amber-950/40 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 transition-colors",
                      member ? "hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer" : "cursor-default opacity-60",
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    {s.name}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-amber-700/70 dark:text-amber-500/70">
              These staff members have not logged in today. Click a name to view their attendance history.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="year">Year</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-14 w-full rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <WifiOff className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No active staff members found.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sorted.map((m) => (
              <MemberCard
                key={m.staffId}
                member={m}
                period={period}
                onClick={() => setSelectedStaffId(m.staffId)}
                onUnsuspend={m.isSuspended ? () => unsuspendCardMut.mutate(m.staffId) : undefined}
                unsuspending={unsuspendCardMut.isPending && unsuspendCardMut.variables === m.staffId}
              />
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Summary Table</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Staff</th>
                      <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Hours ({period})</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Candidates ({period})</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Work days (month)</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">First login</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sorted.map((m) => (
                      <tr
                        key={m.staffId}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedStaffId(m.staffId)}
                      >
                        <td className="px-4 py-2.5 font-medium">{m.name}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={cn("inline-flex items-center gap-1 text-xs font-medium", m.isOnline ? "text-emerald-600" : "text-muted-foreground")}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", m.isOnline ? "bg-emerald-500" : "bg-zinc-400")} />
                            {m.isOnline ? "Online" : "Offline"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{hoursForPeriod(m, period).toFixed(1)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{candidatesForPeriod(m, period)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{m.workDaysMonth}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{formatTime(m.firstLoginToday)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <StaffDetailDialog
        member={selectedMember}
        open={!!selectedStaffId}
        onClose={() => setSelectedStaffId(null)}
      />
    </div>
  );
}
