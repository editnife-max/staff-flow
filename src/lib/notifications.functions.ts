import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getStaffList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("staff")
      .select("id, name, user_id")
      .not("user_id", "is", null)
      .eq("status", "active")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; name: string; user_id: string }[];
  });

export const sendCandidatesNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      staffUserId:  z.string().uuid(),
      candidateIds: z.array(z.string().uuid()).min(1),
      message:      z.string().max(500).optional(),
      notifType:    z.enum(["selected", "reserved"]).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("full_name, agency_name")
      .eq("id", context.userId).maybeSingle() as any;

    const senderName = profile?.agency_name ?? profile?.full_name ?? "Agency";
    const count = data.candidateIds.length;

    // If reserved, lock candidates for 3 days
    if (data.notifType === "reserved") {
      const { error: resErr } = await supabaseAdmin
        .from("candidates")
        .update({ reserved_at: new Date().toISOString(), reserved_by: senderName } as any)
        .in("id", data.candidateIds);
      if (resErr) throw new Error(resErr.message);
    }

    const { error } = await supabaseAdmin.from("notifications" as any).insert({
      recipient_id:  data.staffUserId,
      sender_id:     context.userId,
      type:          "candidates_sent",
      title:         `${senderName} sent you ${count} candidate${count !== 1 ? "s" : ""}`,
      body:          data.message ?? null,
      candidate_ids: data.candidateIds,
      read:          false,
      status:        "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acceptCandidatesNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      notificationId: z.string().uuid(),
      candidateIds:   z.array(z.string().uuid()).min(1),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Move candidates to processing
    const { error: candErr } = await supabaseAdmin
      .from("candidates")
      .update({ status: "processing" })
      .in("id", data.candidateIds);
    if (candErr) throw new Error(candErr.message);

    // Delete notification so it disappears from staff's list
    const { error: notifErr } = await supabaseAdmin
      .from("notifications" as any)
      .delete()
      .eq("id", data.notificationId)
      .eq("recipient_id", context.userId);
    if (notifErr) throw new Error(notifErr.message);

    return { ok: true };
  });

export const declineCandidatesNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      notificationId: z.string().uuid(),
      agencyUserId:   z.string().uuid(),
      candidateIds:   z.array(z.string().uuid()).min(1),
      reason:         z.string().min(1).max(500),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Get staff name for the reply title
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("full_name")
      .eq("id", context.userId).maybeSingle();

    const staffName = profile?.full_name ?? "Staff";
    const count = data.candidateIds.length;

    // Send decline notification back to agency
    const { error: replyErr } = await supabaseAdmin.from("notifications" as any).insert({
      recipient_id:  data.agencyUserId,
      sender_id:     context.userId,
      type:          "candidates_declined",
      title:         `${staffName} declined your ${count} candidate${count !== 1 ? "s" : ""}`,
      body:          data.reason,
      candidate_ids: data.candidateIds,
      read:          false,
      status:        "pending",
    });
    if (replyErr) throw new Error(replyErr.message);

    // Mark original notification as declined
    const { error: notifErr } = await supabaseAdmin
      .from("notifications" as any)
      .update({ status: "declined", read: true })
      .eq("id", data.notificationId)
      .eq("recipient_id", context.userId);
    if (notifErr) throw new Error(notifErr.message);

    // Clear reservation lock on declined candidates
    await supabaseAdmin
      .from("candidates")
      .update({ reserved_at: null, reserved_by: null } as any)
      .in("id", data.candidateIds);

    return { ok: true };
  });
