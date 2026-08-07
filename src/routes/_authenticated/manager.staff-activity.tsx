import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Clock, Users, Wifi, WifiOff } from "lucide-react";
import { getTeamActivity } from "@/lib/staff-sessions.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function MemberCard({ member, period }: { member: TeamMember; period: Period }) {
  const hours = hoursForPeriod(member, period);
  const candidates = candidatesForPeriod(member, period);

  return (
    <Card className="relative">
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
              {member.isOnline ? (
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
      </CardContent>
    </Card>
  );
}

function StaffActivityPage() {
  const [period, setPeriod] = useState<Period>("today");
  const doGetTeamActivity = useServerFn(getTeamActivity);

  const { data: team, isLoading } = useQuery({
    queryKey: ["team-activity"],
    queryFn: () => doGetTeamActivity(),
    refetchInterval: 15_000,
  });

  const members = (team ?? []) as TeamMember[];
  const onlineCount = members.filter((m) => m.isOnline).length;
  const totalHoursToday = members.reduce((acc, m) => acc + m.hoursToday, 0);

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
        </div>
      </div>

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
          {/* Online first, then sorted by name */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...members]
              .sort((a, b) => {
                if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map((m) => (
                <MemberCard key={m.staffId} member={m} period={period} />
              ))}
          </div>

          {/* Summary table for quick comparison */}
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
                    {[...members]
                      .sort((a, b) => {
                        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
                        return a.name.localeCompare(b.name);
                      })
                      .map((m) => (
                        <tr key={m.staffId} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 font-medium">{m.name}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-xs font-medium",
                                m.isOnline ? "text-emerald-600" : "text-muted-foreground",
                              )}
                            >
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
    </div>
  );
}
