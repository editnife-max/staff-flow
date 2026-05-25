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
      staffUserId: z.string().uuid(),
      candidateIds: z.array(z.string().uuid()).min(1),
      message: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Get sender's agency name
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, agency_name")
      .eq("id", context.userId)
      .maybeSingle() as any;

    const senderName = profile?.agency_name ?? profile?.full_name ?? "Agency";
    const count = data.candidateIds.length;
    const title = `${senderName} sent you ${count} candidate${count !== 1 ? "s" : ""}`;

    const { error } = await supabaseAdmin.from("notifications" as any).insert({
      recipient_id: data.staffUserId,
      sender_id: context.userId,
      type: "candidates_sent",
      title,
      body: data.message ?? null,
      candidate_ids: data.candidateIds,
      read: false,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
