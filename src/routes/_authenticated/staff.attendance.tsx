import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Activity, Clock, CalendarDays, TrendingUp } from "lucide-react";
import { getMyAttendance } from "@/lib/staff-sessions.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/staff/attendance")({
  head: () => ({ meta: [{ title: "My Attendance — Staff-Flow" }] }),
  component: AttendancePage,
});

const SLOT_MS = 15 * 60 * 1000;
const ACTIVITY_WINDOW_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "0 min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function mergeSlots(slotIndices: number[]): Array<[number, number]> {
  if (!slotIndices.length) return [];
  const sorted = [...slotIndices].sort((a, b) => a - b);
  const ranges: Array<[number, number]> = [];
  let start = sorted[0], end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push([start, end]);
      start = end = sorted[i];
    }
  }
  ranges.push([start, end]);
  return ranges;
}

function slotToTime(slotIndex: number): string {
  return new Date(slotIndex * SLOT_MS).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DayTimeline({ todaySlotIndices }: { todaySlotIndices: number[] }) {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dayStartSlot = Math.floor(todayStart.getTime() / SLOT_MS);
  const currentSlotInDay = Math.floor(now / SLOT_MS) - dayStartSlot;
  const TOTAL_SLOTS = 96;

  const activeSet = new Set(todaySlotIndices);

  return (
    <div className="space-y-2">
      <div className="flex gap-px rounded-md overflow-hidden h-6">
        {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
          const globalSlot = dayStartSlot + i;
          const isActive = activeSet.has(globalSlot);
          const isFuture = i > currentSlotInDay;
          const h = Math.floor(i / 4);
          const m = (i % 4) * 15;
          const label = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
          return (
            <div
              key={i}
              className={cn(
                "flex-1",
                isFuture
                  ? "bg-muted/20"
                  : isActive
                    ? "bg-primary"
                    : "bg-muted/50",
              )}
              title={label}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground select-none">
        <span>12 AM</span>
        <span>6 AM</span>
        <span>12 PM</span>
        <span>6 PM</span>
        <span>12 AM</span>
      </div>
    </div>
  );
}

function ActivePeriods({ todaySlotIndices }: { todaySlotIndices: number[] }) {
  const ranges = mergeSlots(todaySlotIndices);
  if (!ranges.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No active periods recorded today yet.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      {ranges.map(([start, end], i) => {
        const durationMin = (end - start + 1) * 15;
        return (
          <div
            key={i}
            className="flex items-center justify-between text-sm px-3 py-2 rounded-md bg-muted/40"
          >
            <span className="font-medium tabular-nums">
              {slotToTime(start)} – {slotToTime(end + 1)}
            </span>
            <span className="text-muted-foreground text-xs">{formatMinutes(durationMin)}</span>
          </div>
        );
      })}
    </div>
  );
}

function AttendancePage() {
  const doGetMyAttendance = useServerFn(getMyAttendance);
  const lastActivityRef = useRef<number>(Date.now());
  const [isCurrentlyActive, setIsCurrentlyActive] = useState(true);

  useEffect(() => {
    const record = () => { lastActivityRef.current = Date.now(); };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, record, { passive: true }));
    const check = setInterval(() => {
      setIsCurrentlyActive(Date.now() - lastActivityRef.current <= ACTIVITY_WINDOW_MS);
    }, 5_000);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, record));
      clearInterval(check);
    };
  }, []);

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["my-attendance"],
    queryFn: () => doGetMyAttendance(),
    refetchInterval: 30_000,
  });

  const attendance = data as {
    activeMinutesToday: number;
    activeMinutesWeek: number;
    activeMinutesMonth: number;
    activeMinutesYear: number;
    firstActivityToday: string | null;
    todaySlotIndices: number[];
  } | undefined;

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Attendance</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Time is counted in 15-minute windows — only when you're active
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">Updated {lastUpdated}</span>
          )}
          <Badge
            className={cn(
              "gap-1.5 text-sm px-3 py-1.5 border-0",
              isCurrentlyActive
                ? "bg-emerald-500/15 text-emerald-700"
                : "bg-zinc-100 text-zinc-500",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isCurrentlyActive ? "bg-emerald-500 animate-pulse" : "bg-zinc-400",
              )}
            />
            {isCurrentlyActive ? "Active Now" : "Inactive"}
          </Badge>
        </div>
      </div>

      {/* Today hero */}
      <Card>
        <CardContent className="pt-6 pb-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                Active Time Today
              </p>
              {isLoading ? (
                <Skeleton className="h-10 w-32" />
              ) : (
                <p className="text-4xl font-bold tracking-tight">
                  {formatMinutes(attendance?.activeMinutesToday ?? 0)}
                </p>
              )}
              {attendance?.firstActivityToday && (
                <p className="text-xs text-muted-foreground mt-1">
                  First activity at{" "}
                  <span className="text-foreground font-medium">
                    {formatTime(attendance.firstActivityToday)}
                  </span>
                </p>
              )}
            </div>
            <Activity className="h-10 w-10 text-primary/20" />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Today's Timeline</p>
            {isLoading ? (
              <Skeleton className="h-6 w-full rounded-md" />
            ) : (
              <DayTimeline todaySlotIndices={attendance?.todaySlotIndices ?? []} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Week / Month / Year */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "This Week",
            value: attendance?.activeMinutesWeek,
            icon: Clock,
          },
          {
            label: "This Month",
            value: attendance?.activeMinutesMonth,
            icon: CalendarDays,
          },
          {
            label: "This Year",
            value: attendance?.activeMinutesYear,
            icon: TrendingUp,
          },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
                    {label}
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-24 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold mt-1">{formatMinutes(value ?? 0)}</p>
                  )}
                </div>
                <Icon className="h-5 w-5 text-muted-foreground/40 mt-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active periods breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Today's Active Periods</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <ActivePeriods todaySlotIndices={attendance?.todaySlotIndices ?? []} />
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Each 15-minute window counts once if you performed any action (mouse, keyboard, scroll)
        during it. Periods of inactivity longer than 15 minutes are not counted.
      </p>
    </div>
  );
}
