import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// East Africa Time = UTC+3
const EAT_OFFSET_MS   = 3 * 60 * 60 * 1000;
const LATE_START_HOUR = 9; // 09:00 AM
const LOOKBACK_DAYS   = 30;
const MAX_INCIDENTS   = 2; // suspend after 2 unexcused incidents

function toEATDateStr(utc: Date): string {
  return new Date(utc.getTime() + EAT_OFFSET_MS).toISOString().split("T")[0];
}

function isLateInEAT(utc: Date): boolean {
  const eat = new Date(utc.getTime() + EAT_OFFSET_MS);
  return eat.getUTCHours() * 60 + eat.getUTCMinutes() >= LATE_START_HOUR * 60;
}

// Count unexcused incidents: late logins (is_late=true) + no-login days (absent=true)
async function countUnexcusedIncidents(userId: string, now: Date): Promise<number> {
  const cutoff = toEATDateStr(new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000));
  const { count } = await (supabaseAdmin
    .from("staff_daily_attendance" as any)
    .select("*", { count: "exact", head: true })
    .eq("staff_user_id", userId)
    .eq("excused", false)
    .or("is_late.eq.true,absent.eq.true")
    .gte("date", cutoff) as any);
  return count ?? 0;
}

type ExistRow = {
  id: string;
  date: string;
  is_late: boolean;
  absent: boolean;
  first_login_at: string | null;
};

// Core backfill logic for a single staff member:
//  • Previous weekday, no record          → insert absent (No Login)
//  • Previous record: tentative-late      → flip to absent (never logged in)
//  • Today past 9 AM, no record yet       → insert tentative Late penalty
async function backfillAbsentDays(
  userId: string,
  staffId: string,
  managerId: string,
  now: Date,
): Promise<void> {
  const eatToday     = toEATDateStr(now);
  const cutoffDate   = toEATDateStr(new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000));
  const todayPast9AM = isLateInEAT(now);

  const { data: existingRows } = await (supabaseAdmin
    .from("staff_daily_attendance" as any)
    .select("id, date, is_late, absent, first_login_at")
    .eq("staff_user_id", userId)
    .gte("date", cutoffDate) as any);

  const existingMap = new Map<string, ExistRow>(
    ((existingRows ?? []) as ExistRow[]).map((r) => [r.date, r]),
  );

  const toInsert: any[]    = [];
  const toMarkAbsent: string[] = []; // tentative-late IDs → flip to absent

  for (
    let d = new Date(cutoffDate + "T00:00:00Z");
    d.toISOString().split("T")[0] <= eatToday;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const dow     = d.getUTCDay(); // 0=Sun, 6=Sat
    const dateStr = d.toISOString().split("T")[0];
    const isToday = dateStr === eatToday;

    if (dow === 0 || dow === 6) continue; // skip weekends

    const existing = existingMap.get(dateStr);

    if (!existing) {
      if (isToday && todayPast9AM) {
        // Past 9 AM today, no login yet → tentative late penalty
        toInsert.push({
          staff_user_id:  userId,
          manager_id:     managerId,
          staff_id:       staffId,
          date:           dateStr,
          first_login_at: null,
          is_late:        true,
          absent:         false,
        });
      } else if (!isToday) {
        // Previous weekday with no record → absent (No Login)
        toInsert.push({
          staff_user_id:  userId,
          manager_id:     managerId,
          staff_id:       staffId,
          date:           dateStr,
          first_login_at: null,
          is_late:        false,
          absent:         true,
        });
      }
      // today before 9 AM: skip — too early to penalise
    } else if (!isToday && existing.is_late && !existing.absent && existing.first_login_at === null) {
      // Tentative late from a previous day: staff never logged in → mark as absent
      toMarkAbsent.push(existing.id);
    }
  }

  if (toInsert.length > 0) {
    await (supabaseAdmin
      .from("staff_daily_attendance" as any)
      .upsert(toInsert, { onConflict: "staff_user_id,date", ignoreDuplicates: true } as any) as any);
  }

  if (toMarkAbsent.length > 0) {
    await (supabaseAdmin
      .from("staff_daily_attendance" as any)
      .update({ is_late: false, absent: true } as any)
      .in("id", toMarkAbsent) as any);
  }
}

// Called once per session from the staff shell.
// Records (or updates) the day's first login, backfills missed days.
export const recordStaffLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const now    = new Date();

    const { data: staffRow } = await supabaseAdmin
      .from("staff")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle() as unknown as { data: { id: string; manager_id: string; is_suspended: boolean } | null };

    if (!staffRow) return { isLate: false, isSuspended: false, lateCount: 0 };
    if (staffRow.is_suspended) return { isLate: false, isSuspended: true, lateCount: 0 };

    const eatDate = toEATDateStr(now);
    const isLate  = isLateInEAT(now);

    const { data: existing } = await (supabaseAdmin
      .from("staff_daily_attendance" as any)
      .select("id, is_late, excused, first_login_at")
      .eq("staff_user_id", userId)
      .eq("date", eatDate)
      .maybeSingle() as any);

    if (!existing) {
      // No record yet → create with actual login time
      await supabaseAdmin.from("staff_daily_attendance" as any).insert({
        staff_user_id:  userId,
        manager_id:     staffRow.manager_id,
        staff_id:       staffRow.id,
        date:           eatDate,
        first_login_at: now.toISOString(),
        is_late:        isLate,
        absent:         false,
      });
    } else if (!(existing as any).first_login_at) {
      // Tentative late record exists (no login time yet) → update with actual login
      await (supabaseAdmin
        .from("staff_daily_attendance" as any)
        .update({ first_login_at: now.toISOString(), is_late: isLate, absent: false } as any)
        .eq("id", (existing as any).id) as any);
    }
    // else: first_login_at already recorded → skip

    // Backfill absent / tentative-late rows for other weekdays
    await backfillAbsentDays(userId, staffRow.id, staffRow.manager_id, now);

    const lateCount = await countUnexcusedIncidents(userId, now);

    if (lateCount >= MAX_INCIDENTS) {
      await supabaseAdmin
        .from("staff")
        .update({ is_suspended: true, suspended_at: now.toISOString() } as any)
        .eq("id", staffRow.id);
      return { isLate, isSuspended: true, lateCount };
    }

    return { isLate, isSuspended: false, lateCount };
  });

// Staff submits a reason for today's late login.
export const submitLateReason = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ reason: z.string().min(1).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    const userId  = context.userId;
    const eatDate = toEATDateStr(new Date());
    await supabaseAdmin
      .from("staff_daily_attendance" as any)
      .update({ reason: data.reason })
      .eq("staff_user_id", userId)
      .eq("date", eatDate)
      .eq("is_late", true);
    return { ok: true };
  });

// Manager excuses a late or absent day.
// If excusing brings the count below threshold, auto-lifts suspension.
export const excuseLateDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ attendanceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const managerId = context.userId;

    const { data: row } = await supabaseAdmin
      .from("staff_daily_attendance" as any)
      .select("id, manager_id, staff_user_id")
      .eq("id", data.attendanceId)
      .maybeSingle();

    if (!row || (row as any).manager_id !== managerId) {
      throw new Response("Not found", { status: 404 });
    }

    await supabaseAdmin
      .from("staff_daily_attendance" as any)
      .update({ excused: true, excused_at: new Date().toISOString() })
      .eq("id", data.attendanceId);

    const count = await countUnexcusedIncidents((row as any).staff_user_id, new Date());
    if (count < MAX_INCIDENTS) {
      await supabaseAdmin
        .from("staff")
        .update({ is_suspended: false, suspended_at: null } as any)
        .eq("user_id", (row as any).staff_user_id);
    }

    return { ok: true };
  });

// Manager removes suspension and clears attendance so the staff starts fresh.
export const unsuspendStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ staffId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const managerId = context.userId;

    const { data: row } = await supabaseAdmin
      .from("staff")
      .select("id, manager_id, user_id")
      .eq("id", data.staffId)
      .maybeSingle();

    if (!row || row.manager_id !== managerId) throw new Response("Not found", { status: 404 });

    if (row.user_id) {
      await supabaseAdmin
        .from("staff_daily_attendance" as any)
        .delete()
        .eq("staff_user_id", row.user_id);
    }

    await supabaseAdmin
      .from("staff")
      .update({ is_suspended: false, suspended_at: null } as any)
      .eq("id", data.staffId);

    return { ok: true };
  });

// Manager fetches attendance history for a staff member (bypasses RLS).
export const getStaffAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ staffUserId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const managerId = context.userId;

    const { data: staffRow } = await supabaseAdmin
      .from("staff")
      .select("id, manager_id")
      .eq("user_id", data.staffUserId)
      .maybeSingle();

    if (!staffRow || staffRow.manager_id !== managerId) {
      throw new Response("Not found", { status: 404 });
    }

    const cutoff = toEATDateStr(new Date(Date.now() - LOOKBACK_DAYS * 86_400_000));

    const { data: rows } = await (supabaseAdmin
      .from("staff_daily_attendance" as any)
      .select("id, date, first_login_at, is_late, absent, reason, excused, excused_at")
      .eq("staff_user_id", data.staffUserId)
      .gte("date", cutoff)
      .order("date", { ascending: false }) as any);

    return (rows ?? []) as Array<{
      id: string;
      date: string;
      first_login_at: string | null;
      is_late: boolean;
      absent: boolean;
      reason: string | null;
      excused: boolean;
      excused_at: string | null;
    }>;
  });

// Manager fetches all staff who haven't logged in yet today past 9 AM EAT.
export const getTodayLateStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const managerId = context.userId;
    const now       = new Date();
    const eatToday  = toEATDateStr(now);

    if (!isLateInEAT(now)) return [] as Array<{ attendanceId: string; staffId: string; staffUserId: string; name: string }>;

    const { data: rows } = await (supabaseAdmin
      .from("staff_daily_attendance" as any)
      .select("id, staff_user_id, staff_id")
      .eq("manager_id", managerId)
      .eq("date", eatToday)
      .eq("is_late", true)
      .is("first_login_at", null)
      .eq("excused", false) as any);

    if (!rows?.length) return [] as Array<{ attendanceId: string; staffId: string; staffUserId: string; name: string }>;

    const userIds = (rows as any[]).map((r) => r.staff_user_id);
    const { data: staffList } = await supabaseAdmin
      .from("staff")
      .select("user_id, name")
      .in("user_id", userIds);

    const nameMap = Object.fromEntries((staffList ?? []).map((s) => [s.user_id, s.name]));

    return (rows as any[]).map((r) => ({
      attendanceId: r.id as string,
      staffId:      r.staff_id as string,
      staffUserId:  r.staff_user_id as string,
      name:         (nameMap[r.staff_user_id] ?? "Unknown") as string,
    }));
  });

// Manager-triggered: backfills a single staff member's absent/late records.
export const backfillStaffAbsents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ staffUserId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const managerId = context.userId;
    const { data: staffRow } = await supabaseAdmin
      .from("staff")
      .select("id, manager_id")
      .eq("user_id", data.staffUserId)
      .maybeSingle();
    if (!staffRow || staffRow.manager_id !== managerId) {
      throw new Response("Not found", { status: 404 });
    }
    await backfillAbsentDays(data.staffUserId, staffRow.id, managerId, new Date());
    return { ok: true };
  });

// Manager-triggered: backfills ALL staff under this manager.
// Safe to call repeatedly — ignoreDuplicates skips existing records;
// tentative-late records from previous days are flipped to absent.
export const backfillTeamAbsents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const managerId    = context.userId;
    const now          = new Date();
    const eatToday     = toEATDateStr(now);
    const cutoffDate   = toEATDateStr(new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000));
    const todayPast9AM = isLateInEAT(now);

    const { data: staffList } = await supabaseAdmin
      .from("staff")
      .select("id, user_id, manager_id")
      .eq("manager_id", managerId)
      .not("user_id", "is", null);

    if (!staffList?.length) return { ok: true };

    type TeamExistRow = ExistRow & { staff_user_id: string };
    const { data: existingRows } = await (supabaseAdmin
      .from("staff_daily_attendance" as any)
      .select("id, staff_user_id, date, is_late, absent, first_login_at")
      .eq("manager_id", managerId)
      .gte("date", cutoffDate) as any);

    const existingMap = new Map<string, TeamExistRow>(
      ((existingRows ?? []) as TeamExistRow[]).map((r) => [`${r.staff_user_id}:${r.date}`, r]),
    );

    const toInsert: any[]        = [];
    const toMarkAbsent: string[] = [];

    for (const staff of staffList) {
      if (!staff.user_id) continue;

      for (
        let d = new Date(cutoffDate + "T00:00:00Z");
        d.toISOString().split("T")[0] <= eatToday;
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        const dow     = d.getUTCDay();
        const dateStr = d.toISOString().split("T")[0];
        const isToday = dateStr === eatToday;

        if (dow === 0 || dow === 6) continue;

        const existing = existingMap.get(`${staff.user_id}:${dateStr}`);

        if (!existing) {
          if (isToday && todayPast9AM) {
            toInsert.push({
              staff_user_id:  staff.user_id,
              manager_id:     staff.manager_id,
              staff_id:       staff.id,
              date:           dateStr,
              first_login_at: null,
              is_late:        true,
              absent:         false,
            });
          } else if (!isToday) {
            toInsert.push({
              staff_user_id:  staff.user_id,
              manager_id:     staff.manager_id,
              staff_id:       staff.id,
              date:           dateStr,
              first_login_at: null,
              is_late:        false,
              absent:         true,
            });
          }
        } else if (!isToday && existing.is_late && !existing.absent && existing.first_login_at === null) {
          toMarkAbsent.push(existing.id);
        }
      }
    }

    const BATCH = 500;

    if (toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += BATCH) {
        await (supabaseAdmin
          .from("staff_daily_attendance" as any)
          .upsert(toInsert.slice(i, i + BATCH), {
            onConflict: "staff_user_id,date",
            ignoreDuplicates: true,
          } as any) as any);
      }
    }

    if (toMarkAbsent.length > 0) {
      for (let i = 0; i < toMarkAbsent.length; i += BATCH) {
        await (supabaseAdmin
          .from("staff_daily_attendance" as any)
          .update({ is_late: false, absent: true } as any)
          .in("id", toMarkAbsent.slice(i, i + BATCH)) as any);
      }
    }

    return { ok: true };
  });
