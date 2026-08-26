import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// East Africa Time = UTC+3
const EAT_OFFSET_MS   = 3 * 60 * 60 * 1000;
const LATE_START_HOUR = 9; // 09:00 AM
const LOOKBACK_DAYS   = 30;
const MAX_INCIDENTS   = 2; // suspend after 2 unexcused late OR absent days

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

// Insert absent (no-login) rows for any weekday in the past 30 days
// where this staff member has no attendance record at all.
async function backfillAbsentDays(
  userId: string,
  staffId: string,
  managerId: string,
  now: Date,
): Promise<void> {
  const eatToday   = toEATDateStr(now);
  const cutoffDate = toEATDateStr(new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000));

  const { data: existingRows } = await (supabaseAdmin
    .from("staff_daily_attendance" as any)
    .select("date")
    .eq("staff_user_id", userId)
    .gte("date", cutoffDate) as any);

  const existingDates = new Set(
    ((existingRows ?? []) as { date: string }[]).map((r) => r.date),
  );

  const absentsToInsert: any[] = [];
  for (
    let d = new Date(cutoffDate + "T00:00:00Z");
    d.toISOString().split("T")[0] < eatToday;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const dow = d.getUTCDay(); // 0=Sun, 6=Sat
    if (dow === 0 || dow === 6) continue;
    const dateStr = d.toISOString().split("T")[0];
    if (!existingDates.has(dateStr)) {
      absentsToInsert.push({
        staff_user_id:  userId,
        manager_id:     managerId,
        staff_id:       staffId,
        date:           dateStr,
        first_login_at: null,
        is_late:        false,
        absent:         true,
      });
    }
  }

  if (absentsToInsert.length > 0) {
    await (supabaseAdmin
      .from("staff_daily_attendance" as any)
      .upsert(absentsToInsert, { onConflict: "staff_user_id,date", ignoreDuplicates: true } as any) as any);
  }
}

// Called once per session from the staff shell.
// Records the day's first login, backfills missed weekdays, returns warning/suspension state.
export const recordStaffLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const now = new Date();

    const { data: staffRow } = await supabaseAdmin
      .from("staff")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle() as unknown as { data: { id: string; manager_id: string; is_suspended: boolean } | null };

    if (!staffRow) return { isLate: false, isSuspended: false, lateCount: 0 };

    if (staffRow.is_suspended) {
      return { isLate: false, isSuspended: true, lateCount: 0 };
    }

    const eatDate = toEATDateStr(now);
    const isLate  = isLateInEAT(now);

    // Record first login of the day (skip if already recorded)
    const { data: existing } = await supabaseAdmin
      .from("staff_daily_attendance" as any)
      .select("is_late, excused")
      .eq("staff_user_id", userId)
      .eq("date", eatDate)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from("staff_daily_attendance" as any).insert({
        staff_user_id:  userId,
        manager_id:     staffRow.manager_id,
        staff_id:       staffRow.id,
        date:           eatDate,
        first_login_at: now.toISOString(),
        is_late:        isLate,
        absent:         false,
      });
    }

    const todayIsLate = existing ? (existing as any).is_late : isLate;

    // Backfill absent rows for weekdays with no login
    await backfillAbsentDays(userId, staffRow.id, staffRow.manager_id, now);

    // Count all unexcused incidents (late + absent) in the past 30 days
    const lateCount = await countUnexcusedIncidents(userId, now);

    if (lateCount >= MAX_INCIDENTS) {
      await supabaseAdmin
        .from("staff")
        .update({ is_suspended: true, suspended_at: now.toISOString() } as any)
        .eq("id", staffRow.id);
      return { isLate: todayIsLate, isSuspended: true, lateCount };
    }

    return { isLate: todayIsLate, isSuspended: false, lateCount };
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

    // Re-check incident count — auto-lift suspension if now below threshold
    const count = await countUnexcusedIncidents((row as any).staff_user_id, new Date());
    if (count < MAX_INCIDENTS) {
      await supabaseAdmin
        .from("staff")
        .update({ is_suspended: false, suspended_at: null } as any)
        .eq("user_id", (row as any).staff_user_id);
    }

    return { ok: true };
  });

// Manager removes the suspension and clears the attendance window so the
// staff starts fresh (avoids immediate re-suspension on next login).
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

// Manager-triggered: backfills absent rows for a single staff member.
// Called when the manager opens that staff's late-login dialog.
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

// Manager-triggered: backfills absent rows for ALL staff under this manager.
// Safe to call repeatedly — uses ignoreDuplicates so existing records are untouched.
export const backfillTeamAbsents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const managerId = context.userId;
    const now        = new Date();
    const eatToday   = toEATDateStr(now);
    const cutoffDate = toEATDateStr(new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000));

    const { data: staffList } = await supabaseAdmin
      .from("staff")
      .select("id, user_id, manager_id")
      .eq("manager_id", managerId)
      .not("user_id", "is", null);

    if (!staffList?.length) return { ok: true };

    const { data: existingRows } = await (supabaseAdmin
      .from("staff_daily_attendance" as any)
      .select("staff_user_id, date")
      .eq("manager_id", managerId)
      .gte("date", cutoffDate) as any);

    const existingSet = new Set(
      ((existingRows ?? []) as { staff_user_id: string; date: string }[])
        .map((r) => `${r.staff_user_id}:${r.date}`),
    );

    const absentsToInsert: any[] = [];

    for (const staff of staffList) {
      if (!staff.user_id) continue;
      for (
        let d = new Date(cutoffDate + "T00:00:00Z");
        d.toISOString().split("T")[0] < eatToday;
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        const dow = d.getUTCDay();
        if (dow === 0 || dow === 6) continue;
        const dateStr = d.toISOString().split("T")[0];
        if (!existingSet.has(`${staff.user_id}:${dateStr}`)) {
          absentsToInsert.push({
            staff_user_id:  staff.user_id,
            manager_id:     staff.manager_id,
            staff_id:       staff.id,
            date:           dateStr,
            first_login_at: null,
            is_late:        false,
            absent:         true,
          });
        }
      }
    }

    if (absentsToInsert.length > 0) {
      const BATCH = 500;
      for (let i = 0; i < absentsToInsert.length; i += BATCH) {
        await (supabaseAdmin
          .from("staff_daily_attendance" as any)
          .upsert(absentsToInsert.slice(i, i + BATCH), {
            onConflict: "staff_user_id,date",
            ignoreDuplicates: true,
          } as any) as any);
      }
    }

    return { ok: true };
  });
