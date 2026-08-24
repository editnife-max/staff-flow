import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// East Africa Time = UTC+3
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const LATE_START_HOUR = 9; // 09:00 AM
const LOOKBACK_DAYS   = 30;
const MAX_LATE        = 3;

function toEATDateStr(utc: Date): string {
  return new Date(utc.getTime() + EAT_OFFSET_MS).toISOString().split("T")[0];
}

function isLateInEAT(utc: Date): boolean {
  const eat = new Date(utc.getTime() + EAT_OFFSET_MS);
  return eat.getUTCHours() * 60 + eat.getUTCMinutes() >= LATE_START_HOUR * 60;
}

// Count unexcused late days in the past 30 days for a staff user
async function countUnexcusedLate(userId: string, now: Date): Promise<number> {
  const cutoff = toEATDateStr(new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000));
  const { count } = await supabaseAdmin
    .from("staff_daily_attendance" as any)
    .select("*", { count: "exact", head: true })
    .eq("staff_user_id", userId)
    .eq("is_late", true)
    .eq("excused", false)
    .gte("date", cutoff);
  return count ?? 0;
}

// Called once per session from the staff shell.
// Records the day's first login, returns warning/suspension state.
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
      });
    }

    const todayIsLate = existing ? (existing as any).is_late : isLate;

    // Count unexcused late days in past 30 days
    const lateCount = await countUnexcusedLate(userId, now);

    if (lateCount >= MAX_LATE) {
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

// Manager excuses a late day.
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

    // Re-check late count — auto-lift suspension if now below threshold
    const lateCount = await countUnexcusedLate((row as any).staff_user_id, new Date());
    if (lateCount < MAX_LATE) {
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
