import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Clock, Users, Wifi, WifiOff, CalendarClock, ShieldCheck, ShieldX, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getTeamActivity } from "@/lib/staff-sessions.functions";
import { excuseLateDay, unsuspendStaff, backfillStaffAbsents, backfillTeamAbsents, getStaffAttendance, getTodayLateStaff } from "@/lib/staff-attendance.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
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

// ─── Late Login Dialog ────────────────────────────────────────────────────────
function LateLoginDialog({ member, open, onClose }: {
  member: TeamMember | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const doBackfillStaff = useServerFn(backfillStaffAbsents);
  const doGetAttendance = useServerFn(getStaffAttendance);

  const { data: attendance = [], refetch: refetchAttendance } = useQuery<AttendanceRow[]>({
    queryKey: ["staff-attendance", member?.staffUserId],
    enabled: open && !!member?.staffUserId,
    staleTime: 0,
    queryFn: async () => {
      await doBackfillStaff({ data: { staffUserId: member!.staffUserId } });
      return doGetAttendance({ data: { staffUserId: member!.staffUserId } });
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

  const doUnsuspend   = useServerFn(unsuspendStaff);

  const unsuspendMut = useMutation({
    mutationFn: async () => {
      const result = await doUnsuspend({ data: { staffId: member!.staffId } });
      if (!result.ok) throw new Error(result.error ?? "Failed to remove suspension");
    },
    onSuccess: () => {
      toast.success("Suspension removed — incident count reset to 0");
      refetchAttendance();
      qc.invalidateQueries({ queryKey: ["team-activity"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const incidentRows    = attendance.filter((r) => r.is_late || r.absent);
  const unexcusedCount  = attendance.filter((r) => !r.excused && (r.is_late || r.absent)).length;
  const MAX_INCIDENTS   = 3;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Late Login History — {member?.name}
          </DialogTitle>
        </DialogHeader>

        {member?.isSuspended && (
          <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <ShieldX className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">Account suspended</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-3 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
              disabled={unsuspendMut.isPending}
              onClick={() => unsuspendMut.mutate()}
            >
              <ShieldCheck className="h-3 w-3 mr-1" />
              {unsuspendMut.isPending ? "Removing…" : "Remove suspension"}
            </Button>
          </div>
        )}

        {/* Incident counter */}
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

        <div>
          {incidentRows.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No late logins or absent days in the past 30 days.</p>
          ) : (
            <div className="space-y-2">
              {incidentRows.map((rec) => {
                const loginTime = rec.first_login_at
                  ? new Date(new Date(rec.first_login_at).getTime() + 3 * 60 * 60 * 1000)
                      .toISOString()
                      .slice(11, 16)
                  : null;
                return (
                  <div
                    key={rec.id}
                    className="rounded-md border border-border bg-muted/20 px-4 py-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold">{fmtDate(rec.date)}</span>
                        {loginTime ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {loginTime} EAT
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
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-3 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                          disabled={excuseMut.isPending}
                          onClick={() => excuseMut.mutate(rec.id)}
                        >
                          Excuse
                        </Button>
                      )}
                    </div>
                    {rec.reason && (
                      <p className="text-xs text-muted-foreground italic leading-snug">
                        "{rec.reason}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
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
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                member.isOnline ? "bg-emerald-500" : "bg-zinc-400",
              )}
            />
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
              size="sm"
              variant="outline"
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

function StaffActivityPage() {
  const [period, setPeriod]             = useState<Period>("today");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [syncing, setSyncing]           = useState(false);
  const qc                              = useQueryClient();
  const doGetTeamActivity               = useServerFn(getTeamActivity);
  const doBackfill                      = useServerFn(backfillTeamAbsents);
  const doGetTodayLate                  = useServerFn(getTodayLateStaff);
  const doUnsuspendCard                 = useServerFn(unsuspendStaff);

  const unsuspendCardMut = useMutation({
    mutationFn: (staffId: string) => doUnsuspendCard({ data: { staffId } }),
    onSuccess: () => {
      toast.success("Suspension removed — incident count reset to 0");
      qc.invalidateQueries({ queryKey: ["team-activity"] });
      qc.invalidateQueries({ queryKey: ["staff-attendance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Backfill absent records for all staff on every page mount
  const { data: _backfillDone } = useQuery({
    queryKey: ["backfill-absents"],
    queryFn: () => doBackfill(),
    staleTime: 0,
  });

  // Today's staff who haven't logged in past 9 AM — runs after backfill, refreshes every minute
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

  const members: TeamMember[] = Array.isArray(team) ? team : [];
  // Derive selected member live from the latest query data so suspension changes
  // are reflected immediately after the team-activity query refetches.
  const selectedMember = selectedStaffId ? (members.find((m) => m.staffId === selectedStaffId) ?? null) : null;
  const onlineCount      = members.filter((m) => m.isOnline).length;
  const totalHoursToday  = members.reduce((acc, m) => acc + m.hoursToday, 0);

  const sorted = [...members].sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6">
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
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={syncing}
            onClick={syncAbsences}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Sync Absences"}
          </Button>
        </div>
      </div>

      {/* Today's no-login alert — shown only past 9 AM EAT when staff haven't logged in */}
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

          {/* Summary table */}
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

      <LateLoginDialog
        member={selectedMember}
        open={!!selectedStaffId}
        onClose={() => setSelectedStaffId(null)}
      />
    </div>
  );
}
