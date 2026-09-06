import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const HEARTBEAT_STALE_MS = 3 * 60 * 1000; // 3 minutes (≈3× the 1-min heartbeat)

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : -(day - 1);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function computeSessionHours(
  startedAt: string,
  endedAt: string | null,
  lastHeartbeatAt: string,
): number {
  const start = new Date(startedAt).getTime();
  let end: number;
  if (endedAt) {
    end = new Date(endedAt).getTime();
  } else {
    const hb = new Date(lastHeartbeatAt).getTime();
    const now = Date.now();
    // If heartbeat is stale treat it as the end time, otherwise use now
    end = now - hb > HEARTBEAT_STALE_MS ? hb : now;
  }
  return Math.max(0, end - start) / (1000 * 60 * 60);
}

export const startStaffSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      deviceType: z.enum(["desktop", "mobile", "tablet"]),
      userAgent: z.string().max(500),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.deviceType !== "desktop") {
      throw new Error("Attendance tracking is only available on desktop devices");
    }
    const userId = context.userId;

    const { data: roleRow, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("manager_id")
      .eq("user_id", userId)
      .eq("role", "staff")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow?.manager_id) throw new Error("No manager found for this staff user");

    const { data: staffRow } = await supabaseAdmin
      .from("staff")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: inserted, error: insertErr } = await (supabaseAdmin
      .from("staff_sessions" as any)
      .insert({
        staff_user_id: userId,
        manager_id: roleRow.manager_id,
        staff_id: staffRow?.id ?? null,
        device_type: data.deviceType,
        user_agent: data.userAgent,
      })
      .select("id")
      .single() as any);
    if (insertErr) throw new Error(insertErr.message);

    return { sessionId: inserted.id as string };
  });

export const heartbeatSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (supabaseAdmin
      .from("staff_sessions" as any)
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq("id", data.sessionId)
      .eq("staff_user_id", context.userId) as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const endStaffSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (supabaseAdmin
      .from("staff_sessions" as any)
      .update({ ended_at: new Date().toISOString() })
      .eq("id", data.sessionId)
      .eq("staff_user_id", context.userId) as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMySessionStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const now = new Date();
    const yearAgo = new Date(now);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    const { data: sessions, error } = await (supabaseAdmin
      .from("staff_sessions" as any)
      .select("id, started_at, ended_at, last_heartbeat_at")
      .eq("staff_user_id", userId)
      .eq("device_type", "desktop")
      .gte("started_at", yearAgo.toISOString())
      .order("started_at", { ascending: false }) as any);
    if (error) throw new Error(error.message);

    const rows = (sessions ?? []) as Array<{
      id: string;
      started_at: string;
      ended_at: string | null;
      last_heartbeat_at: string;
    }>;

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = getMondayOfWeek(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    let hoursToday = 0;
    let hoursWeek = 0;
    let hoursMonth = 0;
    let hoursYear = 0;
    let firstLoginToday: string | null = null;
    let sessionsToday = 0;

    for (const s of rows) {
      const sStart = new Date(s.started_at);
      const h = computeSessionHours(s.started_at, s.ended_at, s.last_heartbeat_at);

      if (sStart >= yearStart) hoursYear += h;
      if (sStart >= monthStart) hoursMonth += h;
      if (sStart >= weekStart) hoursWeek += h;
      if (sStart >= todayStart) {
        hoursToday += h;
        sessionsToday++;
        if (!firstLoginToday || sStart < new Date(firstLoginToday)) {
          firstLoginToday = s.started_at;
        }
      }
    }

    const latestSession = rows[0] ?? null;
    let isOnline = false;
    if (latestSession && !latestSession.ended_at) {
      const hb = new Date(latestSession.last_heartbeat_at).getTime();
      isOnline = Date.now() - hb <= HEARTBEAT_STALE_MS;
    }

    return {
      isOnline,
      hoursToday: Math.round(hoursToday * 10) / 10,
      hoursWeek: Math.round(hoursWeek * 10) / 10,
      hoursMonth: Math.round(hoursMonth * 10) / 10,
      hoursYear: Math.round(hoursYear * 10) / 10,
      firstLoginToday,
      sessionsToday,
    };
  });

const ACTIVITY_SLOT_MS = 15 * 60 * 1000; // 15 minutes

export const recordActivityPing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const { data: session } = await (supabaseAdmin
      .from("staff_sessions" as any)
      .select("manager_id")
      .eq("id", data.sessionId)
      .eq("staff_user_id", userId)
      .maybeSingle() as any);

    if (!session?.manager_id) return { ok: false };

    await (supabaseAdmin
      .from("staff_activity_pings" as any)
      .insert({
        staff_user_id: userId,
        manager_id: session.manager_id,
        session_id: data.sessionId,
      }) as any);

    return { ok: true };
  });

export const getMyAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const now = new Date();
    const yearAgo = new Date(now);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    const { data: pings, error } = await (supabaseAdmin
      .from("staff_activity_pings" as any)
      .select("pinged_at")
      .eq("staff_user_id", userId)
      .gte("pinged_at", yearAgo.toISOString())
      .order("pinged_at", { ascending: true }) as any);
    if (error) throw new Error(error.message);

    const pingTimes = ((pings ?? []) as { pinged_at: string }[]).map(
      (p) => new Date(p.pinged_at).getTime(),
    );

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = getMondayOfWeek(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const countSlots = (from: number) => {
      const set = new Set<number>();
      for (const t of pingTimes) {
        if (t >= from) set.add(Math.floor(t / ACTIVITY_SLOT_MS));
      }
      return set;
    };

    const todaySlotSet = countSlots(todayStart.getTime());
    const weekSlotSet = countSlots(weekStart.getTime());
    const monthSlotSet = countSlots(monthStart.getTime());
    const yearSlotSet = countSlots(yearStart.getTime());

    let firstPingToday: number | null = null;
    for (const t of pingTimes) {
      if (t >= todayStart.getTime()) {
        if (firstPingToday === null || t < firstPingToday) firstPingToday = t;
      }
    }

    return {
      activeMinutesToday: todaySlotSet.size * 15,
      activeMinutesWeek: weekSlotSet.size * 15,
      activeMinutesMonth: monthSlotSet.size * 15,
      activeMinutesYear: yearSlotSet.size * 15,
      firstActivityToday: firstPingToday ? new Date(firstPingToday).toISOString() : null,
      todaySlotIndices: Array.from(todaySlotSet).sort((a, b) => a - b),
    };
  });

export const getTeamActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const managerId = context.userId;

    const now = new Date();
    const yearAgo = new Date(now);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    const { data: staffList, error: staffErr } = await supabaseAdmin
      .from("staff")
      .select("id, name, user_id, is_suspended")
      .eq("manager_id", managerId)
      .eq("status", "active");
    if (staffErr) throw new Error(staffErr.message);

    // Paginate sessions (newest first) so we always capture the most-recent
    // sessions first even if total rows exceed PostgREST's max-rows cap.
    type SessionRow = {
      id: string; staff_user_id: string;
      started_at: string; ended_at: string | null; last_heartbeat_at: string;
    };
    const allSessionRows: SessionRow[] = [];
    {
      const PAGE = 1000;
      let from = 0;
      for (let page = 0; page < 20; page++) {
        const { data, error } = await (supabaseAdmin
          .from("staff_sessions" as any)
          .select("id, staff_user_id, started_at, ended_at, last_heartbeat_at")
          .eq("manager_id", managerId)
          .eq("device_type", "desktop")
          .gte("started_at", yearAgo.toISOString())
          .order("started_at", { ascending: false })
          .range(from, from + PAGE - 1) as any);
        if (error) throw new Error(error.message);
        allSessionRows.push(...(data as SessionRow[]));
        if ((data as SessionRow[]).length < PAGE) break;
        from += PAGE;
      }
    }

    // Paginate candidates (lightweight — only 2 cols) for accurate per-staff counts.
    type CandRow = { created_by_user_id: string | null; created_at: string };
    const allCandidateRows: CandRow[] = [];
    {
      const PAGE = 1000;
      let from = 0;
      for (let page = 0; page < 50; page++) {
        const { data, error } = await (supabaseAdmin
          .from("candidates")
          .select("created_by_user_id, created_at")
          .eq("manager_id", managerId)
          .gte("created_at", yearAgo.toISOString())
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1) as any);
        if (error) throw new Error(error.message);
        allCandidateRows.push(...(data as CandRow[]));
        if ((data as CandRow[]).length < PAGE) break;
        from += PAGE;
      }
    }

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = getMondayOfWeek(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    return (staffList ?? []).map((staff) => {
      const uid = staff.user_id ?? "";
      // Sessions already sorted newest-first from the query
      const staffSessions = allSessionRows.filter((s) => s.staff_user_id === uid);
      const staffCandidates = allCandidateRows.filter((c) => c.created_by_user_id === uid);

      let hoursToday = 0;
      let hoursWeek = 0;
      let hoursMonth = 0;
      let hoursYear = 0;
      let firstLoginToday: string | null = null;
      let sessionsToday = 0;
      const workDaysMonthSet = new Set<string>();

      for (const s of staffSessions) {
        const sStart = new Date(s.started_at);
        const h = computeSessionHours(s.started_at, s.ended_at, s.last_heartbeat_at);

        if (sStart >= yearStart) hoursYear += h;
        if (sStart >= monthStart) {
          hoursMonth += h;
          workDaysMonthSet.add(sStart.toISOString().split("T")[0]);
        }
        if (sStart >= weekStart) hoursWeek += h;
        if (sStart >= todayStart) {
          hoursToday += h;
          sessionsToday++;
          if (!firstLoginToday || sStart < new Date(firstLoginToday)) {
            firstLoginToday = s.started_at;
          }
        }
      }

      // staffSessions[0] is already the most-recent session (sorted desc above)
      const latestSession = staffSessions[0] ?? null;

      let isOnline = false;
      let lastSeen: string | null = null;

      if (latestSession) {
        const hb = new Date(latestSession.last_heartbeat_at).getTime();
        if (!latestSession.ended_at && Date.now() - hb <= HEARTBEAT_STALE_MS) {
          isOnline = true;
        }
        // Prefer the explicit logout time; fall back to the last heartbeat
        // so "Last seen" reflects when they actually left, not when the
        // heartbeat happened to fire beforehand.
        lastSeen = latestSession.ended_at ?? latestSession.last_heartbeat_at;
      }

      const candidatesToday = staffCandidates.filter(
        (c) => new Date(c.created_at) >= todayStart,
      ).length;
      const candidatesWeek = staffCandidates.filter(
        (c) => new Date(c.created_at) >= weekStart,
      ).length;
      const candidatesMonth = staffCandidates.filter(
        (c) => new Date(c.created_at) >= monthStart,
      ).length;
      const candidatesYear = staffCandidates.filter(
        (c) => new Date(c.created_at) >= yearStart,
      ).length;

      return {
        staffId: staff.id,
        staffUserId: uid,
        name: staff.name,
        isOnline,
        isSuspended: (staff as any).is_suspended === true,
        lastSeen,
        firstLoginToday,
        sessionsToday,
        hoursToday: Math.round(hoursToday * 10) / 10,
        hoursWeek: Math.round(hoursWeek * 10) / 10,
        hoursMonth: Math.round(hoursMonth * 10) / 10,
        hoursYear: Math.round(hoursYear * 10) / 10,
        candidatesToday,
        candidatesWeek,
        candidatesMonth,
        candidatesYear,
        workDaysMonth: workDaysMonthSet.size,
      };
    });
  });
