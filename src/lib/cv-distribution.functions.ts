// CV distribution entry points. These only QUEUE work — the cv-distribution
// edge function does the distribution in the background (see
// supabase/functions/cv-distribution and migration 20261113120000).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireManager(userId: string): Promise<string> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (!roles?.some((r) => r.role === "manager"))
    throw new Error("Only managers can distribute CVs");
  return userId;
}

/** Managers act for themselves; staff act for their manager. */
async function requireManagerScope(userId: string): Promise<string> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role, manager_id")
    .eq("user_id", userId);
  if (roles?.some((r) => r.role === "manager")) return userId;
  const staff = roles?.find((r) => r.role === "staff" && r.manager_id);
  if (staff?.manager_id) return staff.manager_id;
  throw new Error("No manager scope");
}

/** Queue a full distribution run. Re-uses an already queued/running run instead of starting a second one. */
export const runDistribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ baseLimit: z.number().int().min(1).max(500).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const managerId = await requireManager(context.userId);

    if (data.baseLimit) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("cv_page_requirements")
        .eq("id", managerId)
        .maybeSingle();
      const current = (profile?.cv_page_requirements as Record<string, unknown>) ?? {};
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          cv_page_requirements: { ...current, base_per_office: String(data.baseLimit) },
        } as never)
        .eq("id", managerId);
      if (error) throw new Error(error.message);
    }

    const { data: existing } = await supabaseAdmin
      .from("distribution_jobs")
      .select("id")
      .eq("manager_id", managerId)
      .eq("kind", "distribute")
      .in("status", ["pending", "running"])
      .limit(1)
      .maybeSingle();
    if (existing) return { jobId: existing.id as string, alreadyQueued: true };

    const { data: job, error } = await supabaseAdmin
      .from("distribution_jobs")
      .insert({
        manager_id: managerId,
        kind: "distribute",
        trigger: "manual",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { jobId: job.id as string, alreadyQueued: false };
  });

/** Queue a manual send of chosen candidates to one office. The worker validates every candidate. */
export const manualSendCvs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        officeId: z.string().uuid(),
        candidateIds: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const managerId = await requireManagerScope(context.userId);
    const { data: office } = await supabaseAdmin
      .from("assignment_offices")
      .select("id, is_locked")
      .eq("id", data.officeId)
      .eq("manager_id", managerId)
      .maybeSingle();
    if (!office) throw new Error("Office not found");
    if (office.is_locked) throw new Error("This office is locked");

    const { data: job, error } = await supabaseAdmin
      .from("distribution_jobs")
      .insert({
        manager_id: managerId,
        kind: "manual_send",
        trigger: "manual",
        created_by: context.userId,
        payload: { office_id: data.officeId, candidate_ids: data.candidateIds },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { jobId: job.id as string };
  });
